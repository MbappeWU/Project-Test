// The sand layer on the light table: a density per pixel (0 = clear glass, ~1 = opaque).
// Brush operations are local and mark a dirty rectangle so the compositor only redraws what changed.

export function falloff(t, hard) {
  if (t <= hard) return 1;
  if (t >= 1) return 0;
  const s = (t - hard) / (1 - hard);
  return 1 - s * s * (3 - 2 * s);
}

// Integral of the falloff across a brush diameter, in radius units; used to make
// stroke darkness independent of stamp spacing.
export const crossSection = (hard) => 1 + hard;

export class SandField {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Float32Array(w * h);
    this.dirty = null;
  }

  touch(x0, y0, x1, y1) {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(this.w, Math.ceil(x1));
    y1 = Math.min(this.h, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    const r = this.dirty;
    if (!r) this.dirty = [x0, y0, x1, y1];
    else {
      if (x0 < r[0]) r[0] = x0;
      if (y0 < r[1]) r[1] = y0;
      if (x1 > r[2]) r[2] = x1;
      if (y1 > r[3]) r[3] = y1;
    }
  }

  takeDirty() {
    const r = this.dirty;
    this.dirty = null;
    return r;
  }

  fill(v) {
    this.d.fill(v);
    this.touch(0, 0, this.w, this.h);
  }

  // Adds sand with a soft round brush; `amount` is the density added at the centre.
  deposit(cx, cy, r, amount, hard = 0.3) {
    const { w, h, d } = this;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    const r2 = r * r;
    const inv = 1 / r;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const dy2 = dy * dy;
      if (dy2 > r2) continue;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const q = dx * dx + dy2;
        if (q >= r2) continue;
        d[row + x] += amount * falloff(Math.sqrt(q) * inv, hard);
      }
    }
    this.touch(x0, y0, x1 + 1, y1 + 1);
  }

  // Removes a fraction k of the sand under the brush; a share `rim` of what was removed
  // piles up in a ring just outside, like the ridge a fingertip leaves.
  carve(cx, cy, r, k, rim = 0.3, hard = 0.45) {
    const { w, h, d } = this;
    const R = rim > 0 ? r * 1.6 : r;
    const x0 = Math.max(0, Math.floor(cx - R));
    const x1 = Math.min(w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R));
    const y1 = Math.min(h - 1, Math.ceil(cy + R));
    if (x1 < x0 || y1 < y0) return;
    const inv = 1 / r;
    const R2 = R * R;
    let removed = 0;
    let ringSum = 0;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const q = dx * dx + dy * dy;
        if (q >= R2) continue;
        const t = Math.sqrt(q) * inv;
        if (t < 1) {
          const i = row + x;
          const take = d[i] * k * falloff(t, hard);
          d[i] -= take;
          removed += take;
        } else {
          ringSum += Math.sin(((t - 1) / 0.6) * Math.PI);
        }
      }
    }
    if (rim > 0 && removed > 0 && ringSum > 0) {
      const scale = (removed * rim) / ringSum;
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - cy;
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const q = dx * dx + dy * dy;
          if (q >= R2) continue;
          const t = Math.sqrt(q) * inv;
          if (t >= 1) d[row + x] += scale * Math.sin(((t - 1) / 0.6) * Math.PI);
        }
      }
    }
    this.touch(x0, y0, x1 + 1, y1 + 1);
  }

  // Moves density toward a target (number or fn(x, y)) with rate k. (nx, ny) is the brush
  // normal; `streak` (Float32Array, 1024 entries) varies across the palm so sweeping gestures
  // leave finger streaks along the direction of motion. In 'rate' mode the streaks modulate how
  // much old sand is moved (a dissolving transition); in 'target' mode they only texture the new
  // layer, so laying a fresh base leaves no stripes of the previous picture behind.
  relax(cx, cy, r, target, k, nx = 0, ny = 1, streak = null, streakPhase = 0, hard = 0.2, streakMode = 'rate') {
    const { w, h, d } = this;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    const r2 = r * r;
    const inv = 1 / r;
    const fn = typeof target === 'function';
    const byTarget = streakMode === 'target';
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const dy2 = dy * dy;
      if (dy2 > r2) continue;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const q = dx * dx + dy2;
        if (q >= r2) continue;
        let a = k * falloff(Math.sqrt(q) * inv, hard);
        let T = fn ? target(x, y) : target;
        if (streak) {
          const m = streak[((dx * nx + dy * ny + streakPhase) | 0) & 1023];
          if (byTarget) T *= 0.88 + 0.12 * m;
          else a *= m;
        }
        const i = row + x;
        d[i] += (T - d[i]) * a;
      }
    }
    this.touch(x0, y0, x1 + 1, y1 + 1);
  }

  // Scatters individual grains around a point (gaussian spread).
  grains(cx, cy, spread, count, amount, rng) {
    const { w, h, d } = this;
    for (let n = 0; n < count; n++) {
      const x = Math.floor(cx + rng.gauss(0, spread));
      const y = Math.floor(cy + rng.gauss(0, spread));
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      d[y * w + x] += amount * rng.float(0.4, 1.4);
      this.touch(x, y, x + 1, y + 1);
    }
  }
}

// A repeating 1D pattern of finger streaks, values in [1 - depth, 1].
export function streakPattern(noise, depth = 0.55, scale = 0.09, seed = 0) {
  const p = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    // Wrap the noise so the pattern tiles.
    const a = noise.fbm1(seed + i * scale, 3);
    const b = noise.fbm1(seed + (i - 1024) * scale, 3);
    const t = i / 1024;
    const v = a * (1 - t) + b * t;
    p[i] = 1 - depth * (0.5 + 0.5 * Math.tanh(v * 2.2));
  }
  return p;
}
