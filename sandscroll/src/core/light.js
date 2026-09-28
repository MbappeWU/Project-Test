import { Noise } from './noise.js';
import { Rng } from './rng.js';

// Light-table look: warm lamp under glass, sand transmits light following Beer-Lambert
// with stronger blue absorption (thin sand glows amber, thick sand turns umber-black).
export const PALETTES = {
  amber: {
    lamp: [1.0, 0.8, 0.5],
    absorb: [1.35, 2.25, 3.9],
    top: [0.026, 0.015, 0.009],
    falloff: [0.8, 1.05, 1.5],
  },
};

const LUT_SIZE = 4096;
const LUT_MAX = 7;
const SRGB_SIZE = 4096;

export class LightTable {
  constructor(w, h, { seed = 7, palette = 'amber', vignette = 0.5, grain = 0.26 } = {}) {
    this.w = w;
    this.h = h;
    this.vignette = vignette;
    this.grainSigma = grain;
    this.noise = new Noise(seed);
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.falloffMap = new Float32Array(w * h);
    this.grain = new Float32Array(w * h);
    this.lampR = new Float32Array(w * h);
    this.lampG = new Float32Array(w * h);
    this.lampB = new Float32Array(w * h);
    this.tR = new Float32Array(LUT_SIZE);
    this.tG = new Float32Array(LUT_SIZE);
    this.tB = new Float32Array(LUT_SIZE);
    this.srgb = new Uint8Array(SRGB_SIZE);
    for (let i = 0; i < SRGB_SIZE; i++) {
      const v = i / (SRGB_SIZE - 1);
      const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      this.srgb[i] = Math.round(Math.min(1, s) * 255);
    }
    this.buildFalloff();
    this.buildGrain();
    this.setPalette(palette);
  }

  // The lamp's pool of light is an ellipse stretched along the table's long side.
  buildFalloff() {
    const { w, h, noise } = this;
    const half = Math.max(w, h) / 2;
    const [kx, ky] = w >= h ? [1, 1.25] : [1.25, 1];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = ((x - w / 2) / half) * kx;
        const ny = ((y - h * 0.47) / half) * ky;
        const r = Math.sqrt(nx * nx + ny * ny);
        const lamp = 1 - this.vignette * Math.pow(Math.min(1.4, r) / 1.12, 2.3);
        const uneven = 0.025 * noise.fbm2(x / w * 3.1, y / h * 3.1, 3);
        this.falloffMap[y * w + x] = Math.max(0.12, Math.min(1, lamp + uneven));
      }
    }
  }

  // Per-pixel lognormal multiplier: thin layers break up into visible grains.
  buildGrain() {
    const { grain, rng, noise, w } = this;
    const s = this.grainSigma;
    for (let i = 0; i < grain.length; i++) {
      const x = i % w;
      const y = (i / w) | 0;
      const clump = 0.12 * noise.n2(x * 0.21, y * 0.21);
      grain[i] = Math.exp(rng.gauss(0, s) + clump - (s * s) / 2);
    }
  }

  setPalette(name) {
    const p = typeof name === 'string' ? PALETTES[name] : name;
    this.palette = p;
    const [kr, kg, kb] = p.absorb;
    for (let i = 0; i < LUT_SIZE; i++) {
      const e = (i / (LUT_SIZE - 1)) * LUT_MAX;
      this.tR[i] = Math.exp(-kr * e);
      this.tG[i] = Math.exp(-kg * e);
      this.tB[i] = Math.exp(-kb * e);
    }
    const [lr, lg, lb] = p.lamp;
    const [fr, fg, fb] = p.falloff;
    const f = this.falloffMap;
    for (let i = 0; i < f.length; i++) {
      this.lampR[i] = lr * Math.pow(f[i], fr);
      this.lampG[i] = lg * Math.pow(f[i], fg);
      this.lampB[i] = lb * Math.pow(f[i], fb);
    }
  }

  // Writes RGBA bytes for the rectangle [x0, x1) x [y0, y1).
  render(field, out, x0 = 0, y0 = 0, x1 = this.w, y1 = this.h) {
    const { w, grain, lampR, lampG, lampB, tR, tG, tB, srgb } = this;
    const d = field.d;
    const [cr, cg, cb] = this.palette.top;
    const scale = (LUT_SIZE - 1) / LUT_MAX;
    const top = SRGB_SIZE - 1;
    for (let y = y0; y < y1; y++) {
      let i = y * w + x0;
      let o = i * 4;
      for (let x = x0; x < x1; x++, i++, o += 4) {
        const g = grain[i];
        let q = (d[i] * g * scale) | 0;
        if (q < 0) q = 0;
        else if (q >= LUT_SIZE) q = LUT_SIZE - 1;
        const r = tR[q];
        const gg = tG[q];
        const b = tB[q];
        const vr = lampR[i] * r + cr * g * (1 - r);
        const vg = lampG[i] * gg + cg * g * (1 - gg);
        const vb = lampB[i] * b + cb * g * (1 - b);
        out[o] = srgb[vr >= 1 ? top : (vr * top) | 0];
        out[o + 1] = srgb[vg >= 1 ? top : (vg * top) | 0];
        out[o + 2] = srgb[vb >= 1 ? top : (vb * top) | 0];
        out[o + 3] = 255;
      }
    }
  }
}
