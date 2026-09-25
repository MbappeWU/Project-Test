#!/usr/bin/env node
// Renders SandScroll music to WAV files and prints listening-proxy metrics.
//
//   node tools/music-demo.mjs [--seconds 90] [--mood moonrise|all] [--out DIR] [--seed 1]
//
// Per mood: RMS, peak, % samples above -6 dBFS, DC offset, notes/minute, render speed,
// out-of-scale pitches, energy above 12 kHz, largest sample-to-sample jump.
// With --mood all it also renders a walkthrough that changes mood every ~45 s with cues.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { MusicEngine, MOOD_NAMES } from '../src/music/engine.js';
import { encodeWav } from '../src/music/wav.js';

const SR = 48000;
const BLOCK = 1600; // 48 kHz / 30 fps, as the video renderer does

function parseArgs(argv) {
  const opts = { seconds: 90, mood: 'all', out: join(tmpdir(), 'sandscroll-music'), seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key in opts) opts[key] = typeof opts[key] === 'number' ? Number(argv[++i]) : argv[++i];
  }
  return opts;
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

// In-place radix-2 FFT.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const br = re[b] * cr - im[b] * ci;
        const bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

// Long-term average spectrum: share of energy above 12 kHz and the strongest narrow peak there
// relative to its neighbourhood (aliasing would show up as tonal spikes).
function highBand(left, right) {
  const n = 4096;
  const acc = new Float64Array(n / 2);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let frames = 0;
  for (let s = 0; s + n <= left.length; s += n) {
    for (let i = 0; i < n; i++) {
      re[i] = 0.5 * (left[s + i] + right[s + i]) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < n / 2; i++) acc[i] += re[i] * re[i] + im[i] * im[i];
    frames++;
  }
  let total = 0;
  let high = 0;
  const k12 = Math.round((12000 * n) / SR);
  for (let i = 1; i < n / 2; i++) {
    total += acc[i];
    if (i >= k12) high += acc[i];
  }
  let spike = 0;
  for (let i = k12 + 8; i < n / 2 - 8; i++) {
    const around = [];
    for (let j = i - 8; j <= i + 8; j++) if (Math.abs(j - i) > 2) around.push(acc[j]);
    around.sort((a, b) => a - b);
    const med = around[around.length >> 1] || 1e-30;
    spike = Math.max(spike, acc[i] / med);
  }
  return { highDb: frames ? 10 * Math.log10(high / total) : -Infinity, spikeDb: 10 * Math.log10(spike || 1) };
}

function metrics(left, right, seconds, notes, renderMs) {
  let ss = 0;
  let peak = 0;
  let over = 0;
  let sum = 0;
  let jump = 0;
  const thr = 10 ** (-6 / 20);
  for (let i = 0; i < left.length; i++) {
    const l = left[i];
    const r = right[i];
    ss += l * l + r * r;
    sum += l + r;
    const al = Math.abs(l);
    const ar = Math.abs(r);
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
    if (al > thr) over++;
    if (ar > thr) over++;
    if (i > 0) jump = Math.max(jump, Math.abs(l - left[i - 1]), Math.abs(r - right[i - 1]));
  }
  const n = left.length * 2;
  return {
    rmsDb: db(Math.sqrt(ss / n)),
    peakDb: db(peak),
    overPct: (100 * over) / n,
    dc: sum / n,
    notesPerMin: (notes * 60) / seconds,
    speed: (seconds * 1000) / renderMs,
    jump,
    ...highBand(left, right),
  };
}

function render(engine, seconds, actions = []) {
  const frames = Math.round(seconds * SR);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const pending = actions.map((a) => ({ ...a, at: Math.round(a.t * SR) })).sort((a, b) => a.at - b.at);
  const t0 = performance.now();
  let pos = 0;
  while (pos < frames) {
    while (pending.length && pending[0].at <= pos) pending.shift().run(engine);
    const limit = pending.length ? Math.min(pending[0].at, frames) : frames;
    const n = Math.min(BLOCK, limit - pos);
    engine.renderInto(left, right, pos, n);
    pos += n;
  }
  return { left, right, ms: performance.now() - t0 };
}

// Every composed pitch (and ornament target) must belong to the pentatonic set it was written in.
function pitchChecker() {
  const stats = { checked: 0, bad: [] };
  const inSet = (pcs, midi) => pcs.includes(((Math.round(midi) % 12) + 12) % 12);
  const hook = (ev, t) => {
    if (ev.kind !== 'note' || !ev.pcs) return;
    const pitches = [ev.midi, ev.slide?.from, ev.grace?.midi, ev.glideTo, ev.fallTo].filter((m) => m !== undefined);
    for (const m of pitches) {
      stats.checked++;
      if (!inSet(ev.pcs, m)) stats.bad.push({ t: t.toFixed(2), inst: ev.inst, midi: m });
    }
  };
  return { stats, hook };
}

function row(name, m, pitch) {
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
  return [
    name.padEnd(12),
    f(m.rmsDb).padStart(6),
    f(m.peakDb).padStart(6),
    f(m.overPct, 2).padStart(6),
    m.dc.toExponential(1).padStart(9),
    f(m.notesPerMin, 0).padStart(6),
    `${f(m.speed, 1)}x`.padStart(7),
    `${pitch.bad.length}/${pitch.checked}`.padStart(9),
    f(m.highDb).padStart(7),
    f(m.spikeDb).padStart(6),
    f(m.jump, 3).padStart(6),
  ].join(' ');
}

const HEADER = [
  'mood'.padEnd(12), 'rmsdB'.padStart(6), 'peak'.padStart(6), '>-6dB%'.padStart(6), 'dc'.padStart(9),
  'n/min'.padStart(6), 'speed'.padStart(7), 'offscale'.padStart(9), '>12k dB'.padStart(7), 'spike'.padStart(6),
  'jump'.padStart(6),
].join(' ');

function renderMood(mood, opts, trace) {
  const engine = new MusicEngine({ sampleRate: SR, seed: opts.seed, mood });
  const pitch = pitchChecker();
  engine.onEvent = pitch.hook;
  if (trace) engine.composer.trace = [];
  engine.setSandActivity(0.35);
  const out = render(engine, opts.seconds, [
    { t: opts.seconds * 0.3, run: (e) => e.setSandActivity(0.8) },
    { t: opts.seconds * 0.55, run: (e) => e.setSandActivity(0.1) },
  ]);
  writeFileSync(join(opts.out, `${mood}.wav`), encodeWav(out.left, out.right, SR));
  const m = metrics(out.left, out.right, opts.seconds, engine.stats.notes, out.ms);
  return { m, pitch: pitch.stats, trace: engine.composer.trace };
}

function renderWalkthrough(opts) {
  const moods = ['moonrise', 'wall', 'voyage', 'bridge', 'panda', 'finale', 'pine', 'plum', 'river'];
  const step = 45;
  const seconds = Math.max(opts.seconds, step * moods.length);
  const engine = new MusicEngine({ sampleRate: SR, seed: opts.seed, mood: moods[0] });
  const pitch = pitchChecker();
  engine.onEvent = pitch.hook;
  const actions = [];
  moods.slice(1).forEach((m, i) => actions.push({ t: step * (i + 1), run: (e) => e.setMood(m) }));
  for (let t = 20; t < seconds; t += 60) {
    actions.push({ t, run: (e) => e.cue('harmonic') });
    actions.push({ t: t + 17, run: (e) => e.cue('gliss') });
    actions.push({ t: t + 33, run: (e) => e.cue('seal') });
  }
  for (let t = 5; t < seconds; t += 13) actions.push({ t, run: (e) => e.setSandActivity(((t * 7) % 10) / 10) });
  const out = render(engine, seconds, actions);
  writeFileSync(join(opts.out, 'walkthrough.wav'), encodeWav(out.left, out.right, SR));
  return { m: metrics(out.left, out.right, seconds, engine.stats.notes, out.ms), pitch: pitch.stats, seconds };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  opts.out = resolve(opts.out);
  mkdirSync(opts.out, { recursive: true });
  const moods = opts.mood === 'all' ? MOOD_NAMES : opts.mood.split(',');
  const unknown = moods.filter((m) => !MOOD_NAMES.includes(m));
  if (unknown.length) {
    console.error(`Unknown mood(s): ${unknown.join(', ')}. Known: ${MOOD_NAMES.join(', ')}`);
    process.exit(1);
  }
  console.log(`Rendering ${opts.seconds}s per mood at ${SR} Hz, seed ${opts.seed} -> ${opts.out}\n`);
  console.log(HEADER);
  let offscale = 0;
  for (const mood of moods) {
    const { m, pitch, trace } = renderMood(mood, opts, moods.length === 1);
    offscale += pitch.bad.length;
    console.log(row(mood, m, pitch));
    if (trace) {
      console.log('\nstructure:');
      for (const u of trace.filter((x) => !x.cancelled)) {
        const what = u.kind === 'phrase' ? `${u.phrase} ${u.variant} ${u.lead} ${u.nBars} bars ${u.bpm} bpm` : u.type || `${u.to} via ${u.gesture}`;
        console.log(`  ${u.start.toFixed(1).padStart(6)}–${u.end.toFixed(1).padEnd(6)} ${u.kind.padEnd(10)} ${what}  [${u.mode}]`);
      }
    }
  }
  if (opts.mood === 'all') {
    const w = renderWalkthrough(opts);
    offscale += w.pitch.bad.length;
    console.log(row(`walk ${w.seconds}s`, w.m, w.pitch));
  }
  if (offscale) console.log(`\n${offscale} out-of-scale pitches found`);
  console.log(`\nWAV files written to ${opts.out}`);
}

main();
