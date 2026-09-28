// Stereo Freeverb-style hall (Jezar's topology): 8 lowpass-feedback combs + 4 allpasses per
// channel, right channel spread by 23 samples, delays scaled from the 44.1 kHz originals.
// Mono send in, stereo wet out, with a short pre-delay and a warm band-limited input.

import { TAU, nextPow2 } from './dsp.js';

const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING = [556, 441, 341, 225];
const STEREO_SPREAD = 23;
const FIXED_GAIN = 0.015;
const ALLPASS_FEEDBACK = 0.5;
// Constant offset in the input keeps every recursive state far from denormal range;
// it is pure DC and is removed by the master high-pass.
const ANTI_DENORMAL = 1e-18;

class Comb {
  constructor(len) {
    this.buf = new Float32Array(len);
    this.idx = 0;
    this.store = 0;
  }

  // Adds the comb output to `out`.
  process(input, out, n, feedback, damp1, damp2) {
    const buf = this.buf;
    const len = buf.length;
    let idx = this.idx;
    let store = this.store;
    for (let i = 0; i < n; i++) {
      const y = buf[idx];
      store = y * damp2 + store * damp1;
      buf[idx] = input[i] + store * feedback;
      if (++idx === len) idx = 0;
      out[i] += y;
    }
    this.idx = idx;
    this.store = store;
  }
}

class Allpass {
  constructor(len) {
    this.buf = new Float32Array(len);
    this.idx = 0;
  }

  process(io, n) {
    const buf = this.buf;
    const len = buf.length;
    let idx = this.idx;
    for (let i = 0; i < n; i++) {
      const b = buf[idx];
      const x = io[i];
      io[i] = b - x;
      buf[idx] = x + b * ALLPASS_FEEDBACK;
      if (++idx === len) idx = 0;
    }
    this.idx = idx;
  }
}

export class Reverb {
  constructor(sr, { room = 0.85, damp = 0.4, width = 1, predelay = 0.02, maxBlock = 256 } = {}) {
    const scale = sr / 44100;
    const len = (t) => Math.max(1, Math.round(t * scale));
    this.combsL = COMB_TUNING.map((t) => new Comb(len(t)));
    this.combsR = COMB_TUNING.map((t) => new Comb(len(t + STEREO_SPREAD)));
    this.apL = ALLPASS_TUNING.map((t) => new Allpass(len(t)));
    this.apR = ALLPASS_TUNING.map((t) => new Allpass(len(t + STEREO_SPREAD)));
    this.feedback = room * 0.28 + 0.7;
    this.damp1 = damp * 0.4;
    this.damp2 = 1 - this.damp1;
    this.wet1 = width / 2 + 0.5;
    this.wet2 = (1 - width) / 2;

    const preLen = Math.max(1, Math.round(predelay * sr));
    this.pre = new Float64Array(nextPow2(preLen + 1));
    this.preMask = this.pre.length - 1;
    this.preLen = preLen;
    this.preIdx = 0;
    // Input conditioning: one-pole high-pass ~140 Hz (no muddy low end in the hall) and
    // one-pole low-pass ~6.5 kHz (warmth).
    this.hpCoef = 1 - Math.exp((-TAU * 140) / sr);
    this.lpCoef = 1 - Math.exp((-TAU * 6500) / sr);
    this.hpState = 0;
    this.lpState = 0;

    this.inBuf = new Float64Array(maxBlock);
    this.tmpL = new Float64Array(maxBlock);
    this.tmpR = new Float64Array(maxBlock);
  }

  // input: mono send (n samples). Writes the wet signal into outL/outR (overwrites).
  process(input, outL, outR, n) {
    const inBuf = this.inBuf;
    const pre = this.pre;
    const mask = this.preMask;
    let pi = this.preIdx;
    let hp = this.hpState;
    let lp = this.lpState;
    const hpC = this.hpCoef;
    const lpC = this.lpCoef;
    for (let i = 0; i < n; i++) {
      pre[pi] = input[i];
      const x = pre[(pi - this.preLen) & mask];
      pi = (pi + 1) & mask;
      hp += (x - hp) * hpC;
      lp += (x - hp - lp) * lpC;
      inBuf[i] = lp * FIXED_GAIN + ANTI_DENORMAL;
    }
    this.preIdx = pi;
    this.hpState = hp;
    this.lpState = lp;

    const tmpL = this.tmpL;
    const tmpR = this.tmpR;
    tmpL.fill(0, 0, n);
    tmpR.fill(0, 0, n);
    const fb = this.feedback;
    const d1 = this.damp1;
    const d2 = this.damp2;
    for (let c = 0; c < 8; c++) {
      this.combsL[c].process(inBuf, tmpL, n, fb, d1, d2);
      this.combsR[c].process(inBuf, tmpR, n, fb, d1, d2);
    }
    for (let a = 0; a < 4; a++) {
      this.apL[a].process(tmpL, n);
      this.apR[a].process(tmpR, n);
    }
    const w1 = this.wet1;
    const w2 = this.wet2;
    for (let i = 0; i < n; i++) {
      const l = tmpL[i];
      const r = tmpR[i];
      outL[i] = l * w1 + r * w2;
      outR[i] = r * w1 + l * w2;
    }
  }
}
