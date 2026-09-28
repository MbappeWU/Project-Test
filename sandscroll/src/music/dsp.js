// Small DSP toolkit for the SandScroll music engine.
// Pure ES module with no platform APIs, so it runs unchanged in Node and browsers.

export const TAU = 2 * Math.PI;

// Control-rate period in samples. Envelopes, pitch curves, voice bookkeeping and composer
// scheduling all run on absolute multiples of this, so output never depends on host block size.
export const CONTROL = 64;

export const SINE_SIZE = 4096;
export const SINE = new Float64Array(SINE_SIZE + 1);
for (let i = 0; i <= SINE_SIZE; i++) SINE[i] = Math.sin((TAU * i) / SINE_SIZE);

export const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep(t) {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Piecewise-linear interpolation over log2(x) through sorted [x, y] points.
export function logInterp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return lerp(y0, y1, Math.log2(x / x0) / Math.log2(x1 / x0));
    }
  }
  return last[1];
}

// Equal-power pan: pan in [-1, 1] -> [gainL, gainR].
export function panGains(pan) {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

// Coefficient c for y += (x - y) * c with time constant `seconds`.
export const smoothCoef = (seconds, sr) => 1 - Math.exp(-1 / Math.max(1e-9, seconds * sr));

// Linear below `knee`, then a tanh shoulder that approaches but never exceeds `ceiling`.
export function softClip(x, knee, ceiling) {
  const ax = x < 0 ? -x : x;
  if (ax <= knee) return x;
  const range = ceiling - knee;
  const y = knee + range * Math.tanh((ax - knee) / range);
  return x < 0 ? -y : y;
}

// RBJ-cookbook biquad in transposed direct form II.
export class Biquad {
  constructor() {
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.z1 = 0;
    this.z2 = 0;
  }

  setCoefs(b0, b1, b2, a0, a1, a2) {
    const inv = 1 / a0;
    this.b0 = b0 * inv;
    this.b1 = b1 * inv;
    this.b2 = b2 * inv;
    this.a1 = a1 * inv;
    this.a2 = a2 * inv;
    return this;
  }

  lowpass(sr, freq, q = Math.SQRT1_2) {
    const w = (TAU * freq) / sr;
    const c = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    return this.setCoefs((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha);
  }

  highpass(sr, freq, q = Math.SQRT1_2) {
    const w = (TAU * freq) / sr;
    const c = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    return this.setCoefs((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha);
  }

  // Constant 0 dB peak gain.
  bandpass(sr, freq, q) {
    const w = (TAU * freq) / sr;
    const c = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    return this.setCoefs(alpha, 0, -alpha, 1 + alpha, -2 * c, 1 - alpha);
  }

  peaking(sr, freq, q, db) {
    const A = Math.pow(10, db / 40);
    const w = (TAU * freq) / sr;
    const c = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    return this.setCoefs(1 + alpha * A, -2 * c, 1 - alpha * A, 1 + alpha / A, -2 * c, 1 - alpha / A);
  }

  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  // Zero vanishing state so silent passages never fall into slow denormal arithmetic.
  flush() {
    if (Math.abs(this.z1) < 1e-20) this.z1 = 0;
    if (Math.abs(this.z2) < 1e-20) this.z2 = 0;
  }
}

// Topology-preserving state-variable filter (Simper/Zavalishin); stable under fast retuning.
export class Svf {
  constructor() {
    this.ic1 = 0;
    this.ic2 = 0;
    this.a1 = 1;
    this.a2 = 0;
    this.a3 = 0;
    this.k = 1;
  }

  set(sr, freq, q) {
    const g = Math.tan((Math.PI * Math.min(freq, sr * 0.45)) / sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
    return this;
  }

  // Band-pass normalised to 0 dB at the centre frequency.
  bandpass(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return this.k * v1;
  }

  flush() {
    if (Math.abs(this.ic1) < 1e-20) this.ic1 = 0;
    if (Math.abs(this.ic2) < 1e-20) this.ic2 = 0;
  }
}

// Stereo-linked peak compressor for taming pluck transients: fast attack, short release,
// gain = (threshold / envelope)^(1 - 1/ratio) above threshold.
export class PeakCompressor {
  constructor(sr, { threshold = 0.2, ratio = 2, attack = 0.0005, release = 0.07 } = {}) {
    this.threshold = threshold;
    this.exponent = 1 - 1 / ratio;
    this.att = 1 - Math.exp(-1 / (attack * sr));
    this.rel = 1 - Math.exp(-1 / (release * sr));
    this.env = 0;
  }

  process(L, R, n) {
    const thr = this.threshold;
    const ex = this.exponent;
    const att = this.att;
    const rel = this.rel;
    let env = this.env;
    for (let i = 0; i < n; i++) {
      const l = L[i];
      const r = R[i];
      const al = l < 0 ? -l : l;
      const ar = r < 0 ? -r : r;
      const pk = al > ar ? al : ar;
      env += (pk - env) * (pk > env ? att : rel);
      if (env > thr) {
        const g = Math.pow(thr / env, ex);
        L[i] = l * g;
        R[i] = r * g;
      }
    }
    this.env = env < 1e-12 ? 0 : env;
  }
}

// Look-ahead peak limiter: the signal is delayed by `lookahead` so gain reduction is already in
// place when a peak arrives (no overshoot, no clipping of transients).
export class LookaheadLimiter {
  constructor(sr, { threshold = 0.7, lookahead = 0.0015, release = 0.08 } = {}) {
    this.threshold = threshold;
    this.la = Math.max(1, Math.round(lookahead * sr));
    const size = nextPow2(this.la + 1);
    this.dl = new Float64Array(size);
    this.dr = new Float64Array(size);
    this.mask = size - 1;
    this.w = 0;
    this.held = 1;
    this.hold = 0;
    this.gain = 1;
    this.minGain = 1; // lowest gain reached (for metering)
    this.att = 1 - Math.exp(-4 / this.la);
    this.rel = 1 - Math.exp(-1 / (release * sr));
  }

  // Processes in place.
  process(L, R, n) {
    const { dl, dr, mask, la, threshold: thr, att, rel } = this;
    let { w, held, hold, gain } = this;
    for (let i = 0; i < n; i++) {
      const l = L[i];
      const r = R[i];
      dl[w] = l;
      dr[w] = r;
      const al = l < 0 ? -l : l;
      const ar = r < 0 ? -r : r;
      const pk = al > ar ? al : ar;
      const target = pk > thr ? thr / pk : 1;
      if (target <= held) {
        held = target;
        hold = la;
      } else if (hold > 0) {
        hold--;
      } else {
        held = target;
      }
      gain += (held - gain) * (held < gain ? att : rel);
      const ri = (w - la) & mask;
      L[i] = dl[ri] * gain;
      R[i] = dr[ri] * gain;
      w = (w + 1) & mask;
    }
    this.w = w;
    this.held = held;
    this.hold = hold;
    this.gain = gain;
    if (gain < this.minGain) this.minGain = gain;
  }
}
