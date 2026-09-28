// Melody generation: motifs and 起承转合 phrases as scale-degree sequences.
// Degrees are relative to the lead's tonic (0 = tonic, 5 = octave above); the composer maps
// them through the current Mode, so every pitch is pentatonic by construction.

import { clamp, lerp } from './dsp.js';

const mod5 = (d) => ((d % 5) + 5) % 5;

// Weight of a melodic step by size in degrees: steps dominate, leaps are occasional.
const STEP_WEIGHTS = [0.07, 1, 0.45, 0.12, 0.06];

// Two-beat rhythm cells (in beats) with weights for [slow, medium, fast] tempo classes.
const CELLS = [
  { d: [2], w: [3, 1.5, 0.6] },
  { d: [1, 1], w: [3, 3, 2] },
  { d: [1.5, 0.5], w: [2.5, 2, 1.5] }, // dotted quarter + eighth
  { d: [0.5, 0.5, 1], w: [1.5, 2.5, 3] }, // eighth-eighth-quarter
  { d: [0.75, 0.25, 1], w: [1.5, 2, 2] }, // dotted eighth + sixteenth
  { d: [1, 0.5, 0.5], w: [1.5, 2, 2.5] },
  { d: [1, 0.25, 0.25, 0.5], w: [0.8, 1.2, 1.5] }, // quarter + two sixteenths + eighth
  { d: [0.5, 0.5, 0.5, 0.5], w: [0.3, 1, 2] },
  { d: [0.25, 0.25, 0.5, 1], w: [0.2, 0.6, 1.2] },
  { d: [0.75, 0.25, 0.5, 0.5], w: [0.3, 1, 1.5] },
  { d: [0.5, 1, 0.5], w: [0.4, 0.6, 0.8] },
  { d: [0.5, 0.25, 0.25, 1], w: [0.2, 0.6, 1.2] },
];
const ONE_BEAT = [
  { d: [1], w: [3, 2, 1.5] },
  { d: [0.5, 0.5], w: [1, 2, 2.5] },
  { d: [0.75, 0.25], w: [1, 1.5, 1.5] },
];
const CLASS = { slow: 0, medium: 1, fast: 2 };

export function contrastClass(cls, rng) {
  if (cls === 'slow') return 'medium';
  if (cls === 'fast') return 'medium';
  return rng.chance(0.5) ? 'slow' : 'fast';
}

function pickCell(rng, cells, cls, density) {
  const ci = CLASS[cls] ?? 1;
  const weights = cells.map((c) => c.w[ci] * Math.pow(density, c.d.length - 2));
  return rng.weighted(cells, weights).d;
}

// Fill `beats` with rhythm cells; returns note durations.
export function pickRhythm(rng, beats, cls, density) {
  const out = [];
  let left = beats;
  while (left >= 2 - 1e-9) {
    out.push(...pickCell(rng, CELLS, cls, density));
    left -= 2;
  }
  if (left >= 1 - 1e-9) {
    out.push(...pickCell(rng, ONE_BEAT, cls, density));
    left -= 1;
  }
  if (left > 1e-9) out.push(left);
  return out;
}

function isStrong(beat, dur) {
  const inBar = beat % 4;
  return dur >= 1.5 || Math.abs(inBar) < 1e-6 || Math.abs(inBar - 2) < 1e-6;
}

// Guided random walk over degrees: mostly steps, leaps recover in the opposite direction,
// pulled toward an arch contour and toward structural tones on strong beats. With cadence,
// the last degree is `end` and the one before approaches it by step.
export function walk(rng, o) {
  const degs = [o.start];
  let last = o.prevStep || 0;
  const n = o.count;
  for (let i = 1; i < n; i++) {
    const prev = degs[i - 1];
    if (o.cadence && i === n - 1) {
      degs.push(o.end);
      break;
    }
    const t = i / Math.max(1, n - 1);
    const target = t <= o.peakAt
      ? lerp(o.start, o.peak, t / Math.max(1e-6, o.peakAt))
      : lerp(o.peak, o.end, (t - o.peakAt) / Math.max(1e-6, 1 - o.peakAt));
    const cands = [];
    const ws = [];
    for (let s = -4; s <= 4; s++) {
      const d = prev + s;
      if (d < o.lo || d > o.hi) continue;
      const size = Math.abs(s);
      const same = s !== 0 && Math.sign(s) === Math.sign(last);
      let w = STEP_WEIGHTS[size];
      if (s === 0 && i >= 2 && degs[i - 2] === prev) w = 0; // never three in a row
      // A leap is recovered by step in the opposite direction; no chains of leaps.
      if (Math.abs(last) >= 3 && (s === 0 || same || size > 2)) w *= 0.001;
      if (Math.abs(last) === 2 && (size >= 3 || (same && size === 2))) w *= 0.3;
      // Discourage ping-pong (A B A B) and reward short scalar runs.
      if (i >= 2 && d === degs[i - 2] && Math.abs(last) === 1) w *= i >= 3 && prev === degs[i - 3] ? 0.05 : 0.4;
      if (same && size === 1) w *= 1.3;
      const dev = d - target;
      w *= Math.exp(-(dev * dev) / 5);
      if (o.strong && o.strong[i]) {
        const m = mod5(d);
        if (m === 0 || m === o.fifth) w *= 1.8;
        if (o.lean !== undefined && m === o.lean) w *= 1.5;
      }
      if (o.cadence && i === n - 2) {
        const gap = Math.abs(d - o.end);
        w *= gap === 1 ? 4 : gap === 2 ? 0.35 : gap === 0 ? 0.03 : 0.01;
      }
      cands.push(d);
      ws.push(w);
    }
    const d = cands.length ? rng.weighted(cands, ws) : clamp(prev, o.lo, o.hi);
    last = d - prev;
    degs.push(d);
  }
  return degs;
}

// Closest instance (any octave) of a degree class to `from`, inside [lo, hi].
function nearestOfClass(cls, from, lo, hi) {
  let best = null;
  for (let oct = -3; oct <= 3; oct++) {
    const d = mod5(cls) + oct * 5;
    if (d < lo || d > hi) continue;
    if (best === null || Math.abs(d - from) < Math.abs(best - from)) best = d;
  }
  return best === null ? clamp(cls, lo, hi) : best;
}

// A one-bar motif: rhythm plus a small contour (arch, rise, fall or turn).
export function makeMotif(rng, ctx) {
  let durs = pickRhythm(rng, 4, ctx.rhythm, ctx.density);
  for (let tries = 0; tries < 6 && (durs.length < 2 || durs.length > 6); tries++) {
    durs = pickRhythm(rng, 4, ctx.rhythm, ctx.density);
  }
  const startCls = rng.weighted([0, ctx.fifth, 2, 1, 5, ctx.fifth - 5, -1], [3, 2.5, 1, 0.8, 0.4, 1.2, 0.6]);
  const start = clamp(startCls, ctx.lo + 1, ctx.hi - 3);
  const shape = rng.weighted(['arch', 'rise', 'fall', 'valley', 'turn'], [3, 2, 2, 1.5, 0.8]);
  let peak = start;
  let peakAt = 0.5;
  let end = start;
  if (shape === 'arch') {
    peak = start + rng.int(1, 3);
    end = start + rng.int(-1, 1);
  } else if (shape === 'rise') {
    end = start + rng.int(2, 3);
    peak = end;
    peakAt = 0.99;
  } else if (shape === 'fall') {
    end = start - rng.int(2, 3);
    peakAt = 0.01;
  } else if (shape === 'valley') {
    peak = start - rng.int(1, 2); // a dip that comes back up
    end = start + rng.int(0, 1);
  } else {
    peak = start + 1;
    peakAt = 0.3;
    end = start - rng.int(0, 1);
  }
  let beat = 0;
  const strong = durs.map((d) => {
    const s = isStrong(beat, d);
    beat += d;
    return s;
  });
  const degs = walk(rng, {
    count: durs.length, start, end, peak, peakAt, lo: ctx.lo, hi: ctx.hi, strong, fifth: ctx.fifth, cadence: false,
  });
  return { durs, degs, shape };
}

// Durations + degrees from `from` (exclusive) to a cadence on one of `targets` (degree classes).
function tail(rng, ctx, o) {
  const mid = o.restBeats > 1e-9 ? pickRhythm(rng, o.restBeats, o.rhythm || ctx.rhythm, ctx.density) : [];
  const durs = [...mid, o.finalDur];
  const reach = mid.length + 1;
  const cands = o.targets.map((c) => nearestOfClass(c.cls, o.from, ctx.lo, ctx.hi));
  const ws = o.targets.map((c, i) => c.w * (Math.abs(cands[i] - o.from) <= reach + 1 ? 1 : 0.05));
  const end = o.forceEnd !== undefined ? o.forceEnd : rng.weighted(cands, ws);
  const hiNote = Math.max(o.from, end);
  const peak = clamp(o.peak !== undefined ? o.peak : hiNote + rng.int(0, 2), ctx.lo, ctx.hi);
  let beat = o.startBeat;
  const strong = [false, ...durs.map((d) => {
    const s = isStrong(beat, d);
    beat += d;
    return s;
  })];
  const degs = walk(rng, {
    count: durs.length + 1,
    start: o.from,
    end,
    peak,
    peakAt: o.peakAt ?? 0.5,
    lo: ctx.lo,
    hi: ctx.hi,
    strong,
    fifth: ctx.fifth,
    lean: o.lean,
    cadence: true,
    prevStep: o.prevStep,
  });
  return { durs, degs: degs.slice(1) };
}

// Final-note length compatible with the space left after the head.
function finalLength(rng, room, options) {
  const fits = options.filter((f) => f <= room + 1e-9);
  return fits.length ? rng.pick(fits) : room;
}

function variedRhythm(rng, motif, ctx) {
  for (let i = 0; i < 12; i++) {
    const d = pickRhythm(rng, 4, ctx.rhythm, ctx.density);
    if (d.length === motif.durs.length && d.some((x, k) => x !== motif.durs[k])) return d;
  }
  // Dot the first even pair instead: [1, 1] -> [1.5, 0.5], [0.5, 0.5] -> [0.75, 0.25].
  const d = motif.durs.slice();
  for (let k = 0; k + 1 < d.length; k++) {
    if (d[k] === d[k + 1] && d[k] >= 0.5) {
      d[k] *= 1.5;
      d[k + 1] *= 0.5;
      break;
    }
  }
  return d;
}

// Fill leaps inside the motif with passing tones by splitting the longer note.
function ornamentHead(durs, degs) {
  const outD = [];
  const outG = [];
  for (let k = 0; k < durs.length; k++) {
    const next = degs[k + 1];
    if (next !== undefined && Math.abs(next - degs[k]) === 2 && durs[k] >= 1) {
      outD.push(durs[k] - 0.5, 0.5);
      outG.push(degs[k], (degs[k] + next) / 2);
    } else {
      outD.push(durs[k]);
      outG.push(degs[k]);
    }
  }
  return { durs: outD, degs: outG };
}

/**
 * Builds one phrase of a section.
 * kind: 'A' (起), 'A1' (承), 'B' (转), 'A2' (合)
 * ctx:  { rhythm, density, fifth, fourth, lo, hi, bars, breath }
 * sec:  { motif, aEnd } shared state of the section
 * Returns { beats, bars, notes: [{ beat, dur, deg, strong, final, climax }], variant }
 */
export function buildPhrase(rng, kind, ctx, sec) {
  let bars = rng.pick(ctx.bars);
  if (kind === 'B') bars = Math.max(bars, 3);
  let breath = rng.pick(ctx.breath);
  if (bars === 2) breath = Math.min(breath, 2);
  const beats = bars * 4;
  const melodyBeats = beats - breath;
  const motif = sec.motif;
  const f = ctx.fifth;
  let head = { durs: motif.durs, degs: motif.degs };
  let variant = 'plain';
  let body;

  if (kind === 'A1') {
    variant = rng.weighted(['rhythm', 'ornament', 'shift'], [1, 1, 1]);
    if (variant === 'rhythm') {
      head = { durs: variedRhythm(rng, motif, ctx), degs: motif.degs };
    } else if (variant === 'ornament') {
      head = ornamentHead(motif.durs, motif.degs);
    } else {
      const shifts = [1, -1, 5, -5].filter((s) => motif.degs.every((d) => d + s >= ctx.lo && d + s <= ctx.hi));
      const s = shifts.length ? rng.weighted(shifts, shifts.map((x) => (Math.abs(x) === 5 ? 0.8 : 1))) : 0;
      head = { durs: motif.durs, degs: motif.degs.map((d) => d + s) };
      if (!s) variant = 'plain';
    }
  }

  const headBeats = head.durs.reduce((a, b) => a + b, 0);
  const from = head.degs[head.degs.length - 1];
  const prevStep = head.degs.length > 1 ? from - head.degs[head.degs.length - 2] : 0;

  if (kind === 'B') {
    // 转: new rhythmic cell, higher register, leaning on the fifth/fourth, a held climax.
    const cls = contrastClass(ctx.rhythm, rng);
    const cellDurs = pickRhythm(rng, 4, cls, ctx.density);
    const start = clamp(rng.pick([f, 5, f + 1]), ctx.lo, ctx.hi - 1);
    const climax = clamp(rng.int(5, 7), start + 1, ctx.hi);
    const lean = rng.chance(0.7) ? f : ctx.fourth;
    const climaxDur = melodyBeats >= 10 ? rng.pick([2, 2, 3]) : 1.5;
    const room = melodyBeats - 4 - climaxDur;
    const finalDur = finalLength(rng, room, [1.5, 2, 2, 3]);
    const rest = Math.max(0, room - finalDur);
    const up = walk(rng, {
      count: cellDurs.length + 1,
      start,
      end: climax,
      peak: climax,
      peakAt: 0.99,
      lo: ctx.lo,
      hi: ctx.hi,
      strong: cellDurs.map((d, k) => isStrong(cellDurs.slice(0, k).reduce((a, b) => a + b, 0), d)),
      fifth: f,
      lean,
      cadence: true,
    });
    const down = tail(rng, ctx, {
      from: climax,
      startBeat: 4 + climaxDur,
      restBeats: rest,
      finalDur,
      targets: [{ cls: f, w: 1.5 }, { cls: 1, w: 1 }],
      peak: climax,
      peakAt: 0.05,
      lean,
      prevStep: 1,
    });
    body = {
      durs: [...cellDurs, climaxDur, ...down.durs],
      degs: [...up.slice(0, -1), climax, ...down.degs],
      climaxIndex: cellDurs.length,
    };
  } else {
    const room = melodyBeats - headBeats;
    let finalOptions = [1.5, 2, 3];
    let targets;
    if (kind === 'A') {
      targets = [{ cls: 1, w: 1 }, { cls: f, w: 1.2 }];
    } else if (kind === 'A1') {
      targets = [{ cls: 0, w: 0.8 }, { cls: 1, w: 1 }, { cls: f, w: 1 }]
        .map((t) => ({ ...t, w: sec.aEnd !== undefined && mod5(sec.aEnd) === mod5(t.cls) ? t.w * 0.2 : t.w }));
    } else {
      targets = [{ cls: 0, w: 1 }];
      finalOptions = room >= 5 ? [3, 4] : [2, 3];
    }
    const finalDur = finalLength(rng, room, finalOptions);
    const rest = Math.max(0, room - finalDur);
    const motifTop = Math.max(...head.degs);
    const peak = kind === 'A2' ? motifTop + rng.int(0, 1) : motifTop + rng.int(1, 2);
    const t = tail(rng, ctx, {
      from, startBeat: headBeats, restBeats: rest, finalDur, targets, peak, peakAt: rng.float(0.35, 0.6), prevStep,
    });
    body = { durs: [...head.durs, ...t.durs], degs: [...head.degs, ...t.degs], climaxIndex: -1 };
  }

  const notes = [];
  let beat = 0;
  for (let k = 0; k < body.durs.length; k++) {
    const dur = body.durs[k];
    notes.push({ beat, dur, deg: Math.round(body.degs[k]), strong: isStrong(beat, dur), final: false, climax: false });
    beat += dur;
  }
  notes[notes.length - 1].final = true;
  if (body.climaxIndex >= 0) notes[body.climaxIndex].climax = true;
  return { beats, bars, notes, variant, endDeg: notes[notes.length - 1].deg };
}
