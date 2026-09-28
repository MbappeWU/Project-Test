import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicEngine, MOOD_NAMES } from '../src/music/engine.js';
import { encodeWav } from '../src/music/wav.js';
import { Mode } from '../src/music/theory.js';
import { Rng } from '../src/core/rng.js';

const SR = 48000;

// Renders `seconds` of audio, splitting blocks with `nextSize()` and at every action time so
// actions (setMood, cue, setSandActivity) land on exactly the same sample in every scheme.
function renderWith(engine, seconds, nextSize, actions = []) {
  const frames = Math.round(seconds * SR);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const pending = actions.slice().sort((a, b) => a.at - b.at);
  let pos = 0;
  while (pos < frames) {
    while (pending.length && pending[0].at <= pos) pending.shift().run(engine);
    const limit = pending.length ? Math.min(pending[0].at, frames) : frames;
    const n = Math.min(nextSize(), limit - pos);
    engine.renderInto(left, right, pos, n);
    pos += n;
  }
  return { left, right };
}

function maxDiff(a, b) {
  let d = 0;
  for (let i = 0; i < a.left.length; i++) {
    d = Math.max(d, Math.abs(a.left[i] - b.left[i]), Math.abs(a.right[i] - b.right[i]));
  }
  return d;
}

function levels({ left, right }) {
  let ss = 0;
  let peak = 0;
  let finite = true;
  for (let i = 0; i < left.length; i++) {
    const l = left[i];
    const r = right[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) finite = false;
    ss += l * l + r * r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  return { finite, peak, rmsDb: 10 * Math.log10(ss / (2 * left.length) + 1e-30) };
}

const at = (seconds, extra = 0) => Math.round(seconds * SR) + extra;

test('same seed renders identical audio, different seeds differ', () => {
  const a = renderWith(new MusicEngine({ seed: 7, mood: 'bridge' }), 12, () => 1600);
  const b = renderWith(new MusicEngine({ seed: 7, mood: 'bridge' }), 12, () => 1600);
  const c = renderWith(new MusicEngine({ seed: 8, mood: 'bridge' }), 12, () => 1600);
  assert.equal(maxDiff(a, b), 0);
  assert.ok(maxDiff(a, c) > 0.01, 'different seeds should produce different music');
});

test('output is independent of block size, including mood changes and cues', () => {
  const actions = [
    { at: at(2.5, 17), run: (e) => e.cue('seal') },
    { at: at(4.1, 3), run: (e) => e.setSandActivity(0.8) },
    { at: at(6, 0), run: (e) => e.cue('gliss') },
    { at: at(8.3, 999), run: (e) => e.setMood('voyage') },
    { at: at(11.7, 5), run: (e) => e.cue('harmonic') },
    { at: at(13.2, 64), run: (e) => e.setSandActivity(0.15) },
    { at: at(16.9, 1), run: (e) => e.setMood('panda') },
    { at: at(17, 11), run: (e) => e.setMood('pine') },
    { at: at(19.3, 7), run: (e) => e.cue('gliss') },
  ];
  const seconds = 22;
  const make = () => new MusicEngine({ seed: 42, mood: 'moonrise' });
  const reference = renderWith(make(), seconds, () => Infinity, actions);
  const rng = new Rng(3);
  const schemes = { 1600: () => 1600, 997: () => 997, 128: () => 128, random: () => rng.int(1, 3000) };
  for (const [name, size] of Object.entries(schemes)) {
    const out = renderWith(make(), seconds, size, actions);
    assert.ok(maxDiff(reference, out) <= 1e-6, `block scheme ${name} diverged`);
  }
  // Single-sample blocks over a shorter span (slow, so only the first few seconds).
  const shortActions = actions.filter((a) => a.at < at(3));
  const ref3 = renderWith(make(), 3, () => Infinity, shortActions);
  const one = renderWith(make(), 3, () => 1, shortActions);
  assert.ok(maxDiff(ref3, one) <= 1e-6, 'single-sample blocks diverged');
});

test('every mood renders finite audio with sane levels and in-scale pitches', () => {
  for (const mood of MOOD_NAMES) {
    const engine = new MusicEngine({ seed: 3, mood });
    const offScale = [];
    let notes = 0;
    engine.onEvent = (ev) => {
      if (ev.kind !== 'note' || !ev.pcs) return;
      notes++;
      for (const m of [ev.midi, ev.slide?.from, ev.grace?.midi, ev.glideTo, ev.fallTo]) {
        if (m !== undefined && !ev.pcs.includes(((m % 12) + 12) % 12)) offScale.push(`${ev.inst}:${m}`);
      }
    };
    const out = renderWith(engine, 45, () => 1600);
    const { finite, peak, rmsDb } = levels(out);
    assert.ok(finite, `${mood}: non-finite samples`);
    assert.ok(peak < 0.95, `${mood}: peak ${peak}`);
    assert.ok(rmsDb > -28 && rmsDb < -14, `${mood}: RMS ${rmsDb.toFixed(1)} dBFS outside sane band`);
    assert.ok(notes > 10, `${mood}: only ${notes} notes`);
    assert.deepEqual(offScale, [], `${mood}: out-of-scale pitches`);
  }
});

test('renders at least 10x realtime on one core (target 20x)', () => {
  const engine = new MusicEngine({ seed: 5, mood: 'voyage' });
  renderWith(engine, 2, () => 1600); // warm up the JIT
  const seconds = 30;
  const t0 = performance.now();
  renderWith(engine, seconds, () => 1600);
  const speed = (seconds * 1000) / (performance.now() - t0);
  console.log(`# music render speed: ${speed.toFixed(1)}x realtime (voyage, 48 kHz)`);
  assert.ok(speed >= 10, `render speed ${speed.toFixed(1)}x realtime`);
});

test('setMood transitions to the new preset; unknown moods are ignored', () => {
  const engine = new MusicEngine({ seed: 11, mood: 'plum' });
  const seen = [];
  engine.onEvent = (ev, t) => seen.push({ ...ev, t });
  renderWith(engine, 6, () => 1600);
  engine.setMood('no-such-mood');
  assert.equal(engine.mood, 'plum');
  const switchAt = engine.time;
  engine.setMood('voyage');
  assert.equal(engine.mood, 'voyage');
  renderWith(engine, 14, () => 1600);
  const mix = seen.find((ev) => ev.kind === 'mix' && ev.mood === 'voyage');
  assert.ok(mix, 'mood change never reached the mixer');
  assert.ok(mix.t - switchAt <= 4.5, `transition waited ${(mix.t - switchAt).toFixed(2)} s`);
  const eShang = new Mode('E', 'shang').pcs;
  const after = seen.filter((ev) => ev.kind === 'note' && ev.pcs && ev.t > mix.t + 0.01 && !ev.cue);
  assert.ok(after.length > 0, 'no notes after the transition');
  const home = after.filter((ev) => ev.pcs.every((pc) => eShang.includes(pc)));
  assert.ok(home.length > after.length * 0.5, 'new mood is not using its own collection');
});

test('cues fire on the next sample', () => {
  for (const [name, inst] of [['seal', 'qing'], ['gliss', 'zheng'], ['harmonic', 'harm']]) {
    const engine = new MusicEngine({ seed: 2, mood: 'garden' });
    renderWith(engine, 1.37, () => 1600);
    const cueSample = Math.round(engine.time * SR);
    const fired = [];
    engine.onEvent = (ev, t) => {
      if (ev.cue) fired.push({ inst: ev.inst, sample: Math.round(t * SR) });
    };
    engine.cue(name);
    engine.renderInto(new Float32Array(1), new Float32Array(1));
    assert.ok(fired.length > 0, `cue ${name} did not fire`);
    assert.equal(fired[0].inst, inst);
    assert.equal(fired[0].sample, cueSample);
  }
  const engine = new MusicEngine();
  engine.cue('unknown');
  assert.equal(engine.composer.queue.size, 0);
});

test('sand activity adds a quiet rustle and nothing at zero', () => {
  const quiet = renderWith(new MusicEngine({ seed: 4, mood: 'moonrise' }), 8, () => 1600);
  const busy = new MusicEngine({ seed: 4, mood: 'moonrise' });
  busy.setSandActivity(1);
  const withSand = renderWith(busy, 8, () => 1600);
  const diff = { left: new Float32Array(quiet.left.length), right: new Float32Array(quiet.left.length) };
  for (let i = 0; i < diff.left.length; i++) {
    diff.left[i] = withSand.left[i] - quiet.left[i];
    diff.right[i] = withSand.right[i] - quiet.right[i];
  }
  const tail = { left: diff.left.subarray(SR), right: diff.right.subarray(SR) };
  const { rmsDb } = levels(tail);
  assert.ok(rmsDb > -36 && rmsDb < -28, `rustle at full activity: ${rmsDb.toFixed(1)} dBFS`);
  const zero = new MusicEngine({ seed: 4, mood: 'moonrise' });
  zero.setSandActivity(0);
  assert.equal(maxDiff(quiet, renderWith(zero, 8, () => 1600)), 0);
});

test('render() returns fresh buffers and advances time', () => {
  const engine = new MusicEngine({ sampleRate: 44100, seed: 1 });
  const { left, right } = engine.render(4410);
  assert.ok(left instanceof Float32Array && right instanceof Float32Array);
  assert.equal(left.length, 4410);
  assert.ok(Math.abs(engine.time - 0.1) < 1e-9);
  assert.ok(MOOD_NAMES.includes('moonrise') && MOOD_NAMES.length === 11);
});

test('encodeWav writes a valid 16-bit stereo PCM file', () => {
  const left = new Float32Array([0, 0.5, -1, 1]);
  const right = new Float32Array([0, -0.5, 1, -1]);
  const bytes = encodeWav(left, right, 48000);
  const view = new DataView(bytes.buffer);
  const text = (o, n) => String.fromCharCode(...bytes.subarray(o, o + n));
  assert.equal(bytes.length, 44 + 16);
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 16);
  assert.ok(Math.abs(view.getInt16(48, true) - 16384) <= 1);
  assert.ok(Math.abs(view.getInt16(52, true) + 32767) <= 1);
});
