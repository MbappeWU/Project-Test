import { SandField, streakPattern } from './field.js';
import { LightTable } from './light.js';
import { Noise } from './noise.js';
import { Rng } from './rng.js';
import { polygonMask, feather, roughen } from './mask.js';
import { clamp } from './geom.js';

// Scenes are authored on a virtual 1920x1080 canvas; the stage maps them to its real resolution.
export const VW = 1920;

const HAND_ACTIVITY = { relax: 1, fill: 0.6, pour: 0.4, carve: 0.35 };

export class Stage {
  constructor({ width = 1280, height = 720, seed = 1, palette = 'amber', canvas = null } = {}) {
    this.width = width;
    this.height = height;
    this.s = width / VW;
    this.seed = seed;
    this.canvas = canvas;
    this.field = new SandField(width, height);
    this.light = new LightTable(width, height, { seed: seed ^ 0x2c1b3c6d, palette });
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
    this.activity = 0;
    this.listeners = [];
    this.canvases = new Map();
    this.light.render(this.field, this.frame);
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

  advance(dt) {
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
    for (const o of this.overlays) o.tick(dt);
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
    const rects = [];
    const fd = this.field.takeDirty();
    if (fd) rects.push(fd);
    for (const o of this.overlays) {
      if (o.changed) {
        rects.push(o.rect());
        o.changed = false;
      }
    }
    const handRect = this.hand ? this.handRect() : null;
    if (this.prevHandRect) rects.push(this.prevHandRect);
    if (handRect) rects.push(handRect);
    this.prevHandRect = handRect;
    const merged = mergeRects(rects, this.width, this.height);
    for (const [x0, y0, x1, y1] of merged) {
      this.light.render(this.field, this.frame, x0, y0, x1, y1);
      for (const o of this.overlays) o.composite(this.frame, this.width, x0, y0, x1, y1);
      if (handRect) this.drawHand(x0, y0, x1, y1);
    }
    return merged;
  }


  handRect() {
    const r = 46 * this.s;
    const [hx, hy] = this.handPos();
    return [Math.floor(hx - r), Math.floor(hy - r), Math.ceil(hx + r), Math.ceil(hy + r)];
  }

  handPos() {
    // The fingertip's shadow falls slightly down and to the right of the contact point.
    return [(this.hand[0] + 9) * this.s, (this.hand[1] + 12) * this.s];
  }

  drawHand(x0, y0, x1, y1) {
    const [hx, hy] = this.handPos();
    const r = 46 * this.s;
    const depth = this.handKind === 'relax' ? 0.26 : 0.16;
    const bx0 = Math.max(x0, Math.floor(hx - r));
    const by0 = Math.max(y0, Math.floor(hy - r));
    const bx1 = Math.min(x1, Math.ceil(hx + r));
    const by1 = Math.min(y1, Math.ceil(hy + r));
    const f = this.frame;
    const W = this.width;
    for (let y = by0; y < by1; y++) {
      for (let x = bx0; x < bx1; x++) {
        const t = Math.hypot(x - hx, y - hy) / r;
        if (t >= 1) continue;
        const k = 1 - depth * (1 - t * t) * (1 - t * t);
        const o = (y * W + x) * 4;
        f[o] *= k;
        f[o + 1] *= k;
        f[o + 2] *= k;
      }
    }
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
