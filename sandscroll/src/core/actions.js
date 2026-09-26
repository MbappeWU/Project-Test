import { measure, pointAt, smoothstep } from './geom.js';
import { crossSection } from './field.js';
import { Rng } from './rng.js';

// Actions are the artist's gestures. Each has a duration (seconds) and applies its effect
// incrementally in step(stage, p0, p1) as progress moves from p0 to p1. Effects depend only on
// progress, never on frame timing, so the finished picture is identical at any frame rate.
// Actions report where the hand is via stage.setHand(), which also drives the sand-rustle audio.

let actionSeed = 1;

// Gestures draw their grain and jitter from a per-scene sequence so that a given show seed
// always produces the same performance, however many scenes ran before it in the process.
export function seedActions(seed) {
  actionSeed = seed >>> 0 || 1;
}

// Speed profile: ease in and out, constant velocity in the middle.
function travel(p, ramp = 0.12) {
  const v = 1 / (1 - ramp);
  if (p < ramp) return (v * p * p) / (2 * ramp);
  if (p > 1 - ramp) {
    const q = 1 - p;
    return 1 - (v * q * q) / (2 * ramp);
  }
  return v * (p - ramp / 2);
}

// Calligraphic pressure: thin entry, full body, lifted exit.
export const taperBoth = (u) => 0.3 + 0.7 * smoothstep(0, 0.14, u) * smoothstep(1, 0.8, u);
export const taperEnd = (u) => 0.25 + 0.75 * smoothstep(1, 0.7, u);
export const taperStart = (u) => 0.25 + 0.75 * smoothstep(0, 0.3, u);
export const even = () => 1;

// A gesture along a path: 'pour' trickles dark sand, 'carve' draws light with a fingertip,
// 'relax' drags the palm and moves density toward a target level.
export function stroke(kind, pts, opts = {}) {
  const {
    width = 10,
    speed = kind === 'relax' ? 700 : 320,
    amount = 0.9,
    strength = 0.92,
    rim = kind === 'carve' ? 0.3 : 0,
    target = 0,
    rate = 0.6,
    streak = null,
    streakMode = 'rate',
    hard = kind === 'pour' ? 0.25 : kind === 'carve' ? 0.45 : 0.15,
    taper = kind === 'relax' ? even : taperBoth,
    scatter = kind === 'pour' ? 0.35 : 0,
    rest = 0.22,
    seed = actionSeed++,
  } = opts;
  const vlen = measure(pts).length;
  const move = Math.max(0.15, vlen / speed);
  const duration = move + rest;
  const frac = move / duration;
  let m = null;
  let r = 0;
  let spacing = 1;
  let next = 0;
  let rng = null;
  let hand = null;
  const c = crossSection(hard);
  return {
    kind,
    duration,
    begin(stage) {
      const s = stage.s;
      m = measure(pts.map(([x, y]) => [x * s, y * s]));
      r = Math.max(0.6, (width * s) / 2);
      spacing = Math.max(0.5, r * 0.22);
      rng = new Rng(seed);
    },
    step(stage, p0, p1) {
      const f = stage.field;
      const sEnd = m.length * travel(Math.min(1, p1 / frac));
      while (next <= sEnd + 1e-9) {
        const [x, y, tx, ty] = pointAt(m, next);
        const u = m.length > 0 ? next / m.length : 1;
        const rr = Math.max(0.5, r * taper(u));
        if (kind === 'pour') {
          f.deposit(x, y, rr, (amount * spacing) / (rr * c), hard);
          if (scatter > 0 && rng.chance(Math.min(1, scatter * spacing))) {
            f.grains(x, y, rr * 1.2, 2, amount * 0.5, rng);
          }
        } else if (kind === 'carve') {
          const k = 1 - Math.pow(1 - strength, spacing / (rr * c));
          f.carve(x, y, rr, k, rim, hard);
        } else {
          const k = 1 - Math.pow(1 - rate, spacing / (rr * c));
          f.relax(x, y, rr, target, k, -ty, tx, streak, seed * 13, hard, streakMode);
        }
        hand = [x / stage.s, y / stage.s];
        if (m.length === 0) {
          next = Infinity;
          break;
        }
        next += spacing;
      }
      if (p1 < frac) stage.setHand(hand, kind);
    },
  };
}

export const pour = (pts, opts) => stroke('pour', pts, opts);
export const carve = (pts, opts) => stroke('carve', pts, opts);
export const palm = (pts, opts) => stroke('relax', pts, opts);

// Reveals a mask progressively in a chosen order, applying `op` to each cell once:
//   set:   d = lerp(d, level(x, y), a)
//   add:   d += amount(x, y) * a
//   carve: d *= 1 - strength * a
// `order` is a preset name or fn(x, y) -> sort key in field coords; `jitter` roughens the front.
export function reveal(buildMask, opts = {}) {
  const { op = 'set', level = 1, amount = 0.8, strength = 0.95, duration = 6, order = 'left', jitter = 0.04, rest = 0.3, seed = actionSeed++ } = opts;
  let idx = null;
  let alpha = null;
  let done = 0;
  let cx = 0;
  let cy = 0;
  const frac = duration / (duration + rest);
  return {
    kind: 'reveal',
    duration: duration + rest,
    begin(stage) {
      const mask = typeof buildMask === 'function' ? buildMask(stage) : buildMask;
      const keyFn = typeof order === 'function' ? order : orderFn(order, mask);
      const rng = new Rng(seed);
      const { w, h, a, x0, y0 } = mask;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] > 0.003) n++;
      const cells = new Int32Array(n);
      const keys = new Float64Array(n);
      const noise = stage.noise;
      const fs = 0.03 / stage.s;
      let k = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const li = y * w + x;
          if (a[li] <= 0.003) continue;
          const X = x + x0;
          const Y = y + y0;
          cells[k] = li;
          keys[k] = keyFn(X, Y) + jitter * (noise.n2(X * fs + seed, Y * fs) + 0.35 * rng.float(-1, 1));
          k++;
        }
      }
      const ord = new Uint32Array(n);
      for (let i = 0; i < n; i++) ord[i] = i;
      ord.sort((p, q) => keys[p] - keys[q]);
      idx = new Int32Array(n);
      alpha = new Float32Array(n);
      const W = stage.field.w;
      for (let i = 0; i < n; i++) {
        const li = cells[ord[i]];
        idx[i] = (((li / w) | 0) + y0) * W + (li % w) + x0;
        alpha[i] = a[li];
      }
    },
    step(stage, p0, p1) {
      const n = idx.length;
      const target = Math.min(n, Math.floor(Math.min(1, p1 / frac) * n));
      if (target > done) {
        const d = stage.field.d;
        const W = stage.field.w;
        const lv = typeof level === 'function' ? level : null;
        const am = typeof amount === 'function' ? amount : null;
        let sx = 0;
        let sy = 0;
        let bx0 = Infinity;
        let by0 = Infinity;
        let bx1 = -Infinity;
        let by1 = -Infinity;
        for (let i = done; i < target; i++) {
          const j = idx[i];
          const a = alpha[i];
          const x = j % W;
          const y = (j / W) | 0;
          if (op === 'set') {
            // A NaN from a scene's level/amount function would stick in the field for good.
            const T = lv ? lv(x, y) : level;
            if (Number.isFinite(T)) d[j] += (T - d[j]) * a;
          } else if (op === 'add') {
            const v = am ? am(x, y) : amount;
            if (Number.isFinite(v)) d[j] += v * a;
          } else {
            d[j] *= 1 - strength * a;
          }
          sx += x;
          sy += y;
          if (x < bx0) bx0 = x;
          if (y < by0) by0 = y;
          if (x > bx1) bx1 = x;
          if (y > by1) by1 = y;
        }
        const count = target - done;
        cx = sx / count / stage.s;
        cy = sy / count / stage.s;
        stage.field.touch(bx0, by0, bx1 + 1, by1 + 1);
        done = target;
      }
      if (p1 < frac && n > 0) stage.setHand([cx, cy], op === 'carve' ? 'carve' : 'fill');
    },
  };
}

function orderFn(name, mask) {
  const { x0, y0, w, h } = mask;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const span = Math.max(w, h) || 1;
  const W = w || 1;
  const H = h || 1;
  switch (name) {
    case 'left':
      return (x) => (x - x0) / W;
    case 'right':
      return (x) => 1 - (x - x0) / W;
    case 'down':
      return (x, y) => (y - y0) / H;
    case 'up':
      return (x, y) => 1 - (y - y0) / H;
    case 'out':
      return (x, y) => Math.hypot(x - cx, y - cy) / span;
    case 'in':
      return (x, y) => 1 - Math.hypot(x - cx, y - cy) / span;
    case 'spiral':
      return (x, y) => {
        const r = Math.hypot(x - cx, y - cy) / (span / 2);
        const a = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
        return r * 0.85 + a * 0.15;
      };
    case 'diag':
      return (x, y) => ((x - x0) / W + (y - y0) / H) / 2;
    case 'diag2':
      return (x, y) => (1 - (x - x0) / W + (y - y0) / H) / 2;
    default:
      return () => 0;
  }
}

export function wait(seconds) {
  return { kind: 'wait', duration: seconds, step() {} };
}

// Runs an instantaneous callback (music cue, overlay, palette change...).
export function call(fn) {
  return { kind: 'call', duration: 0, step(stage) { fn(stage); } };
}

