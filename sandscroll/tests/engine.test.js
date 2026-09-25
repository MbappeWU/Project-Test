import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Show } from '../src/core/show.js';
import { SCENES, PROGRAM } from '../src/scenes/index.js';
import { polygonMask, feather } from '../src/core/mask.js';
import { SandField } from '../src/core/field.js';
import { nodeCanvas } from '../src/node/canvas.js';

const canvas = nodeCanvas();

function runScene(id, { width = 320, fps = 10, seed = 7 } = {}) {
  const show = new Show({ width, height: Math.round((width * 9) / 16), seed, canvas, program: [id], hold: 1 });
  let guard = 0;
  show.update(0);
  while (show.stage.busy && guard++ < 60 * 60 * fps) {
    show.update(1 / fps);
    show.render();
  }
  return show;
}

test('polygon mask covers the expected area with anti-aliased edges', () => {
  const m = polygonMask([[[10.5, 10.5], [30.5, 10.5], [30.5, 20.5], [10.5, 20.5]]], 64, 64);
  const area = m.a.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(area - 200) < 1, `area ${area}`);
});

test('shapes entirely off the table give empty masks without errors', () => {
  const off = polygonMask([[[500, 10], [540, 10], [540, 30]]], 100, 100);
  assert.equal(off.w * off.h, 0);
  assert.equal(feather(off, 3, 100, 100).a.length, 0);
});

test('carving moves sand to the rim instead of deleting it all', () => {
  const f = new SandField(64, 64);
  f.fill(1);
  const before = f.d.reduce((a, b) => a + b, 0);
  f.carve(32, 32, 6, 0.9, 0.5);
  const after = f.d.reduce((a, b) => a + b, 0);
  assert.ok(after < before, 'some sand removed');
  assert.ok(f.d[32 * 64 + 32] < 0.2, 'centre cleared');
  assert.ok(f.d[32 * 64 + 32 + 7] > 1, 'rim raised');
});

test('every scene in the programme draws to completion and has music', async () => {
  const { MOOD_NAMES } = await import('../src/music/engine.js');
  for (const id of PROGRAM) {
    const scene = SCENES[id];
    assert.ok(MOOD_NAMES.includes(scene.music), `${id} uses unknown mood ${scene.music}`);
    const show = runScene(id, { width: 240 });
    assert.equal(show.stage.busy, false, `${id} finished`);
    const d = show.stage.field.d;
    let sum = 0;
    for (const v of d) {
      assert.ok(Number.isFinite(v), `${id} density finite`);
      sum += v;
    }
    assert.ok(sum / d.length > 0.05, `${id} left sand on the table`);
  }
});

test('the finished picture does not depend on frame rate', () => {
  const a = runScene('greatwall', { fps: 10 }).stage.field.d;
  const b = runScene('greatwall', { fps: 24 }).stage.field.d;
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  assert.ok(max < 1e-4, `max difference ${max}`);
});

const digest = (frame) => createHash('sha1').update(frame).digest('hex');

test('same seed gives the same performance; a new seed varies it', () => {
  const a = digest(runScene('moonrise', { seed: 11 }).stage.frame);
  const b = digest(runScene('moonrise', { seed: 11 }).stage.frame);
  const c = digest(runScene('moonrise', { seed: 12 }).stage.frame);
  assert.equal(a, b);
  assert.notEqual(a, c);
});
