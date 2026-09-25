import { smoothstep } from './geom.js';

// A coverage mask over a rectangular window of the sand field (field pixel coordinates).
export class Mask {
  constructor(x0, y0, w, h) {
    this.x0 = x0;
    this.y0 = y0;
    this.w = Math.max(0, w);
    this.h = Math.max(0, h);
    this.a = new Float32Array(this.w * this.h);
  }

  get x1() {
    return this.x0 + this.w;
  }

  get y1() {
    return this.y0 + this.h;
  }

  at(x, y) {
    const lx = x - this.x0;
    const ly = y - this.y0;
    if (lx < 0 || ly < 0 || lx >= this.w || ly >= this.h) return 0;
    return this.a[ly * this.w + lx];
  }

  map(fn) {
    const { w, h, a, x0, y0 } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (a[i] > 0) a[i] = fn(a[i], x + x0, y + y0);
      }
    }
    return this;
  }
}

// Rasterizes polygons (field pixel coords) with 4x vertical supersampling and exact horizontal coverage.
export function polygonMask(polys, W, H, { sub = 4, rule = 'nonzero' } = {}) {
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  const edges = [];
  for (const poly of polys) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const [xa, ya] = poly[i];
      const [xb, yb] = poly[(i + 1) % n];
      if (xa < bx0) bx0 = xa;
      if (xa > bx1) bx1 = xa;
      if (ya < by0) by0 = ya;
      if (ya > by1) by1 = ya;
      if (ya === yb) continue;
      const dir = yb > ya ? 1 : -1;
      const top = dir > 0 ? [xa, ya] : [xb, yb];
      const bot = dir > 0 ? [xb, yb] : [xa, ya];
      edges.push({ y0: top[1], y1: bot[1], x0: top[0], slope: (bot[0] - top[0]) / (bot[1] - top[1]), dir });
    }
  }
  const x0 = Math.max(0, Math.floor(bx0));
  const y0 = Math.max(0, Math.floor(by0));
  const x1 = Math.min(W, Math.ceil(bx1) + 1);
  const y1 = Math.min(H, Math.ceil(by1) + 1);
  // Shapes wholly off the table (random layouts can place them there) yield an empty mask.
  if (x1 <= x0 || y1 <= y0) return new Mask(0, 0, 0, 0);
  const mask = new Mask(x0, y0, x1 - x0, y1 - y0);
  edges.sort((e1, e2) => e1.y0 - e2.y0);
  const inv = 1 / sub;
  const xs = [];
  for (let py = y0; py < y1; py++) {
    const row = (py - y0) * mask.w;
    for (let k = 0; k < sub; k++) {
      const ys = py + (k + 0.5) * inv;
      xs.length = 0;
      for (const e of edges) {
        if (e.y0 > ys) break;
        if (ys >= e.y1) continue;
        xs.push([e.x0 + (ys - e.y0) * e.slope, e.dir]);
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p[0] - q[0]);
      let wind = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        wind = rule === 'evenodd' ? wind ^ 1 : wind + xs[i][1];
        if (wind === 0) continue;
        spanCover(mask.a, row, x0, mask.w, xs[i][0], xs[i + 1][0], inv);
      }
    }
  }
  for (let i = 0; i < mask.a.length; i++) if (mask.a[i] > 1) mask.a[i] = 1;
  return mask;
}

function spanCover(a, row, x0, w, xa, xb, weight) {
  let sa = xa - x0;
  let sb = xb - x0;
  if (sb <= 0 || sa >= w) return;
  if (sa < 0) sa = 0;
  if (sb > w) sb = w;
  const ia = Math.floor(sa);
  const ib = Math.floor(sb);
  if (ia === ib) {
    a[row + ia] += (sb - sa) * weight;
    return;
  }
  a[row + ia] += (ia + 1 - sa) * weight;
  for (let x = ia + 1; x < ib; x++) a[row + x] += weight;
  if (ib < w) a[row + ib] += (sb - ib) * weight;
}

// Returns a new mask grown by r and blurred with two box passes (approximately a tent filter).
export function feather(mask, r, W, H) {
  if (mask.w === 0 || mask.h === 0) return mask;
  r = Math.max(1, Math.round(r));
  const pad = r * 2;
  const nx0 = Math.max(0, mask.x0 - pad);
  const ny0 = Math.max(0, mask.y0 - pad);
  const nx1 = Math.min(W, mask.x1 + pad);
  const ny1 = Math.min(H, mask.y1 + pad);
  const out = new Mask(nx0, ny0, nx1 - nx0, ny1 - ny0);
  for (let y = 0; y < mask.h; y++) {
    const src = y * mask.w;
    const dst = (y + mask.y0 - ny0) * out.w + (mask.x0 - nx0);
    out.a.set(mask.a.subarray(src, src + mask.w), dst);
  }
  const tmp = new Float32Array(out.a.length);
  for (let pass = 0; pass < 2; pass++) {
    boxH(out.a, tmp, out.w, out.h, r);
    boxV(tmp, out.a, out.w, out.h, r);
  }
  return out;
}

function boxH(src, dst, w, h, r) {
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += x >= 0 && x < w ? src[row + x] : 0;
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * norm;
      const add = x + r + 1;
      const sub = x - r;
      if (add < w) acc += src[row + add];
      if (sub >= 0) acc -= src[row + sub];
    }
  }
}

function boxV(src, dst, w, h, r) {
  const norm = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += y >= 0 && y < h ? src[y * w + x] : 0;
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * norm;
      const add = y + r + 1;
      const sub = y - r;
      if (add < h) acc += src[add * w + x];
      if (sub >= 0) acc -= src[sub * w + x];
    }
  }
}

// Organic, grainy edge: re-thresholds a feathered mask around 0.5 with noise displacement.
export function roughen(mask, noise, { scale = 0.08, amount = 0.25, soft = 0.18, seed = 0 } = {}) {
  const lo = 0.5 - soft;
  const hi = 0.5 + soft;
  return mask.map((v, x, y) => {
    const n = noise.fbm2(seed + x * scale, y * scale, 3);
    return smoothstep(lo, hi, v + amount * n);
  });
}

// Converts an 8-bit alpha image placed at (ox, oy) into a Mask.
export function alphaMask(alpha, w, h, ox, oy, W, H) {
  const x0 = Math.max(0, ox);
  const y0 = Math.max(0, oy);
  const x1 = Math.min(W, ox + w);
  const y1 = Math.min(H, oy + h);
  if (x1 <= x0 || y1 <= y0) return new Mask(0, 0, 0, 0);
  const mask = new Mask(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      mask.a[(y - y0) * mask.w + (x - x0)] = alpha[(y - oy) * w + (x - ox)] / 255;
    }
  }
  return mask;
}
