// Real-time composer. Music is planned one unit at a time (a phrase, an interlude or a mood
// transition) a couple of seconds ahead of the audio clock and emitted as sample-stamped
// events. Sections follow 起承转合 (A, A', B, A''), each with a fresh motif, separated by
// interludes, so the stream keeps evolving instead of looping.

import { TAU, clamp } from './dsp.js';
import { Mode } from './theory.js';
import { PRESETS } from './presets.js';
import { buildPhrase, makeMotif } from './melody.js';

// Melodic registers (MIDI) per instrument.
const REGISTER = {
  xiao: { lo: 62, hi: 86, center: 72 },
  zheng: { lo: 55, hi: 86, center: 69 },
  qin: { lo: 45, hi: 72, center: 57 },
  harm: { lo: 67, hi: 93, center: 79 },
};
const ZHENG_LOW = 38;
const ZHENG_HIGH = 88;

// Broken-chord patterns as degree offsets from the bass centre (0 = root, 3 ≈ fifth,
// 5 = octave, 6/7 = ninth/tenth).
const ARP_PATTERNS = {
  rolling: [0, 3, 5, 6, 7, 6, 5, 3],
  open: [0, 5, 3, 5, 7, 5, 3, 5],
  rise: [0, 3, 5, 7, 8, 10, 8, 7],
  wave: [0, 3, 5, 6, 7, 8, 7, 6, 5, 3, 5, 6, 7, 6, 5, 3],
};

const PLAN = ['A', 'A1', 'B', 'A2']; // 起 承 转 合
const TEXTURE = { A: 0.8, A1: 1, B: 1.2, A2: 0.95 };
const MAX_WAIT = 4; // seconds a mood change waits for the current phrase

const modeOf = (preset) => new Mode(preset.tonic, preset.mode);

function weightedKey(rng, table) {
  const keys = Object.keys(table);
  return rng.weighted(keys, keys.map((k) => table[k]));
}

// Sorted by (time, insertion order); consumed from the front.
export class EventQueue {
  constructor() {
    this.items = [];
    this.head = 0;
    this.seq = 0;
  }

  get size() {
    return this.items.length - this.head;
  }

  push(ev) {
    ev.seq = this.seq++;
    const items = this.items;
    let lo = this.head;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const m = items[mid];
      if (m.time < ev.time || (m.time === ev.time && m.seq < ev.seq)) lo = mid + 1;
      else hi = mid;
    }
    items.splice(lo, 0, ev);
  }

  peekTime() {
    return this.head < this.items.length ? this.items[this.head].time : Infinity;
  }

  shift() {
    const ev = this.items[this.head++];
    if (this.head > 256 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return ev;
  }

  remove(drop) {
    this.items = this.items.slice(this.head).filter((ev) => !drop(ev));
    this.head = 0;
  }
}

// Beat -> seconds for one phrase: gentle push through the middle, ritardando into the cadence.
class TimeMap {
  constructor(t0, beatSec, beats, { rit = 0.12, ritFrom = beats - 2, push = 0.012 } = {}) {
    const steps = Math.ceil(beats * 4) + 24;
    this.t = new Float64Array(steps + 1);
    this.t[0] = t0;
    const span = Math.max(0.5, beats - ritFrom);
    for (let k = 0; k < steps; k++) {
      const b = (k + 0.5) / 4;
      let f = 1 - push * Math.sin(Math.PI * clamp(b / beats, 0, 1));
      if (b > ritFrom) f *= 1 + rit * Math.pow(Math.min(1, (b - ritFrom) / span), 1.5);
      this.t[k + 1] = this.t[k] + (beatSec / 4) * f;
    }
  }

  at(beat) {
    const x = Math.max(0, beat * 4);
    const k = Math.min(Math.floor(x), this.t.length - 2);
    return this.t[k] + (this.t[k + 1] - this.t[k]) * (x - k);
  }
}

export class Composer {
  constructor({ sampleRate, rng, mood }) {
    this.sr = sampleRate;
    this.rng = rng.fork('form');
    this.hum = rng.fork('humanize');
    this.cueRng = rng.fork('cues');
    this.queue = new EventQueue();
    this.now = 0; // samples; nothing is ever scheduled before this
    this.cursor = 0.3; // seconds: where the next unit starts
    this.lookahead = 2.5; // must exceed the longest pickup gesture
    this.units = [];
    this.unitId = 0;
    this.uid = 0;
    this.presetName = mood;
    this.preset = PRESETS[mood];
    this.homeMode = modeOf(this.preset);
    this.mode = this.homeMode;
    this.pending = mood; // the stream opens with a gesture into the first mood
    this.section = null;
    this.afterTransition = true;
    this.tempoPhase = this.rng.float(0, TAU);
    this.tempoDrift = 0;
    this.trace = null; // optional array of unit summaries for logs
  }

  get moodName() {
    return this.pending || this.presetName;
  }

  update(nowSamples) {
    this.now = nowSamples;
    const now = nowSamples / this.sr;
    for (let guard = 0; guard < 8 && this.cursor < now + this.lookahead; guard++) {
      this._nextUnit(Math.max(this.cursor, now));
    }
  }

  // --- public controls --------------------------------------------------------------

  setMood(name, nowSamples) {
    if (!PRESETS[name] || name === this.moodName) return false;
    this.now = nowSamples;
    if (this.pending) {
      this.pending = name; // transition not generated yet: just retarget it
      return true;
    }
    this.pending = name;
    const now = nowSamples / this.sr;
    const unit = this._unitAt(now);
    let cut = now;
    if (unit) {
      if (unit.end - now <= MAX_WAIT) cut = unit.end;
      else cut = this._barBetween(unit, now + 1, now + MAX_WAIT) ?? now + 2.5;
    }
    cut = Math.max(cut, now);
    const cutSample = Math.round(cut * this.sr);
    const dropped = new Set(this.units.filter((u) => u.start >= cut - 1e-9).map((u) => u.id));
    this.queue.remove((ev) => !ev.cue && (ev.time >= cutSample || dropped.has(ev.uid)));
    for (const u of this.units) if (dropped.has(u.id) && u.traced) u.traced.cancelled = true;
    this.units = this.units.filter((u) => !dropped.has(u.id));
    if (unit && cut < unit.end) {
      unit.end = cut;
      if (unit.traced) unit.traced.end = cut;
      this.uid = unit.id;
      this._emit(cut, { kind: 'release', inst: 'xiao', fade: 0.9 });
    }
    this.cursor = cut;
    return true;
  }

  cue(name, nowSamples) {
    this.now = nowSamples;
    const t = nowSamples / this.sr;
    const rng = this.cueRng;
    const mode = this._modeAt(t);
    const saved = this.mode;
    this.mode = mode;
    this.uid = 0;
    if (name === 'seal') {
      // Qing chime-stone on the tonic or fifth, 300–500 Hz.
      const cands = [0, mode.fifth, mode.fifth - 5, 5].map((d) => mode.midi(mode.tonicNear(66) + d));
      const inRange = cands.filter((m) => m >= 62 && m <= 71);
      const midi = rng.pick(inRange.length ? inRange : [mode.midi(mode.tonicNear(66))]);
      this._note(t, 'qing', midi, rng.float(0.6, 0.8), 6, { cue: true });
    } else if (name === 'gliss') {
      // 12–24 plucks; longer sweeps go up and come back down within the strings' range.
      const n = rng.int(12, 24);
      const dur = rng.float(0.8, 1.6);
      const [lo, hi] = mode.degreeRange(43, ZHENG_HIGH);
      const strings = hi - lo + 1;
      const vel = rng.float(0.45, 0.6);
      if (n > strings - 2) {
        const up = rng.int(12, Math.min(15, strings));
        const t1 = this._gliss(t, dur * 0.6, lo, lo + up - 1, vel, { cue: true, rng });
        this._gliss(t1 + 0.05, dur * 0.4, lo + up - 2, lo + up - 1 - (n - up), vel * 0.8, { cue: true, rng });
      } else {
        const offset = rng.int(0, strings - n);
        const [from, to] = rng.chance(0.7) ? [lo + offset, lo + offset + n - 1] : [hi - offset, hi - offset - n + 1];
        this._gliss(t, dur, from, to, vel, { cue: true, rng });
      }
    } else if (name === 'harmonic') {
      const hT = mode.tonicNear(79);
      const d = hT + rng.pick([0, mode.fifth, 5, mode.fifth - 5]);
      this._note(t, 'harm', mode.midi(d), rng.float(0.55, 0.7), 3, { cue: true });
    }
    this.mode = saved;
  }

  // --- unit scheduling ----------------------------------------------------------------

  _nextUnit(t0) {
    this.uid = ++this.unitId;
    let unit;
    if (this.pending) {
      unit = this._transition(t0);
    } else {
      const sec = this.section;
      if (sec && sec.idx >= PLAN.length && !sec.interluded) {
        sec.interluded = true;
        unit = this._interlude(t0);
      } else {
        if (!sec || sec.idx >= PLAN.length) this._startSection();
        unit = this._phrase(t0);
      }
    }
    unit.id = this.uid;
    unit.modeObj = this.mode;
    unit.mood = this.presetName;
    this.units.push(unit);
    if (this.units.length > 16) this.units.shift();
    this.cursor = unit.end;
    if (this.trace) {
      const { modeObj, bars, ...summary } = unit;
      unit.traced = { ...summary, mode: modeObj.label };
      this.trace.push(unit.traced);
    }
  }

  _unitAt(t) {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.start <= t && t < u.end) return u;
    }
    return null;
  }

  _modeAt(t) {
    const u = this._unitAt(t);
    return u ? u.modeObj : this.mode;
  }

  _barBetween(unit, from, to) {
    if (!unit.bars) return null;
    for (const b of unit.bars) if (b >= from && b <= to) return b;
    return null;
  }

  // --- emission helpers -------------------------------------------------------------

  _emit(t, ev) {
    ev.time = Math.max(this.now, Math.round(t * this.sr));
    ev.uid = this.uid;
    this.queue.push(ev);
    return ev;
  }

  _note(t, inst, midi, vel, dur, extra = {}) {
    return this._emit(t, { kind: 'note', inst, midi, vel: clamp(vel, 0.02, 1), dur, pcs: this.mode.pcs, ...extra });
  }

  _jitter() {
    return clamp(this.hum.gauss(0, 0.0035), -0.008, 0.008);
  }

  _humVel(v) {
    return v * (1 + clamp(this.hum.gauss(0, 0.05), -0.1, 0.1));
  }

  // Phrase-level swell toward the melodic peak, metric accents, humanised.
  _vel(base, note, opts) {
    let v = base * (opts.velScale || 1);
    const d = opts.dyn;
    if (d) {
      const u = note.beat / d.beats;
      v *= 0.84 + 0.22 * Math.exp(-(((u - d.peak) / 0.35) ** 2));
      if (d.kind === 'B') v *= 1.06;
    }
    const inBar = note.beat % 4;
    v *= inBar === 0 ? 1.05 : inBar === 2 ? 1.02 : Number.isInteger(inBar) ? 1 : 0.95;
    return this._humVel(v);
  }

  // --- sections and phrases ---------------------------------------------------------

  _startSection() {
    const p = this.preset;
    const rng = this.rng;
    this.mode = this.homeMode;
    if (!this.afterTransition && p.siblings && rng.chance(p.modeShift)) {
      this.mode = this.homeMode.sibling(rng.pick(p.siblings));
    }
    const lead = weightedKey(rng, p.lead);
    let second = weightedKey(rng, p.second);
    if (second === 'other') second = lead === 'xiao' ? 'zheng' : 'xiao';
    const reg = REGISTER[lead];
    const T = this.mode.tonicNear((p.leadCenter && p.leadCenter[lead]) || reg.center);
    const [lo, hi] = this.mode.degreeRange(reg.lo, reg.hi);
    this.tempoDrift = clamp(this.tempoDrift + rng.float(-0.01, 0.01), -0.02, 0.02);
    const ctx = {
      rhythm: p.rhythm,
      density: p.density * rng.float(0.85, 1.15),
      fifth: this.mode.fifth,
      fourth: this.mode.fourth,
      lo: Math.max(lo - T, -4),
      hi: Math.min(hi - T, 7),
      bars: p.bars,
      breath: p.breath,
    };
    this.section = {
      lead,
      second,
      T,
      ctx,
      motif: makeMotif(rng, ctx),
      idx: 0,
      interluded: false,
      tempo: 1 + this.tempoDrift,
      glissFirst: !this.afterTransition && rng.chance(p.glissSection),
      aEnd: undefined,
    };
    this.afterTransition = false;
  }

  _phrase(t0) {
    const sec = this.section;
    const p = this.preset;
    const rng = this.rng;
    const kind = PLAN[sec.idx++];
    const ph = buildPhrase(rng, kind, sec.ctx, sec);
    if (kind === 'A') sec.aEnd = ph.endDeg;
    this.tempoPhase += rng.float(0.5, 1.1);
    const bpm = p.bpm * sec.tempo * (1 + 0.012 * Math.sin(this.tempoPhase));
    const final = ph.notes[ph.notes.length - 1];
    const rit = kind === 'A2' ? rng.float(0.15, 0.2) : rng.float(0.1, 0.14);
    const map = new TimeMap(t0, 60 / bpm, ph.beats, { rit, ritFrom: Math.max(0, final.beat - 1) });
    const texture = TEXTURE[kind];

    if ((sec.idx === 1 && sec.glissFirst) || (sec.idx > 1 && rng.chance(p.glissPhrase))) this._pickupGliss(t0);

    let peakNote = ph.notes[0];
    for (const n of ph.notes) if (n.deg > peakNote.deg) peakNote = n;
    const melodyBeats = final.beat + final.dur;
    const dyn = { beats: melodyBeats, peak: peakNote.beat / melodyBeats, kind };
    const inHarmonics = sec.lead === 'qin' && kind !== 'B' && rng.chance(p.harmonicPhrase);
    this._line(inHarmonics ? 'harm' : sec.lead, ph.notes, map, sec.T, { role: 'lead', dyn });

    this._accompany(ph, map, this._roots(kind, ph.bars), texture);
    const countered = p.counter && rng.chance(p.counter.p) && this._counter(ph, map, sec, p.counter.inst);
    if (rng.chance(countered ? p.echo * 0.5 : p.echo)) this._echo(ph, map, sec);
    if (rng.chance(p.harmonics * texture)) this._breathHarmonic(ph, map);

    const bars = [];
    for (let b = 0; b <= ph.bars; b++) bars.push(map.at(b * 4));
    return {
      start: t0,
      end: map.at(ph.beats),
      kind: 'phrase',
      phrase: kind,
      variant: ph.variant,
      bars,
      nBars: ph.bars,
      lead: inHarmonics ? 'qin-harmonics' : sec.lead,
      notes: ph.notes.length,
      bpm: Math.round(bpm * 10) / 10,
    };
  }

  // Bass centre per bar (degree offset from the tonic): B leans on the fifth or fourth.
  _roots(kind, bars) {
    const roots = new Array(bars).fill(0);
    const rng = this.rng;
    if (kind === 'B') {
      const alt = rng.chance(0.65) ? this.mode.fifth : this.mode.fourth;
      const upto = bars - (rng.chance(0.5) ? 1 : 0);
      for (let b = 0; b < upto; b++) roots[b] = alt;
    } else if (kind === 'A1' && bars >= 3 && rng.chance(0.25)) {
      roots[1] = this.mode.fifth;
    }
    return roots;
  }

  // --- melodic lines ----------------------------------------------------------------

  _line(inst, notes, map, T, opts) {
    if (inst === 'xiao') this._xiaoLine(notes, map, T, opts);
    else if (inst === 'harm') this._harmLine(notes, map, T, opts);
    else this._stringLine(inst, notes, map, T, opts);
  }

  _xiaoLine(notes, map, T, opts) {
    const rng = this.rng;
    const orn = this.preset.ornament;
    const mode = this.mode;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const prev = notes[i - 1];
      const next = notes[i + 1];
      const midi = mode.midi(T + n.deg);
      let t = map.at(n.beat) + this._jitter();
      const tEnd = map.at(n.beat + n.dur);
      const joined = prev && Math.abs(prev.beat + prev.dur - n.beat) < 1e-6;
      const nextJoined = next && Math.abs(n.beat + n.dur - next.beat) < 1e-6;
      const legato = joined && prev.deg !== n.deg && rng.chance(0.85);
      let dur = tEnd - t + (nextJoined ? 0.05 : -Math.min(0.12, 0.2 * (tEnd - t)));
      const ev = {
        legato,
        tongue: joined && !legato,
        attack: joined ? rng.float(0.06, 0.1) : rng.float(0.12, 0.25),
        porta: rng.float(0.06, 0.15),
        release: n.final ? rng.float(0.4, 0.7) : 0.3,
      };
      if (legato && n.dur >= 1 && rng.chance(0.22 * orn)) {
        // 倚音: lean in from the upper neighbour, main note lands on the beat.
        const time = rng.float(0.05, 0.08);
        ev.grace = { midi: mode.midi(T + n.deg + 1), time };
        ev.porta = rng.float(0.03, 0.045); // reach the grace pitch before it resolves
        t -= time;
        dur += time;
      }
      if (tEnd - t > 0.9) ev.vib = { depth: rng.float(10, 20), rate: rng.float(4.5, 5.5), delay: rng.float(0.35, 0.45) };
      ev.role = opts.role;
      this._note(t, 'xiao', midi, this._vel(0.78, n, opts), dur, ev);
    }
  }

  _stringLine(inst, notes, map, T, opts) {
    const rng = this.rng;
    const p = this.preset;
    const orn = p.ornament;
    const mode = this.mode;
    const qin = inst === 'qin';
    let skip = -1;
    for (let i = 0; i < notes.length; i++) {
      if (i === skip) continue;
      const n = notes[i];
      const next = notes[i + 1];
      const midi = mode.midi(T + n.deg);
      const t = map.at(n.beat) + this._jitter();
      const len = map.at(n.beat + n.dur) - t;
      const vel = this._vel(qin ? 0.8 : 0.72, n, opts);
      const ev = { role: opts.role };
      let span = len;
      if (n.dur >= 0.75 && rng.chance((qin ? 0.12 : 0.18) * orn)) {
        ev.slide = { from: mode.midi(T + n.deg - 1), time: rng.float(0.08, 0.2) }; // 上滑音
      } else if (!qin && i > 0 && n.dur >= 0.5 && rng.chance(0.1 * orn)) {
        const g = rng.float(0.05, 0.08); // 倚音 as a light pluck of the upper neighbour
        this._note(t - g, inst, mode.midi(T + n.deg + 1), vel * 0.55, 0.3, { damp: 0.25, dampScale: 3, grace: true });
      }
      if (len >= (qin ? 0.8 : 1) && rng.chance(qin ? 0.8 : 0.7)) {
        ev.vib = qin
          ? { depth: rng.float(12, 25), rate: rng.float(3.5, 5), delay: rng.float(0.25, 0.4) } // 吟猱
          : { depth: rng.float(15, 30), rate: rng.float(5, 6), delay: rng.float(0.28, 0.35) }; // 揉弦
      }
      if (qin && next && n.dur >= 1 && next.deg !== n.deg && Math.abs(next.deg - n.deg) <= 2 && rng.chance(0.4)) {
        // 走手音: reach the next melody note by sliding the stopping finger instead of plucking.
        const tn = map.at(next.beat) - t;
        const time = Math.min(rng.float(0.3, 0.7), tn * 0.8);
        ev.glide = { cents: (mode.midi(T + next.deg) - midi) * 100, at: tn - time * 0.5, time, back: false, hold: 0 };
        ev.glideTo = mode.midi(T + next.deg);
        span = map.at(next.beat + next.dur) - t;
        skip = i + 1;
      } else if (qin && len > 1.2 && rng.chance(0.3 * orn)) {
        const to = mode.midi(T + n.deg + (rng.chance(0.5) ? 1 : -1)); // 进复 / 退复
        ev.glide = { cents: (to - midi) * 100, at: rng.float(0.2, 0.4), time: rng.float(0.3, 0.5), back: true, hold: rng.float(0.1, 0.3) };
        ev.glideTo = to;
      }
      if (!qin && n.final && rng.chance(0.3 * orn)) {
        const at = len * rng.float(0.6, 0.8);
        const time = rng.float(0.2, 0.4);
        const to = mode.midi(T + n.deg - 1); // 下滑音: release the press, fall to the lower string
        ev.fall = { cents: (to - midi) * 100, at, time };
        ev.fallTo = to;
        ev.damp = at + time + 0.4;
        ev.dampScale = 3;
      } else if (!qin && n.dur <= 0.5 && rng.chance(p.staccato)) {
        ev.damp = Math.max(0.08, len * rng.float(0.5, 0.7));
      } else if (!qin && p.bpm >= 70 && n.dur < 1 && !n.final) {
        ev.damp = len + 0.35; // keep fast zheng lines clear
        ev.dampScale = 4;
      }
      if (!qin && opts.role === 'lead' && n.climax && len > 0.5 && rng.chance(p.tremolo)) {
        this._tremolo(t, midi, vel, len);
        continue;
      }
      this._note(t, inst, midi, vel, span, ev);
    }
  }

  // 摇指: rapid re-plucks of one string with a swell.
  _tremolo(t0, midi, vel, len) {
    const rate = this.rng.float(12, 16);
    const count = Math.max(3, Math.floor(len * rate));
    for (let k = 0; k < count; k++) {
      const u = k / Math.max(1, count - 1);
      const v = vel * (0.6 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
      const t = t0 + k / rate + (k > 0 ? clamp(this.hum.gauss(0, 0.004), -0.008, 0.008) : 0);
      this._note(t, 'zheng', midi, v * 0.85, len - k / rate, { repluck: k > 0, tremolo: true });
    }
  }

  _harmLine(notes, map, T, opts) {
    const shift = this._octaveShift(notes, T, REGISTER.harm, false);
    for (const n of notes) {
      const t = map.at(n.beat) + this._jitter();
      const len = map.at(n.beat + n.dur) - t;
      this._note(t, 'harm', this.mode.midi(T + shift + n.deg), this._vel(0.62, n, opts), len, {
        decay: n.dur >= 2 ? 1.2 : 1,
        role: opts.role,
      });
    }
  }

  // Octave shift (in degrees) that fits `notes` into a register; optionally never 0.
  _octaveShift(notes, T, reg, avoidZero) {
    let best = 0;
    let bestScore = Infinity;
    for (let s = -15; s <= 15; s += 5) {
      let out = 0;
      let sum = 0;
      for (const n of notes) {
        const m = this.mode.midi(T + s + n.deg);
        if (m < reg.lo || m > reg.hi) out++;
        sum += m;
      }
      const score = out * 100 + (avoidZero && s === 0 ? 50 : 0) + Math.abs(sum / notes.length - reg.center);
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  // Call and response: the second instrument answers the phrase tail in another octave.
  _echo(ph, map, sec) {
    const rng = this.rng;
    const notes = ph.notes;
    const final = notes[notes.length - 1];
    const tail = notes.slice(-Math.min(notes.length, rng.int(2, 4))).map((n) => ({ ...n, climax: false }));
    const startBeat = final.beat + clamp(final.dur * 0.5, 1, 2.5);
    const avail = ph.beats + 1 - startBeat;
    if (avail < 1.5) return;
    let fixed = 0;
    for (let i = 0; i < tail.length - 1; i++) fixed += tail[i].dur;
    while (tail.length > 1 && fixed * 0.5 + 1 > avail) fixed -= tail.shift().dur;
    const scale = fixed > 0 ? Math.min(1, (avail - 1) / fixed) : 1;
    let b = startBeat;
    tail.forEach((n, i) => {
      const last = i === tail.length - 1;
      n.beat = b;
      n.dur = last ? Math.max(1, avail - (b - startBeat)) : Math.max(0.25, Math.round(n.dur * scale * 4) / 4);
      n.final = last;
      b += n.dur;
    });
    const inst = sec.second;
    const reg = REGISTER[inst] || REGISTER.zheng;
    const shift = this._octaveShift(tail, sec.T, reg, true);
    this._line(inst, tail, map, sec.T + shift, { role: 'echo', velScale: 0.8 });
  }

  // Sustained second line: one or two long notes per bar, consonant with the lead.
  _counter(ph, map, sec, inst) {
    const rng = this.rng;
    const reg = REGISTER[inst];
    const notes = ph.notes;
    const melodyEnd = notes[notes.length - 1].beat;
    const out = [];
    let prev = null;
    let b = 0;
    while (b < melodyEnd - 0.5) {
      const len = Math.min(rng.chance(0.4) ? 2 : 4, melodyEnd + 1 - b);
      let lead = notes[0];
      for (const n of notes) if (n.beat <= b + 1e-6) lead = n;
      const cands = [-5, -3, -2, 2, 3, 5]
        .map((o) => lead.deg + o)
        .filter((d) => {
          const m = this.mode.midi(sec.T + d);
          return m >= reg.lo && m <= reg.hi;
        });
      if (cands.length) {
        // Smooth voice leading, and mostly below the lead so the tune stays on top.
        const w = cands.map((c) => (prev === null ? 1 : Math.exp(-Math.abs(c - prev) / 1.5)) * (c < lead.deg ? 2.5 : 1));
        const d = rng.weighted(cands, w);
        out.push({ beat: b, dur: len, deg: d, strong: true, final: false, climax: false });
        prev = d;
      }
      b += len;
    }
    if (!out.length) return false;
    out[out.length - 1].final = true;
    this._line(inst, out, map, sec.T, { role: 'counter', velScale: 0.6 });
    return true;
  }

  // --- accompaniment ----------------------------------------------------------------

  _accompany(ph, map, roots, texture) {
    const p = this.preset;
    const rng = this.rng;
    const mode = this.mode;
    const bassT = mode.tonicNear(43);
    const arpT = mode.tonicNear(p.arpCenter || 52);
    const arpOn = rng.chance(p.arp * texture);
    const bassOn = rng.chance(p.bass * texture);
    const rate = rng.pick(p.arpRate);
    const shapes = [rng.pick(p.arpShapes), rng.pick(p.arpShapes)];
    for (let bar = 0; bar < ph.bars; bar++) {
      const b0 = bar * 4;
      const last = bar === ph.bars - 1;
      const shape = shapes[bar > 0 && rng.chance(0.3) ? 1 : 0];
      if (bassOn && (!last || rng.chance(0.5))) {
        // The left hand anticipates the beat slightly, so bass and melody attacks do not stack.
        this._bassFifth(map.at(b0) - rng.float(0.015, 0.035), this._bassRoot(bassT, roots[bar]));
      }
      if (arpOn && rng.chance(0.85)) this._arpBar(map, b0, arpT + roots[bar], rate, shape, last ? rng.pick([2, 4]) : 4, ph);
    }
    if (rng.chance(p.qinBass * texture)) {
      if (p.qinPizz) this._qinPizz(ph, map, roots);
      else this._qinBass(map.at(0) - rng.float(0.02, 0.045), roots[0], map.at(Math.min(ph.beats, 6)) - map.at(0));
    }
    if (p.muyu > 0) this._muyu(ph, map);
  }

  _bassRoot(bassT, root) {
    const a = bassT + root;
    const b = a - 5;
    return Math.abs(this.mode.midi(b) - 43) < Math.abs(this.mode.midi(a) - 43) && this.mode.midi(b) >= ZHENG_LOW ? b : a;
  }

  // Open fifth (or octave) in the bass, rolled low-to-high like a zheng player's hand.
  _bassFifth(t, deg) {
    const mode = this.mode;
    const rng = this.rng;
    const root = mode.midi(deg);
    let upper = deg + 5;
    if (rng.chance(0.7)) {
      for (const k of [3, 2]) {
        if (mode.midi(deg + k) - root === 7) {
          upper = deg + k;
          break;
        }
      }
    }
    const v = this._humVel(0.46);
    this._note(t, 'zheng', root, v, 3);
    this._note(t + rng.float(0.025, 0.06), 'zheng', mode.midi(upper), v * 0.8, 3);
  }

  _arpBar(map, b0, rootDeg, rate, shape, beats, ph) {
    const pat = ARP_PATTERNS[shape];
    const steps = Math.round(beats * rate);
    const base = 0.34 * this.preset.arpVel;
    for (let k = 0; k < steps; k++) {
      const midi = this.mode.midi(rootDeg + pat[k % pat.length]);
      if (midi > 86) continue;
      if (k % rate !== 0 && this.rng.chance(0.1)) continue; // a hand that breathes, not a sequencer
      const beat = b0 + k / rate;
      const t = map.at(beat) + this._jitter() * 0.7;
      const accent = k % rate === 0 ? 1.12 : 1;
      const swell = 0.9 + 0.2 * Math.sin(Math.PI * clamp(beat / ph.beats, 0, 1));
      this._note(t, 'zheng', midi, this._humVel(base * accent * swell), 2 / rate, rate >= 4 ? { sustain: 0.7 } : {});
    }
  }

  _qinBass(t, root, len) {
    const mode = this.mode;
    const rng = this.rng;
    const deg = this._bassRoot(mode.tonicNear(45), root);
    const midi = mode.midi(deg);
    const ev = { vib: { depth: rng.float(8, 16), rate: rng.float(3, 4.5), delay: rng.float(0.4, 0.8) } };
    if (rng.chance(0.3)) {
      const to = mode.midi(deg + 1);
      ev.glide = { cents: (to - midi) * 100, at: rng.float(0.5, 0.9), time: rng.float(0.35, 0.6), back: true, hold: rng.float(0.15, 0.4) };
      ev.glideTo = to;
    }
    this._note(t, 'qin', midi, this._humVel(0.62), len, ev);
  }

  // Short plucked qin bass on beats 1 and 3 (playful moods).
  _qinPizz(ph, map, roots) {
    const mode = this.mode;
    const rng = this.rng;
    const bassT = mode.tonicNear(45);
    const end = ph.notes[ph.notes.length - 1].beat;
    for (let b = 0; b <= end; b += 2) {
      const bar = Math.floor(b / 4);
      const root = this._bassRoot(bassT, roots[Math.min(bar, roots.length - 1)]);
      const deg = b % 4 === 0 ? root : root + (rng.chance(0.6) ? mode.fifth : 5);
      const t = map.at(b) - rng.float(0.01, 0.025);
      this._note(t, 'qin', mode.midi(deg), this._humVel(0.5), 0.3, { damp: rng.float(0.16, 0.24) });
    }
  }

  _muyu(ph, map) {
    const p = this.preset;
    const rng = this.rng;
    const end = ph.notes[ph.notes.length - 1].beat;
    for (let b = 1; b < end; b += 2) {
      if (!rng.chance(p.muyu)) continue;
      const freq = rng.pick([980, 1180]);
      this._emit(map.at(b) + this._jitter(), { kind: 'note', inst: 'muyu', midi: 0, freq, vel: this._humVel(0.45), dur: 0.2, pcs: null });
      if (rng.chance(p.muyu * 0.4)) {
        this._emit(map.at(b + 0.5) + this._jitter(), { kind: 'note', inst: 'muyu', midi: 0, freq, vel: this._humVel(0.35), dur: 0.2, pcs: null });
      }
    }
  }

  _breathHarmonic(ph, map) {
    const final = ph.notes[ph.notes.length - 1];
    const b = final.beat + Math.max(1, final.dur * 0.6);
    const hT = this.mode.tonicNear(79);
    const d = hT + this.rng.pick([0, this.mode.fifth, 5, this.mode.fifth - 5]);
    this._note(map.at(b) + this._jitter(), 'harm', this.mode.midi(d), this._humVel(0.48), 3);
  }

  // --- glissandi ----------------------------------------------------------------------

  // 刮奏 across consecutive pentatonic strings: slow-fast-slow timing with a velocity swell.
  _gliss(t0, dur, from, to, vel, { cue = false, rng = this.rng } = {}) {
    const n = Math.abs(to - from) + 1;
    const dir = to >= from ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : k / (n - 1);
      const t = t0 + dur * (u + (0.55 * Math.sin(TAU * u)) / TAU);
      const v = vel * (0.5 + 0.5 * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * u)), 0.8));
      const midi = this.mode.midi(from + dir * k);
      if (midi < ZHENG_LOW || midi > ZHENG_HIGH) continue;
      const jitter = k > 0 ? clamp(rng.gauss(0, 0.003), -0.006, 0.006) : 0;
      this._note(t + jitter, 'zheng', midi, v, 1.2, { sustain: 0.85, cue, gliss: true });
    }
    return t0 + dur;
  }

  _pickupGliss(t0) {
    const rng = this.rng;
    const mode = this.mode;
    const dur = rng.float(0.8, 1.3);
    const land = mode.tonicNear(rng.pick([62, 69]));
    const n = rng.int(10, 15);
    let from = land - (n - 1);
    while (mode.midi(from) < 43) from++;
    this._gliss(t0 - dur - 0.03, dur, from, land, rng.float(0.4, 0.52));
  }

  // --- interludes and transitions -----------------------------------------------------

  _interlude(t0) {
    const p = this.preset;
    const rng = this.rng;
    const mode = this.mode;
    const type = weightedKey(rng, p.interlude);
    const len = rng.float(p.interludeSec[0], p.interludeSec[1]);
    if (type === 'harmonics') {
      const hT = mode.tonicNear(79);
      const pool = [0, 1, mode.fifth, 5, mode.fifth - 5, 2];
      const count = rng.int(3, 5);
      let t = t0 + rng.float(0.3, 1);
      let prev = null;
      for (let i = 0; i < count && t < t0 + len - 1.5; i++) {
        let d = hT + rng.pick(pool);
        if (d === prev) d = hT + (d === hT ? 5 : 0);
        this._note(t, 'harm', mode.midi(d), this._humVel(0.5), 3);
        prev = d;
        t += rng.float(1.2, 2.4);
      }
    } else if (type === 'zhengArp') {
      const chords = rng.int(2, 3);
      const rootT = mode.tonicNear(50);
      for (let c = 0; c < chords; c++) {
        let t = t0 + 0.3 + (c * Math.max(3, len - 2)) / chords;
        const root = rootT + (c === 1 && rng.chance(0.5) ? mode.fifth - 5 : 0);
        const offs = rng.pick([[0, 3, 5, 6, 7], [0, 3, 5, 7, 8, 10], [0, 5, 7, 8, 10]]);
        let gap = rng.float(0.14, 0.22);
        for (const o of offs) {
          this._note(t, 'zheng', mode.midi(root + o), this._humVel(0.36), 2.5);
          t += gap;
          gap *= rng.float(1.08, 1.2); // rubato: each string a little later
        }
      }
    } else if (type === 'qin') {
      const count = rng.int(1, 3);
      let t = t0 + rng.float(0.3, 1);
      for (let i = 0; i < count && t < t0 + len - 2; i++) {
        this._qinBass(t, rng.pick([0, 0, mode.fifth]), 3.5);
        t += rng.float(2.5, 4);
      }
    } else if (rng.chance(0.4)) {
      const d = mode.tonicNear(79) + rng.pick([0, 5]);
      this._note(t0 + len * rng.float(0.4, 0.7), 'harm', mode.midi(d), this._humVel(0.36), 3);
    }
    return { start: t0, end: t0 + len, kind: 'interlude', type };
  }

  _transition(t0) {
    const name = this.pending;
    this.pending = null;
    const prevMode = this.mode;
    const last = this.units[this.units.length - 1];
    const chained = last && last.kind === 'transition' && last.end >= t0 - 0.05;
    this.presetName = name;
    this.preset = PRESETS[name];
    this.homeMode = modeOf(this.preset);
    this.mode = this.homeMode;
    this.section = null;
    this.afterTransition = true;
    this._emit(t0, { kind: 'mix', mood: name });
    let end = t0 + 0.4;
    let gesture = 'none';
    if (!chained) {
      gesture = weightedKey(this.rng, this.preset.transition);
      end = gesture === 'gliss' ? this._glissGesture(t0) : this._harmonicGesture(t0, prevMode);
    }
    return { start: t0, end, kind: 'transition', to: name, gesture };
  }

  _glissGesture(t0) {
    const rng = this.rng;
    const mode = this.mode;
    const land = mode.tonicNear(74);
    const n = rng.int(14, 19);
    let from = land - (n - 1);
    while (mode.midi(from) < 40) from++;
    const tLand = this._gliss(t0, rng.float(1, 1.5), from, land, rng.float(0.48, 0.6));
    this._note(tLand + 0.05, 'zheng', mode.midi(mode.tonicNear(43)), 0.5, 3);
    return tLand + rng.float(1.4, 2.4);
  }

  // Harmonics that pivot on a tone common to the old and new collections, then the new tonic.
  _harmonicGesture(t0, prevMode) {
    const rng = this.rng;
    const mode = this.mode;
    const hT = mode.tonicNear(79);
    const pool = [hT + mode.fifth, hT + 1, hT + 2, hT + 5, hT + mode.fifth - 5]
      .filter((d) => mode.midi(d) >= 67 && mode.midi(d) <= 93);
    const common = pool.filter((d) => prevMode.contains(mode.midi(d)));
    const first = rng.pick(common.length ? common : pool);
    const second = rng.pick([hT + mode.fifth, hT + 5].filter((d) => d !== first));
    let t = t0;
    for (const d of [first, second, hT]) {
      this._note(t, 'harm', mode.midi(d), rng.float(0.5, 0.62), 2.5);
      t += rng.float(0.8, 1.2);
    }
    this._note(t - 0.9, 'qin', mode.midi(mode.tonicNear(45)), 0.55, 4, {
      vib: { depth: 10, rate: 3.8, delay: 0.6 },
    });
    return t + rng.float(0.8, 1.6);
  }
}
