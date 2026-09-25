// Instrument models for SandScroll: guzheng and guqin (extended Karplus-Strong), xiao
// (sine + breath), modal bells (qin harmonics, qing chime-stone, muyu) and sand rustle.
//
// Every voice follows one contract that keeps rendering block-size independent:
//   control(now, span)  called on absolute control ticks (and right after a note starts);
//                       computes targets for sample now + span and per-sample increments.
//   render(L, R, n)     pure per-sample work, n never crosses a control tick.
// Voices that need per-sample noise own a private Rng stream so segment splits cannot
// reorder random draws between voices.

import {
  CONTROL, TAU, SINE, SINE_SIZE, mtof, clamp, smoothstep, panGains, nextPow2, logInterp,
  smoothCoef, Biquad, Svf,
} from './dsp.js';

const SILENCE = 3e-5; // voice peak (≈ -90 dBFS) below which a voice is retired

// ---------------------------------------------------------------------------------------
// Configurations
// ---------------------------------------------------------------------------------------

export const ZHENG = {
  voices: 24,
  spare: 6,
  minFreq: 55,
  // Fundamental T60 by frequency: long bass strings, shorter treble.
  t60: [[70, 7.0], [150, 5.4], [300, 4.2], [600, 3.2], [1200, 2.3], [2400, 1.5]],
  t60High: 0.9, // T60 at hfRef: bright attack that mellows over a second or so
  hfRef: 4000,
  excLow: 1200, // excitation low-pass: excLow * 2^(vel * excOct)
  excOct: 2.5,
  noise: 0.6, // noise share of the burst relative to the ramp
  nail: 0.35,
  pluckPos: [0.15, 0.2],
  level: 0.2,
  velExp: 1.3,
  lowBoost: 0.3,
  dampT60: 0.25,
  friction: 0,
  pan: { center: 0.1, spread: 0.35 },
  // Shared soundboard: [freq, Q, gain] parallel resonances added to the bus.
  body: [[200, 2.2, 0.35], [450, 3, 0.25], [1300, 3.5, 0.14]],
};

export const QIN = {
  voices: 8,
  spare: 3,
  minFreq: 45,
  t60: [[55, 9.0], [110, 7.6], [220, 5.8], [440, 4.0], [880, 2.7]],
  t60High: 0.35,
  hfRef: 3000,
  excLow: 500,
  excOct: 2.2,
  noise: 0.45,
  nail: 0.1,
  pluckPos: [0.14, 0.2],
  level: 0.28,
  velExp: 1.2,
  lowBoost: 0.3,
  dampT60: 0.35,
  friction: 0.03, // finger-on-silk noise injected into the string while sliding
  pan: { center: -0.14, spread: 0.12 },
  body: [[95, 1.8, 0.55], [210, 2.2, 0.4], [520, 2.8, 0.18]],
};

export const XIAO = {
  voices: 2,
  level: 0.2,
  velExp: 1.1,
  breath: 0.16, // band-passed breath relative to tone
  chiff: 0.5, // extra breath at the attack
  hiss: 0.025, // broadband hiss relative to tone
  pan: -0.18,
};

export const HARMONIC = {
  voices: 10,
  ratios: [1, 2, 3],
  amps: [1, 0.16, 0.05],
  t60: [3.2, 2.0, 1.2],
  attack: 0.004,
  level: 0.3,
  click: 0,
  pan: [0.05, 0.3],
};

export const QING = {
  voices: 3,
  ratios: [1, 1.0016, 2.76, 5.4, 8.9],
  amps: [1, 0.55, 0.45, 0.22, 0.1],
  t60: [4.2, 3.8, 2.4, 1.2, 0.5],
  attack: 0.0025,
  level: 0.085,
  click: 0.12,
  pan: [0, 0.06],
};

export const MUYU = {
  voices: 4,
  ratios: [1, 2.43],
  amps: [1, 0.22],
  t60: [0.2, 0.09],
  attack: 0.0003,
  level: 0.14,
  click: 0.35,
  pan: [0.32, 0.1],
};

// ---------------------------------------------------------------------------------------
// Plucked strings
// ---------------------------------------------------------------------------------------

// One-pole loop filter H(z) = g(1-p)/(1-p z^-1) meeting a fundamental T60 and a T60 at fRef
// (after Jaffe & Smith / Välimäki): solve |H(w1)|/|H(w0)| = R for p, then g for the fundamental.
function designLoop(sr, f0, t60Low, t60High, fRef) {
  const g0 = Math.pow(10, -3 / (f0 * t60Low));
  const g1 = Math.pow(10, -3 / (f0 * Math.min(t60High, t60Low * 0.95)));
  const r2 = (g1 / g0) ** 2;
  const c0 = Math.cos((TAU * f0) / sr);
  const c1 = Math.cos((TAU * fRef) / sr);
  const a = r2 - 1;
  const b = 2 * (c0 - r2 * c1);
  const disc = b * b - 4 * a * a;
  let p = a < -1e-12 && disc >= 0 ? (-b + Math.sqrt(disc)) / (2 * a) : 0.05;
  p = clamp(p, 0.01, 0.9);
  const mag0 = (1 - p) / Math.sqrt(1 - 2 * p * c0 + p * p);
  return { p, g: Math.min(0.99995, g0 / mag0) };
}

class StringVoice {
  constructor(size, rng) {
    this.buf = new Float64Array(size);
    this.mask = size - 1;
    this.exc = new Float64Array(size);
    this.scratch = new Float64Array(size);
    this.inj = new Float64Array(CONTROL);
    this.rng = rng;
    this.active = false;
    this.fading = false;
    this.onset = 0;
    this.midi = 0;
    this.w = 0;
    this.D = 100;
    this.dD = 0;
    this.lp = 0;
    this.p = 0.2;
    this.g = 0.99;
    this.dg = 0;
    this.gBase = 0.99;
    this.gDamp = 0.9;
    this.amp = 1;
    this.dAmp = 0;
    this.panL = 0.7;
    this.panR = 0.7;
    this.peak = 0;
    this.injPos = 0;
    this.injDirty = false;
    this.excPos = 0;
    this.excLen = 0;
  }

  start(ev, now, cfg, sr, rng) {
    const f0 = mtof(ev.midi);
    this.sr = sr;
    this.cfg = cfg;
    this.active = true;
    this.fading = false;
    this.onset = now;
    this.midi = ev.midi;
    this.f0 = f0;
    this.vel = clamp(ev.vel, 0.02, 1);

    const t60 = logInterp(cfg.t60, f0) * (ev.sustain || 1) * rng.float(0.92, 1.08);
    const fRef = Math.min(Math.max(cfg.hfRef, f0 * 2.5), sr * 0.42);
    const loop = designLoop(sr, f0, t60, cfg.t60High, fRef);
    this.p = loop.p;
    this.gBase = loop.g;
    this.g = loop.g;
    this.dg = 0;
    this.gDamp = Math.pow(10, -3 / (f0 * cfg.dampT60 * (ev.dampScale || 1)));
    this.dampAt = ev.damp != null ? now + Math.round(ev.damp * sr) : Infinity;
    this.repluckUntil = -1;

    this.slideCents = ev.slide ? (ev.slide.from - ev.midi) * 100 : 0;
    this.slideTime = ev.slide ? ev.slide.time : 0;
    this.glide = ev.glide || null;
    this.fall = ev.fall || null;
    this.vib = ev.vib || null;
    this.lastCents = this.slideCents;

    this.buf.fill(0);
    this.w = 0;
    this.lp = 0;
    this.D = this.delayFor(f0 * Math.pow(2, this.slideCents / 1200));
    this.dD = 0;
    this.level = this.makeExcitation(cfg, sr, rng);
    this.friction = 0;
    this.amp = 1;
    this.dAmp = 0;
    const pan = cfg.pan.center + cfg.pan.spread * clamp((ev.midi - 62) / 24, -1, 1) + (ev.pan || 0);
    [this.panL, this.panR] = panGains(pan);
    this.peak = 0;
  }

  // Loop delay for frequency f: period minus the loop filter's phase delay.
  delayFor(f) {
    const w = (TAU * f) / this.sr;
    const tau = Math.atan2(this.p * Math.sin(w), 1 - this.p * Math.cos(w)) / w;
    return Math.max(3, this.sr / f - tau);
  }

  // One period of the initial string motion: a displacement ramp (reliable fundamental, 1/k
  // harmonics) blended with random-walk and white "nail" noise so every pluck differs, then the
  // pluck-position comb and the velocity low-pass. Both filters run circularly because the burst
  // is one period of a periodic wave; it is rotated to start at a zero crossing, so neither the
  // onset nor the loop wrap produces a step. RMS-normalised.
  makeExcitation(cfg, sr, rng) {
    const e = this.exc;
    const tmp = this.scratch;
    const N = Math.max(4, Math.round(sr / this.f0));
    const len = Math.min(N, e.length);
    let walk = 0;
    let noiseSq = 0;
    for (let i = 0; i < len; i++) {
      const w = rng.float(-1, 1);
      walk = walk * 0.995 + w;
      tmp[i] = walk + cfg.nail * this.vel * 8 * w;
      noiseSq += tmp[i] * tmp[i];
    }
    const noiseGain = (cfg.noise * 0.577) / (Math.sqrt(noiseSq / len) || 1);
    for (let i = 0; i < len; i++) tmp[i] = 1 - (2 * i) / len + tmp[i] * noiseGain;
    const M = Math.max(1, Math.round(rng.float(cfg.pluckPos[0], cfg.pluckPos[1]) * N)) % len;
    for (let i = 0; i < len; i++) e[i] = tmp[i] - tmp[(i - M + len) % len];
    const fc = Math.min(cfg.excLow * Math.pow(2, this.vel * cfg.excOct), sr * 0.45);
    const a = 1 - Math.exp((-TAU * fc) / sr);
    let lp = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < len; i++) {
        lp += (e[i] - lp) * a;
        if (pass === 1) tmp[i] = lp;
      }
    }
    let mean = 0;
    for (let i = 0; i < len; i++) mean += tmp[i];
    mean /= len;
    let start = 0;
    let ss = 0;
    for (let i = 0; i < len; i++) {
      tmp[i] -= mean;
      ss += tmp[i] * tmp[i];
      if (Math.abs(tmp[i]) < Math.abs(tmp[start])) start = i;
    }
    const boost = 1 + cfg.lowBoost * clamp((64 - this.midi) / 26, 0, 1);
    const level = cfg.level * Math.pow(this.vel, cfg.velExp) * boost;
    const k = level / (Math.sqrt(ss / len) || 1);
    for (let i = 0; i < len; i++) e[i] = tmp[(start + i) % len] * k;
    this.excPos = 0;
    this.excLen = len;
    return level;
  }

  // Tremolo re-pluck of the same string: briefly damp the ringing loop, add a fresh burst.
  repluck(ev, now, span) {
    this.vel = clamp(ev.vel, 0.02, 1);
    this.makeExcitation(this.cfg, this.sr, this.rng);
    this.repluckUntil = now + Math.max(CONTROL, Math.round(this.sr / this.f0));
    // Inject the head of the new burst into the rest of the current control block.
    const inj = this.inj;
    const end = Math.min(this.injPos + span, CONTROL);
    for (let k = this.injPos; k < end && this.excPos < this.excLen; k++) inj[k] += this.exc[this.excPos++];
    this.injDirty = true;
    this.control(now, span, true);
  }

  fadeOut(now, span, fadeLen) {
    this.fading = true;
    this.fadeLen = fadeLen;
    this.fadeEnd = now + fadeLen;
    this.fadeFrom = this.amp;
    this.dAmp = (this.fadeTarget(now + span) - this.amp) / span;
  }

  fadeTarget(t) {
    return (this.fadeFrom * Math.max(0, this.fadeEnd - t)) / this.fadeLen;
  }

  centsAt(t) {
    let c = 0;
    if (this.slideCents !== 0 && t < this.slideTime) {
      const u = (t - 0.2 * this.slideTime) / (0.8 * this.slideTime);
      c += this.slideCents * (1 - smoothstep(u));
    }
    const gl = this.glide;
    if (gl && t > gl.at) {
      c += gl.cents * smoothstep((t - gl.at) / gl.time);
      if (gl.back && t > gl.at + gl.time + gl.hold) {
        c -= gl.cents * smoothstep((t - gl.at - gl.time - gl.hold) / gl.time);
      }
    }
    const fa = this.fall;
    if (fa && t > fa.at) {
      const u = clamp((t - fa.at) / fa.time, 0, 1);
      c += fa.cents * u * u;
    }
    return c;
  }

  vibratoAt(t) {
    const vb = this.vib;
    if (!vb || t <= vb.delay) return 0;
    const env = clamp((t - vb.delay) / 0.35, 0, 1);
    return vb.depth * env * Math.sin(TAU * vb.rate * (t - vb.delay));
  }

  // Returns false once the voice has been retired.
  control(now, span, keepInj = false) {
    const end = now + span;
    if (this.fading && now >= this.fadeEnd) {
      this.active = false;
      return false;
    }
    if (!keepInj && !this.fading && this.excPos >= this.excLen && this.peak < SILENCE && now - this.onset > this.sr * 0.05) {
      this.fadeOut(now, span, span); // retire with a one-block fade, never a step
    }
    this.peak = 0;
    const t = (end - this.onset) / this.sr;
    const cents = this.centsAt(t);
    const total = cents + this.vibratoAt(t);
    this.dD = (this.delayFor(this.f0 * Math.pow(2, total / 1200)) - this.D) / span;

    let g = end >= this.dampAt ? this.gDamp : this.gBase;
    if (now < this.repluckUntil) g *= 0.72;
    this.dg = (g - this.g) / span;

    if (this.fading) this.dAmp = (this.fadeTarget(end) - this.amp) / span;

    // Friction noise while the left hand slides along the string (qin).
    const rate = Math.abs(cents - this.lastCents) / (span / this.sr);
    this.lastCents = cents;
    this.friction = this.cfg.friction > 0 ? this.cfg.friction * this.level * Math.min(1, rate / 900) : 0;
    if (!keepInj) this.fillInjection(span);
    return true;
  }

  fillInjection(span) {
    const inj = this.inj;
    this.injPos = 0;
    const fr = this.friction;
    if (this.excPos >= this.excLen && fr === 0) {
      if (this.injDirty) {
        inj.fill(0);
        this.injDirty = false;
      }
      return;
    }
    this.injDirty = true;
    const exc = this.exc;
    const next = this.rng.next;
    let pos = this.excPos;
    const len = this.excLen;
    for (let k = 0; k < span; k++) {
      let x = pos < len ? exc[pos++] : 0;
      if (fr !== 0) x += fr * (next() - 0.5);
      inj[k] = x;
    }
    for (let k = span; k < CONTROL; k++) inj[k] = 0;
    this.excPos = pos;
  }

  render(L, R, n) {
    const buf = this.buf;
    const mask = this.mask;
    const inj = this.inj;
    const p = this.p;
    const q = 1 - p;
    const dD = this.dD;
    const dg = this.dg;
    const dAmp = this.dAmp;
    const pl = this.panL;
    const pr = this.panR;
    let w = this.w;
    let D = this.D;
    let g = this.g;
    let lp = this.lp;
    let amp = this.amp;
    let peak = this.peak;
    let ip = this.injPos;
    for (let i = 0; i < n; i++) {
      // 4-point Hermite read at fractional delay D.
      const rp = w - D;
      const fi = Math.floor(rp);
      const f = rp - fi;
      const x0 = buf[(fi - 1) & mask];
      const x1 = buf[fi & mask];
      const x2 = buf[(fi + 1) & mask];
      const x3 = buf[(fi + 2) & mask];
      const c1 = 0.5 * (x2 - x0);
      const c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3;
      const c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
      const s = ((c3 * f + c2) * f + c1) * f + x1;
      lp = q * s + p * lp;
      const v = g * lp + inj[ip++];
      buf[w] = v;
      w = (w + 1) & mask;
      const o = v * amp;
      L[i] += o * pl;
      R[i] += o * pr;
      const ao = o < 0 ? -o : o;
      if (ao > peak) peak = ao;
      D += dD;
      g += dg;
      amp += dAmp;
    }
    this.w = w;
    this.D = D;
    this.g = g;
    this.lp = lp;
    this.amp = amp;
    this.peak = peak;
    this.injPos = ip;
  }
}

export class StringBank {
  constructor(sr, rng, cfg) {
    this.sr = sr;
    this.rng = rng;
    this.cfg = cfg;
    const size = nextPow2(Math.ceil(sr / cfg.minFreq) + 8);
    this.voices = [];
    for (let i = 0; i < cfg.voices + cfg.spare; i++) this.voices.push(new StringVoice(size, rng.fork(`v${i}`)));
    this.body = cfg.body.map(([f, q, g]) => ({ filter: new Biquad().bandpass(sr, f, q), g }));
    this.fadeLen = Math.round(0.006 * sr);
    this.quiet = true;
  }

  noteOn(ev, now, span) {
    if (ev.repluck) {
      const same = this.voices.find((v) => v.active && !v.fading && v.midi === ev.midi);
      if (same) {
        same.repluck(ev, now, span);
        return;
      }
    }
    const v = this.allocate(now, span);
    v.start(ev, now, this.cfg, this.sr, this.rng);
    v.control(now, span);
  }

  // Oldest-voice stealing with a short fade; spare slots absorb the fading voices.
  allocate(now, span) {
    let busy = 0;
    let oldest = null;
    let idle = null;
    for (const v of this.voices) {
      if (!v.active) {
        if (!idle) idle = v;
      } else if (!v.fading) {
        busy++;
        if (!oldest || v.onset < oldest.onset) oldest = v;
      }
    }
    if (busy >= this.cfg.voices && oldest) oldest.fadeOut(now, span, this.fadeLen);
    if (idle) return idle;
    let quiet = null;
    for (const v of this.voices) if (v.fading && (!quiet || v.amp < quiet.amp)) quiet = v;
    return quiet || oldest;
  }

  control(now, span) {
    let any = false;
    for (const v of this.voices) if (v.active && v.control(now, span)) any = true;
    let quiet = !any;
    for (const b of this.body) {
      b.filter.flush();
      if (b.filter.z1 !== 0 || b.filter.z2 !== 0) quiet = false;
    }
    this.quiet = quiet;
  }

  // Returns false when nothing was written (no voices and a silent soundboard).
  render(L, R, n) {
    let any = false;
    for (const v of this.voices) {
      if (v.active) {
        v.render(L, R, n);
        any = true;
      }
    }
    if (!any && this.quiet) return false;
    const body = this.body;
    const f0 = body[0].filter;
    const f1 = body[1].filter;
    const f2 = body[2].filter;
    const g0 = body[0].g;
    const g1 = body[1].g;
    const g2 = body[2].g;
    for (let i = 0; i < n; i++) {
      const m = 0.5 * (L[i] + R[i]);
      const add = g0 * f0.process(m) + g1 * f1.process(m) + g2 * f2.process(m);
      L[i] += add;
      R[i] += add;
    }
    return true;
  }

  get activeCount() {
    let c = 0;
    for (const v of this.voices) if (v.active) c++;
    return c;
  }
}

// ---------------------------------------------------------------------------------------
// Xiao (end-blown bamboo flute)
// ---------------------------------------------------------------------------------------

class XiaoVoice {
  constructor(sr, rng, cfg) {
    this.sr = sr;
    this.rng = rng;
    this.cfg = cfg;
    this.svf = new Svf();
    this.active = false;
    this.releasing = false;
    this.ending = false;
    this.phase = 0;
    this.inc = 0;
    this.dInc = 0;
    this.amp = 0;
    this.dAmp = 0;
    this.nAmp = 0;
    this.dNAmp = 0;
    this.hAmp = 0;
    this.dHAmp = 0;
    this.bpNorm = 1;
    // Faint broadband hiss band-limited to ~4–9 kHz.
    this.hissState = 0;
    this.hissCoef = 1 - Math.exp((-TAU * 4000) / sr);
    this.hissLow = 0;
    this.hissLowCoef = 1 - Math.exp((-TAU * 9000) / sr);
    this.env = 0;
    this.level = 0;
    this.vibPhase = 0;
    this.driftC = 0;
    this.driftA = 0;
    this.rateDrift = 0;
    [this.panL, this.panR] = panGains(cfg.pan);
    this.h2 = 0.08;
    this.h3 = 0.03;
  }

  // Fresh attack; continues from the current level so a still-sounding voice never clicks.
  attack(ev, now) {
    if (!this.active) {
      this.phase = 0;
      this.env = 0;
      this.amp = 0;
      this.nAmp = 0;
      this.hAmp = 0;
      this.level = clamp(ev.vel, 0.02, 1);
      this.freq = mtof(ev.midi);
      this.inc = this.freq / this.sr;
    }
    this.active = true;
    this.releasing = false;
    this.ending = false;
    this.attackStart = now;
    this.attackTime = ev.attack || 0.18;
    this.envFrom = this.env;
    this.chiffAt = now;
    this.scoop = -22;
    this.setNote(ev, now);
    this.glideFrom = 0;
    this.glideTime = 0;
  }

  // Slur to a new pitch without re-articulating; the glide starts exactly at the sounding pitch
  // (landing on the grace note first when there is one).
  legato(ev, now) {
    const prevCents = 1200 * Math.log2(this.freq / mtof(ev.midi));
    this.setNote(ev, now);
    this.glideFrom = clamp(prevCents - this.graceCents, -2400, 2400);
    this.glideTime = ev.porta || 0.1;
    this.scoop = 0;
  }

  setNote(ev, now) {
    this.midi = ev.midi;
    this.baseFreq = mtof(ev.midi);
    this.noteStart = now;
    this.holdEnd = now + Math.round(Math.max(0.05, ev.dur) * this.sr);
    this.velTarget = clamp(ev.vel, 0.02, 1);
    this.vib = ev.vib || null;
    this.graceCents = ev.grace ? (ev.grace.midi - ev.midi) * 100 : 0;
    this.graceHold = ev.grace ? ev.grace.time : 0;
    this.relTime = ev.release || 0.3;
    // Low notes are dark and breathy, upper notes clearer; louder notes brighter.
    const reg = clamp((ev.midi - 62) / 24, 0, 1);
    const dyn = 0.7 + 0.5 * this.velTarget;
    this.h2 = (0.09 + 0.07 * reg) * dyn;
    this.h3 = (0.03 + 0.035 * reg) * dyn;
  }

  release(now, time) {
    if (!this.active || this.releasing) return;
    this.releasing = true;
    this.relStart = now;
    this.relFrom = this.env;
    this.relTau = Math.max(0.01, time / 4);
  }

  centsAt(t, tNote) {
    let c = this.driftC;
    if (this.scoop !== 0) c += this.scoop * (1 - smoothstep(t / 0.09));
    if (this.glideTime > 0) c += this.glideFrom * (1 - smoothstep(tNote / this.glideTime));
    if (this.graceCents !== 0) c += this.graceCents * (1 - smoothstep((tNote - this.graceHold) / 0.028));
    if (this.releasing) c -= 14 * Math.min(1, (t - (this.relStart - this.attackStart) / this.sr) / 0.3);
    return c;
  }

  control(now, span) {
    if (!this.active) return false;
    const sr = this.sr;
    const end = now + span;
    if (!this.releasing && end >= this.holdEnd) this.release(this.holdEnd, this.relTime);
    const t = (end - this.attackStart) / sr;
    const tNote = (end - this.noteStart) / sr;
    const rng = this.rng;

    // Slow random drift of pitch, level and vibrato rate (a breathing player, not an LFO).
    this.driftC = this.driftC * 0.999 + rng.float(-0.06, 0.06);
    this.driftA = this.driftA * 0.998 + rng.float(-0.002, 0.002);
    this.rateDrift = this.rateDrift * 0.999 + rng.float(-0.012, 0.012);
    this.level += (this.velTarget - this.level) * 0.03;

    if (this.ending) {
      this.active = false;
      this.ending = false;
      this.env = 0;
      return false;
    }
    let env;
    if (this.releasing) {
      env = this.relFrom * Math.exp(-((end - this.relStart) / sr) / this.relTau);
      if (env < 2e-4) {
        // Ramp everything to zero over this block, retire on the next tick.
        this.ending = true;
        this.env = 0;
        this.dAmp = -this.amp / span;
        this.dNAmp = -this.nAmp / span;
        this.dHAmp = -this.hAmp / span;
        this.dInc = 0;
        return true;
      }
    } else {
      const u = clamp(t / this.attackTime, 0, 1);
      env = this.envFrom + (1 - this.envFrom) * (1 - (1 - u) * (1 - u));
    }
    this.env = env;

    let cents = this.centsAt(t, tNote);
    let am = 1 + this.driftA;
    const vb = this.vib;
    if (vb && tNote > vb.delay) {
      const depthEnv = clamp((tNote - vb.delay) / 0.3, 0, 1);
      this.vibPhase += (TAU * (vb.rate + this.rateDrift) * span) / sr;
      const s = Math.sin(this.vibPhase);
      cents += vb.depth * depthEnv * s;
      am += 0.004 * vb.depth * depthEnv * s;
    }
    const freq = this.baseFreq * Math.pow(2, cents / 1200);
    this.freq = freq;
    this.dInc = (freq / sr - this.inc) / span;

    const lev = this.cfg.level * Math.pow(this.level, this.cfg.velExp);
    const toneAmp = lev * env * am;
    const chiff = this.cfg.chiff * lev * Math.exp(-((end - this.chiffAt) / sr) / 0.06) * (this.releasing ? 0 : 1);
    const breath = this.cfg.breath * (1.25 - 0.5 * this.level);
    this.dAmp = (toneAmp - this.amp) / span;
    this.dNAmp = (toneAmp * breath + chiff - this.nAmp) / span;
    this.dHAmp = (toneAmp * this.cfg.hiss - this.hAmp) / span;

    const fc = Math.min(2 * freq, sr * 0.42);
    const q = 2.2;
    this.svf.set(sr, fc, q);
    this.bpNorm = 0.707 / Math.sqrt((Math.PI * fc) / (3 * q * sr));
    return true;
  }

  render(L, R, n) {
    const next = this.rng.next;
    const svf = this.svf;
    const h2 = this.h2;
    const h3 = this.h3;
    const bpNorm = this.bpNorm;
    const hc = this.hissCoef;
    const pl = this.panL;
    const pr = this.panR;
    const dInc = this.dInc;
    const dAmp = this.dAmp;
    const dNAmp = this.dNAmp;
    const dHAmp = this.dHAmp;
    let phase = this.phase;
    let inc = this.inc;
    let amp = this.amp;
    let nAmp = this.nAmp;
    let hAmp = this.hAmp;
    let hs = this.hissState;
    let hl = this.hissLow;
    const lc = this.hissLowCoef;
    for (let i = 0; i < n; i++) {
      phase += inc;
      if (phase >= 1) phase -= 1;
      const x = phase * SINE_SIZE;
      const k = x | 0;
      const s = SINE[k] + (SINE[k + 1] - SINE[k]) * (x - k);
      // Chebyshev terms give the 2nd and 3rd harmonics from the fundamental.
      const tone = s + h2 * (2 * s * s - 1) + h3 * s * (4 * s * s - 3);
      const wn = next() * 2 - 1;
      const bp = svf.bandpass(wn);
      hs += (wn - hs) * hc;
      hl += (wn - hs - hl) * lc;
      const out = amp * tone + nAmp * bpNorm * bp + hAmp * hl;
      L[i] += out * pl;
      R[i] += out * pr;
      inc += dInc;
      amp += dAmp;
      nAmp += dNAmp;
      hAmp += dHAmp;
    }
    this.phase = phase;
    this.inc = inc;
    this.amp = amp;
    this.nAmp = nAmp;
    this.hAmp = hAmp;
    this.hissState = hs;
    this.hissLow = hl;
  }
}

export class XiaoBank {
  constructor(sr, rng, cfg = XIAO) {
    this.sr = sr;
    this.voices = [];
    for (let i = 0; i < cfg.voices; i++) this.voices.push(new XiaoVoice(sr, rng.fork(`v${i}`), cfg));
    this.current = null;
  }

  noteOn(ev, now, span) {
    const cur = this.current;
    if (ev.legato && cur && cur.active && !cur.releasing) {
      cur.legato(ev, now);
      cur.control(now, span);
      return;
    }
    if (cur && cur.active) cur.release(now, ev.tongue ? 0.08 : 0.2);
    let v = this.voices.find((x) => x !== cur && !x.active);
    if (!v) v = this.voices.reduce((a, b) => (b !== cur && (a === cur || b.env < a.env) ? b : a));
    v.attack(ev, now);
    v.control(now, span);
    this.current = v;
  }

  releaseAll(now, time) {
    for (const v of this.voices) v.release(now, time);
  }

  control(now, span) {
    for (const v of this.voices) {
      if (v.active) {
        v.control(now, span);
        v.svf.flush();
      }
    }
  }

  render(L, R, n) {
    let any = false;
    for (const v of this.voices) {
      if (v.active) {
        v.render(L, R, n);
        any = true;
      }
    }
    return any;
  }
}

// ---------------------------------------------------------------------------------------
// Modal voices: sums of exponentially decaying sines (qin harmonics, qing, muyu)
// ---------------------------------------------------------------------------------------

const CLICK_LEN = 96;

class ModalVoice {
  constructor(maxPartials) {
    this.c = new Float64Array(maxPartials);
    this.r2 = new Float64Array(maxPartials);
    this.y1 = new Float64Array(maxPartials);
    this.y2 = new Float64Array(maxPartials);
    this.click = new Float64Array(CLICK_LEN);
    this.tmp = new Float64Array(CONTROL);
    this.np = 0;
    this.active = false;
  }

  start(ev, now, cfg, sr, rng) {
    const f = ev.freq || mtof(ev.midi);
    const vel = clamp(ev.vel, 0.02, 1);
    const level = cfg.level * Math.pow(vel, 1.2);
    let np = 0;
    let slowest = 0;
    for (let k = 0; k < cfg.ratios.length; k++) {
      const fk = f * cfg.ratios[k] * (1 + rng.float(-0.0015, 0.0015) * (k > 0 ? 1 : 0));
      if (fk > sr * 0.45) continue;
      const w = (TAU * fk) / sr;
      const t60 = cfg.t60[k] * (ev.decay || 1) * rng.float(0.9, 1.1);
      const r = Math.pow(10, -3 / (t60 * sr));
      const a = level * cfg.amps[k] * rng.float(0.85, 1.15);
      // State for y[n] = a r^n sin(w (n + 1)): y[-1] = 0, y[-2] = -a sin(w) / r^2.
      this.c[np] = 2 * r * Math.cos(w);
      this.r2[np] = r * r;
      this.y1[np] = 0;
      this.y2[np] = (-a * Math.sin(w)) / (r * r);
      if (t60 > slowest) slowest = t60;
      np++;
    }
    this.np = np;
    this.onset = now;
    this.sr = sr;
    this.life = Math.round(slowest * sr * 1.6); // well below -90 dB by then
    this.att = 1;
    this.attK = Math.exp(-1 / (Math.max(1e-4, cfg.attack / 3) * sr));
    this.level = level;
    this.gain = 1;
    this.fadeStep = 0;
    this.clickPos = 0;
    if (cfg.click > 0) {
      // Mallet contact: a short, high-passed noise tick.
      let hp = 0;
      for (let i = 0; i < CLICK_LEN; i++) {
        const x = rng.float(-1, 1);
        hp += (x - hp) * 0.35;
        this.click[i] = (x - hp) * cfg.click * level * Math.exp(-i / (CLICK_LEN / 5));
      }
      this.clickLen = CLICK_LEN;
    } else {
      this.clickLen = 0;
    }
    const [pc, spread] = cfg.pan;
    [this.panL, this.panR] = panGains(pc + (ev.pan != null ? ev.pan : rng.float(-spread, spread)));
    this.active = true;
  }

  control(now) {
    if (this.fadeStep > 0) this.active = false;
    else if (now - this.onset > this.life) this.fadeStep = 1 / CONTROL;
  }

  render(L, R, n) {
    const tmp = this.tmp;
    tmp.fill(0, 0, n);
    for (let k = 0; k < this.np; k++) {
      const c = this.c[k];
      const r2 = this.r2[k];
      let y1 = this.y1[k];
      let y2 = this.y2[k];
      for (let i = 0; i < n; i++) {
        const y = c * y1 - r2 * y2;
        y2 = y1;
        y1 = y;
        tmp[i] += y;
      }
      this.y1[k] = y1;
      this.y2[k] = y2;
    }
    let att = this.att;
    let gain = this.gain;
    const attK = this.attK;
    const step = this.fadeStep;
    const pl = this.panL;
    const pr = this.panR;
    for (let i = 0; i < n; i++) {
      let s = tmp[i] * (1 - att) * gain;
      att *= attK;
      gain = gain > step ? gain - step : 0;
      if (this.clickPos < this.clickLen) s += this.click[this.clickPos++];
      L[i] += s * pl;
      R[i] += s * pr;
    }
    this.att = att;
    this.gain = gain;
  }
}

export class ModalBank {
  constructor(sr, rng, cfg) {
    this.sr = sr;
    this.rng = rng;
    this.cfg = cfg;
    this.voices = [];
    for (let i = 0; i < cfg.voices; i++) this.voices.push(new ModalVoice(cfg.ratios.length));
  }

  noteOn(ev, now) {
    let v = this.voices.find((x) => !x.active);
    if (!v) v = this.voices.reduce((a, b) => (b.onset < a.onset ? b : a));
    v.start(ev, now, this.cfg, this.sr, this.rng);
  }

  control(now) {
    for (const v of this.voices) if (v.active) v.control(now);
  }

  render(L, R, n) {
    let any = false;
    for (const v of this.voices) {
      if (v.active) {
        v.render(L, R, n);
        any = true;
      }
    }
    return any;
  }
}

// ---------------------------------------------------------------------------------------
// Sand rustle: band-passed noise plus sparse resonant grains, driven by sand activity.
// ---------------------------------------------------------------------------------------

export class SandRustle {
  constructor(sr, rng) {
    this.sr = sr;
    this.rng = rng;
    this.target = 0;
    this.act = 0;
    this.k = smoothCoef(0.15, sr);
    this.hpL = new Biquad().highpass(sr, 2000, 0.6);
    this.lpL = new Biquad().lowpass(sr, 7000, 0.6);
    this.hpR = new Biquad().highpass(sr, 2100, 0.6);
    this.lpR = new Biquad().lowpass(sr, 6800, 0.6);
    this.grainL = new Biquad().bandpass(sr, 3400, 5);
    this.grainR = new Biquad().bandpass(sr, 4700, 5);
    this.noiseLevel = 0.112;
    this.grainLevel = 1.35;
    this.grainRate = 180; // grains per second at full activity
    this.swish = 1;
    this.swishTarget = 1;
    this.silent = true;
  }

  setActivity(level) {
    this.target = clamp(level, 0, 1);
    if (this.target > 0) this.silent = false;
  }

  control() {
    if (this.silent) return;
    if (this.target === 0 && this.act < 1e-5) {
      this.silent = true;
      this.act = 0;
      for (const f of [this.hpL, this.lpL, this.hpR, this.lpR, this.grainL, this.grainR]) {
        f.z1 = 0;
        f.z2 = 0;
      }
      return;
    }
    // Slow wandering intensity, like a hand sweeping and pausing.
    if (this.rng.chance(0.004)) this.swishTarget = this.rng.float(0.55, 1.25);
    this.swish += (this.swishTarget - this.swish) * 0.01;
  }

  render(L, R, n) {
    if (this.silent) return;
    const next = this.rng.next;
    const k = this.k;
    const target = this.target;
    const nl = this.noiseLevel * this.swish;
    const gl = this.grainLevel;
    const rate = this.grainRate / this.sr;
    let act = this.act;
    for (let i = 0; i < n; i++) {
      act += (target - act) * k;
      const a = next() * 2 - 1;
      const b = next() * 2 - 1;
      let gIn = 0;
      if (next() < rate * act * act) gIn = (next() - 0.5) * 2;
      const side = gIn !== 0 && next() < 0.5;
      const gLeft = this.grainL.process(side ? gIn : 0);
      const gRight = this.grainR.process(side ? 0 : gIn);
      const l = this.lpL.process(this.hpL.process(a)) * nl + gLeft * gl;
      const r = this.lpR.process(this.hpR.process(b)) * nl + gRight * gl;
      L[i] += l * act;
      R[i] += r * act;
    }
    this.act = act;
  }
}
