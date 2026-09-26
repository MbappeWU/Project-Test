import { SandField, streakPattern } from './field.js';
import { LightTable } from './light.js';
import { Noise } from './noise.js';
import { Rng } from './rng.js';
import { polygonMask, feather, roughen } from './mask.js';
import { clamp } from './geom.js';
import { Hand } from './hand.js';

// Scenes are authored on a virtual canvas (1920x1080 for the landscape stream, 1080x1920 for
// vertical shorts); the stage maps it to its real resolution.
export const VW = 1920;

const HAND_ACTIVITY = { relax: 1, fill: 0.6, pour: 0.4, carve: 0.35 };

export class Stage {
  constructor({ width = 1280, height = 720, seed = 1, palette = 'amber', canvas = null, virtual = null, hand = true } = {}) {
    this.width = width;
    this.height = height;
    this.VW = virtual ? virtual[0] : VW;
    this.VH = virtual ? virtual[1] : (height * VW) / width;
    this.s = width / this.VW;
    this.seed = seed;
    this.canvas = canvas;
    this.field = new SandField(width, height);
    this.light = new LightTable(width, height, { seed: seed ^ 0x2c1b3c6d, palette });
    // sand: the light table with everything lying on it (sand, seal); frame: what the camera
    // sees, i.e. sand plus the artist's hand plus titles and captions.
    this.sand = new Uint8ClampedArray(width * height * 4);
    this.frame = new Uint8ClampedArray(width * height * 4);
    this.noise = new Noise(seed ^ 0x7f4a7c15);
    this.rng = new Rng(seed);
    this.streaks = [0.45, 0.6, 0.75].map((depth, i) => streakPattern(this.noise, depth, 0.07 + 0.03 * i, 17 * (i + 1)));
    this.overlays = [];
    this.queue = [];
    this.current = null;
    this.time = 0;
    this.hand = null;
    this.handKind = null;
    this.prevHandRect = null;
    // hand: 'high' (or true), 'low' for the real-time stream, 'off' (or false) for none.
    this.artist = hand && hand !== 'off' && canvas ? new Hand(this, { quality: hand === 'low' ? 'low' : 'high' }) : null;
    this.activity = 0;
    this.listeners = [];
    this.canvases = new Map();
    this.light.render(this.field, this.sand);
    this.frame.set(this.sand);
  }

  // Scratch canvases for text and sprites, reused by size: scenes repeat for days, so creating
  // fresh native canvases each time would slowly grow memory.
  scratch(w, h) {
    const key = `${w}x${h}`;
    let c = this.canvases.get(key);
    if (!c) {
      if (this.canvases.size >= 96) this.canvases.clear();
      c = this.canvas.create(w, h);
      this.canvases.set(key, c);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, w, h);
    return c;
  }

  on(fn) {
    this.listeners.push(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners) fn(event, data);
  }

  play(actions) {
    for (const a of actions.flat(Infinity)) if (a) this.queue.push(a);
  }

  get busy() {
    return !!this.current || this.queue.length > 0;
  }


  setHand(pos, kind) {
    this.hand = pos;
    this.handKind = kind;
  }

  // `overlayDt` lets a time-warped performance (fast-drawn shorts) keep captions on real time.
  advance(dt, overlayDt = dt) {
    this.time += dt;
    this.hand = null;
    let budget = dt;
    let guard = 0;
    while (guard++ < 10000) {
      if (!this.current) {
        if (!this.queue.length) break;
        this.current = this.queue.shift();
        this.current.p = 0;
        this.current.begin?.(this);
      }
      const a = this.current;
      if (a.duration <= 0) {
        a.step(this, 0, 1);
        this.current = null;
        continue;
      }
      if (budget <= 0) break;
      const remain = (1 - a.p) * a.duration;
      const use = Math.min(budget, remain);
      const p1 = use >= remain ? 1 : a.p + use / a.duration;
      a.step(this, a.p, p1);
      a.p = p1;
      budget -= use;
      if (p1 >= 1) this.current = null;
      else break;
    }
    const target = this.hand ? HAND_ACTIVITY[this.handKind] || 0.3 : 0;
    this.activity += (target - this.activity) * Math.min(1, dt * 6);
    this.artist?.update(overlayDt, this.hand, this.handKind);
    for (const o of this.overlays) o.tick(overlayDt);
    const alive = this.overlays.filter((o) => !o.finished);
    for (const o of this.overlays) if (o.finished) this.field.touch(...o.rect());
    this.overlays = alive;
  }

  addOverlay(overlay) {
    this.overlays.push(overlay);
    return overlay;
  }

  // Composites dirty regions into this.frame and returns the list of updated rectangles.
  render() {
    const sandRects = [];
    const fd = this.field.takeDirty();
    if (fd) sandRects.push(fd);
    const uiRects = [];
    for (const o of this.overlays) {
      if (o.changed) {
        (o.onSand ? sandRects : uiRects).push(o.rect());
        o.changed = false;
      }
    }
    for (const [x0, y0, x1, y1] of mergeRects(sandRects, this.width, this.height)) {
      this.light.render(this.field, this.sand, x0, y0, x1, y1);
      for (const o of this.overlays) if (o.onSand) o.composite(this.sand, this.width, x0, y0, x1, y1);
    }
    const handRect = this.artist?.rect() ?? null;
    if (!handRect) this.artist?.hidden();
    const rects = [...sandRects, ...uiRects];
    if (this.prevHandRect) rects.push(this.prevHandRect);
    if (handRect) rects.push(handRect);
    this.prevHandRect = handRect;
    if (handRect) this.artist.paint(handRect);
    const merged = mergeRects(rects, this.width, this.height);
    const W = this.width;
    for (const [x0, y0, x1, y1] of merged) {
      for (let y = y0; y < y1; y++) this.frame.set(this.sand.subarray((y * W + x0) * 4, (y * W + x1) * 4), (y * W + x0) * 4);
      if (handRect) this.artist.composite(this.frame, W, x0, y0, x1, y1);
      for (const o of this.overlays) if (!o.onSand) o.composite(this.frame, W, x0, y0, x1, y1);
    }
    return merged;
  }

  get handVisible() {
    return !!this.artist?.visible;
  }

  // ---- authoring helpers (virtual coordinates in, field coordinates out) ----

  mask(polys, { feather: fr = 0, rough = 0, roughScale = 0.05, seed = 0 } = {}) {
    const s = this.s;
    const list = polys.length && typeof polys[0][0] === 'number' ? [polys] : polys;
    let m = polygonMask(list.map((p) => p.map(([x, y]) => [x * s, y * s])), this.width, this.height);
    if (fr > 0) m = feather(m, fr * s, this.width, this.height);
    if (rough > 0) m = roughen(m, this.noise, { scale: roughScale / s, amount: rough, seed });
    return m;
  }

  // Density fields for fills, all in field coordinates.
  mottle(level, amp = 0.12, scale = 0.012, seed = 0) {
    const n = this.noise;
    const f = scale / this.s;
    return (x, y) => level * (1 + amp * n.fbm2(seed + x * f, y * f, 3));
  }

  streaky(level, amp = 0.18, sx = 0.002, sy = 0.05, seed = 0) {
    const n = this.noise;
    const fx = sx / this.s;
    const fy = sy / this.s;
    return (x, y) => level * (1 + amp * n.fbm2(seed + x * fx, y * fy, 3));
  }

  vgrad(top, bottom, y0, y1, amp = 0.1, seed = 0) {
    const n = this.noise;
    const s = this.s;
    const f = 0.004 / s;
    return (x, y) => {
      const t = clamp((y / s - y0) / (y1 - y0), 0, 1);
      return (top + (bottom - top) * t) * (1 + amp * n.fbm2(seed + x * f, y * f * 6, 3));
    };
  }
}

function mergeRects(rects, W, H) {
  const list = rects
    .map(([x0, y0, x1, y1]) => [Math.max(0, x0), Math.max(0, y0), Math.min(W, x1), Math.min(H, y1)])
    .filter(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0);
  let merged = true;
  while (merged && list.length > 1) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a[0] <= b[2] + 8 && b[0] <= a[2] + 8 && a[1] <= b[3] + 8 && b[1] <= a[3] + 8) {
          list[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
          list.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return list;
}
