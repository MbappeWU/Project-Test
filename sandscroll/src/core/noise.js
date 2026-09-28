import { Rng } from './rng.js';

// Seeded Perlin-style gradient noise (1D and 2D) plus fractal sums.
// Output range is roughly [-1, 1].
export class Noise {
  constructor(seed = 1) {
    const rng = new Rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.g1 = new Float32Array(256);
    this.gx = new Float32Array(256);
    this.gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      this.g1[i] = rng.float(-1, 1);
      const a = rng.float(0, Math.PI * 2);
      this.gx[i] = Math.cos(a);
      this.gy[i] = Math.sin(a);
    }
  }

  n1(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const i0 = this.perm[xi & 255];
    const i1 = this.perm[(xi + 1) & 255];
    const a = this.g1[i0] * xf;
    const b = this.g1[i1] * (xf - 1);
    return 2 * (a + fade(xf) * (b - a));
  }

  n2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const perm = this.perm;
    const X = xi & 255;
    const Y = yi & 255;
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const d00 = this.gx[aa] * xf + this.gy[aa] * yf;
    const d10 = this.gx[ba] * (xf - 1) + this.gy[ba] * yf;
    const d01 = this.gx[ab] * xf + this.gy[ab] * (yf - 1);
    const d11 = this.gx[bb] * (xf - 1) + this.gy[bb] * (yf - 1);
    const u = fade(xf);
    const v = fade(yf);
    const x0 = d00 + u * (d10 - d00);
    const x1 = d01 + u * (d11 - d01);
    return 1.41 * (x0 + v * (x1 - x0));
  }

  fbm1(x, octaves = 4, gain = 0.5) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.n1(x);
      norm += amp;
      amp *= gain;
      x *= 2.03;
    }
    return sum / norm;
  }

  fbm2(x, y, octaves = 4, gain = 0.5) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.n2(x, y);
      norm += amp;
      amp *= gain;
      x *= 2.03;
      y *= 2.03;
    }
    return sum / norm;
  }
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
