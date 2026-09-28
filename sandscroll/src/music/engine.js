// SandScroll music engine: composer -> instrument banks -> reverb -> master bus.
//
// Rendering is sample-accurate and block-size independent: control work runs on absolute
// multiples of CONTROL samples, events are dispatched on their exact sample, and every
// per-sample random draw belongs to a single stream consumed in sample order. Rendering N
// samples in one call or in any chunking produces the same output.

import { Rng } from '../core/rng.js';
import { CONTROL, Biquad, LookaheadLimiter, PeakCompressor, clamp, softClip } from './dsp.js';
import { StringBank, XiaoBank, ModalBank, SandRustle, ZHENG, QIN, XIAO, HARMONIC, QING, MUYU } from './instruments.js';
import { Reverb } from './reverb.js';
import { Composer } from './composer.js';
import { PRESETS, MOOD_NAMES } from './presets.js';

export { MOOD_NAMES };

export const CUE_NAMES = ['seal', 'gliss', 'harmonic'];

// Dry gain and reverb send per instrument bus (xiao and harmonics sit wetter). Plucked strings
// get a gentle transient compressor so their attacks do not dominate the loudness budget.
const BUS = {
  zheng: { gain: 1, send: 0.3, comp: { threshold: 0.14, ratio: 2.4, attack: 0.0004, release: 0.07 } },
  qin: { gain: 1, send: 0.26, comp: { threshold: 0.11, ratio: 3, attack: 0.0004, release: 0.09 } },
  xiao: { gain: 1, send: 0.42 },
  harm: { gain: 1, send: 0.55 },
  qing: { gain: 1, send: 0.5 },
  muyu: { gain: 1, send: 0.15 },
};

const MASTER = {
  level: 1,
  wet: 2.2,
  highpass: 38, // Hz, removes DC and sub-bass rumble
  limitThreshold: 0.67, // -3.5 dBFS look-ahead peak limiter
  limitRelease: 0.08,
  clipKnee: 0.708, // -3 dBFS: tanh safety shoulder starts here
  clipCeiling: 0.89, // -1 dBFS: absolute peak ceiling
  mixSmoothing: 2.5, // seconds for mood mix changes
};

const presetMix = (name) => {
  const p = PRESETS[name];
  return { reverb: p.reverb, wet: p.wet, gain: p.gain };
};

export class MusicEngine {
  constructor({ sampleRate = 48000, seed = 1, mood = 'moonrise' } = {}) {
    const sr = sampleRate;
    this.sampleRate = sr;
    const start = PRESETS[mood] ? mood : MOOD_NAMES[0];
    const root = new Rng(seed);
    this.banks = {
      zheng: new StringBank(sr, root.fork('zheng'), ZHENG),
      qin: new StringBank(sr, root.fork('qin'), QIN),
      xiao: new XiaoBank(sr, root.fork('xiao'), XIAO),
      harm: new ModalBank(sr, root.fork('harm'), HARMONIC),
      qing: new ModalBank(sr, root.fork('qing'), QING),
      muyu: new ModalBank(sr, root.fork('muyu'), MUYU),
    };
    this.buses = Object.entries(this.banks).map(([name, bank]) => ({
      name,
      bank,
      gain: BUS[name].gain,
      send: BUS[name].send,
      comp: BUS[name].comp ? new PeakCompressor(sr, BUS[name].comp) : null,
      L: new Float64Array(CONTROL),
      R: new Float64Array(CONTROL),
    }));
    this.rustle = new SandRustle(sr, root.fork('sand'));
    this.reverb = new Reverb(sr, { room: 0.85, damp: 0.4, width: 1, predelay: 0.02, maxBlock: CONTROL });
    this.composer = new Composer({ sampleRate: sr, rng: root.fork('composer'), mood: start });

    this.dryL = new Float64Array(CONTROL);
    this.dryR = new Float64Array(CONTROL);
    this.send = new Float64Array(CONTROL);
    this.wetL = new Float64Array(CONTROL);
    this.wetR = new Float64Array(CONTROL);
    this.sandL = new Float64Array(CONTROL);
    this.sandR = new Float64Array(CONTROL);
    this.hpL = new Biquad().highpass(sr, MASTER.highpass);
    this.hpR = new Biquad().highpass(sr, MASTER.highpass);

    this.mix = presetMix(start);
    this.mixTarget = presetMix(start);
    this.mixCoef = 1 - Math.exp(-CONTROL / (MASTER.mixSmoothing * sr));
    this.gain = this.mix.gain * MASTER.level;
    this.gainCoef = 1 - Math.exp(-1 / (0.05 * sr));
    this.outL = new Float64Array(CONTROL);
    this.outR = new Float64Array(CONTROL);
    this.limiter = new LookaheadLimiter(sr, { threshold: MASTER.limitThreshold, release: MASTER.limitRelease });

    this._now = 0;
    this._nextTick = 0;
    this.stats = { notes: 0, byInst: {} };
    this.onEvent = null; // optional (event, seconds) hook for logging
    this.meter = null; // optional {}: accumulates per-bus energy (sum of squares) for analysis
  }

  get time() {
    return this._now / this.sampleRate;
  }

  get mood() {
    return this.composer.moodName;
  }

  setMood(name) {
    this.composer.setMood(name, this._now);
  }

  setSandActivity(level) {
    const v = Number(level);
    this.rustle.setActivity(Number.isFinite(v) ? clamp(v, 0, 1) : 0);
  }

  cue(name) {
    if (CUE_NAMES.includes(name)) this.composer.cue(name, this._now);
  }

  render(frames) {
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    this.renderInto(left, right, 0, frames);
    return { left, right };
  }

  renderInto(left, right, offset = 0, frames = left.length - offset) {
    const queue = this.composer.queue;
    const end = offset + frames;
    let pos = offset;
    while (pos < end) {
      if (this._now === this._nextTick) this._tick();
      while (queue.peekTime() <= this._now) this._dispatch(queue.shift());
      let n = Math.min(end - pos, this._nextTick - this._now);
      const untilEvent = queue.peekTime() - this._now;
      if (untilEvent < n) n = untilEvent;
      this._renderSegment(left, right, pos, n);
      pos += n;
      this._now += n;
    }
  }

  _tick() {
    const now = this._now;
    this.composer.update(now);
    const mix = this.mix;
    const target = this.mixTarget;
    const c = this.mixCoef;
    mix.reverb += (target.reverb - mix.reverb) * c;
    mix.wet += (target.wet - mix.wet) * c;
    mix.gain += (target.gain - mix.gain) * c;
    for (const bus of this.buses) bus.bank.control(now, CONTROL);
    this.rustle.control();
    this.hpL.flush();
    this.hpR.flush();
    this._nextTick = now + CONTROL;
  }

  _dispatch(ev) {
    if (ev.kind === 'note') {
      const bank = this.banks[ev.inst];
      if (!bank) return;
      bank.noteOn(ev, this._now, this._nextTick - this._now);
      this.stats.notes++;
      this.stats.byInst[ev.inst] = (this.stats.byInst[ev.inst] || 0) + 1;
    } else if (ev.kind === 'release') {
      this.banks.xiao.releaseAll(this._now, ev.fade);
    } else if (ev.kind === 'mix') {
      this.mixTarget = presetMix(ev.mood);
    }
    if (this.onEvent) this.onEvent(ev, this._now / this.sampleRate);
  }

  // Debug metering: energy per bus before master gain.
  _meter(name, L, R, n, gain) {
    let e = 0;
    for (let i = 0; i < n; i++) e += (L[i] * gain) ** 2 + (R[i] * gain) ** 2;
    this.meter[name] = (this.meter[name] || 0) + e;
  }

  _renderSegment(left, right, off, n) {
    const dryL = this.dryL;
    const dryR = this.dryR;
    const send = this.send;
    dryL.fill(0, 0, n);
    dryR.fill(0, 0, n);
    send.fill(0, 0, n);
    const revScale = this.mix.reverb * 0.5;
    for (const bus of this.buses) {
      const L = bus.L;
      const R = bus.R;
      L.fill(0, 0, n);
      R.fill(0, 0, n);
      if (!bus.bank.render(L, R, n)) continue;
      if (bus.comp) bus.comp.process(L, R, n);
      const g = bus.gain;
      const s = bus.send * revScale;
      for (let i = 0; i < n; i++) {
        const l = L[i] * g;
        const r = R[i] * g;
        dryL[i] += l;
        dryR[i] += r;
        send[i] += (l + r) * s;
      }
      if (this.meter) this._meter(bus.name, L, R, n, g);
    }
    const wetL = this.wetL;
    const wetR = this.wetR;
    this.reverb.process(send, wetL, wetR, n);
    if (this.meter) this._meter('reverb', wetL, wetR, n, this.mix.wet * MASTER.wet);

    const sandL = this.sandL;
    const sandR = this.sandR;
    sandL.fill(0, 0, n);
    sandR.fill(0, 0, n);
    this.rustle.render(sandL, sandR, n);

    const wet = this.mix.wet * MASTER.wet;
    const gainTarget = this.mix.gain * MASTER.level;
    const gc = this.gainCoef;
    const hpL = this.hpL;
    const hpR = this.hpR;
    const outL = this.outL;
    const outR = this.outR;
    let gain = this.gain;
    for (let i = 0; i < n; i++) {
      gain += (gainTarget - gain) * gc;
      outL[i] = hpL.process(dryL[i] + wetL[i] * wet) * gain + sandL[i];
      outR[i] = hpR.process(dryR[i] + wetR[i] * wet) * gain + sandR[i];
    }
    this.gain = gain;
    this.limiter.process(outL, outR, n);
    const knee = MASTER.clipKnee;
    const ceil = MASTER.clipCeiling;
    for (let i = 0; i < n; i++) {
      left[off + i] = softClip(outL[i], knee, ceil);
      right[off + i] = softClip(outR[i], knee, ceil);
    }
  }
}
