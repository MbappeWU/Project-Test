import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReelDirector } from '../src/core/reel.js';
import { REELS } from '../src/reels/index.js';
import { REEL_COPY } from '../src/reels/copy.js';
import { MOOD_NAMES } from '../src/music/engine.js';
import { nodeCanvas } from '../src/node/canvas.js';

const canvas = nodeCanvas();
const W = 180;
const H = 320;

// Mean absolute difference of the sand below the hook band, between two RGBA frames.
function sandDiff(a, b) {
  let sum = 0;
  let n = 0;
  for (let y = Math.round(H * 0.3); y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      n += 3;
    }
  }
  return sum / n;
}

test('every reel has metadata and TikTok copy', () => {
  const ids = new Set();
  for (const scene of REELS) {
    assert.ok(!ids.has(scene.id), `duplicate id ${scene.id}`);
    ids.add(scene.id);
    assert.ok(MOOD_NAMES.includes(scene.music), `${scene.id}: unknown mood ${scene.music}`);
    for (const key of ['title', 'hook', 'payoff', 'inscription', 'seal', 'twist']) assert.ok(scene[key], `${scene.id}: missing ${key}`);
    const copy = REEL_COPY[scene.id];
    assert.ok(copy, `${scene.id}: missing copy`);
    assert.ok([...copy.caption_en].length <= 150, `${scene.id}: caption_en over 150 characters`);
    assert.match(copy.caption_en, /made with code/, `${scene.id}: caption must disclose code generation`);
    assert.match(copy.caption_zh, /代码生成/, `${scene.id}: Chinese caption must disclose code generation`);
  }
});

test('reels open on a moving stroke, finish in 15-22 s and loop back to the first frame', () => {
  for (const scene of REELS) {
    const d = new ReelDirector({ scene, width: W, height: H, seed: 3, canvas });
    assert.equal(d.nInk, 1, `${scene.id}: needs exactly one inscription gesture`);
    assert.ok(d.duration >= 15 && d.duration <= 22, `${scene.id}: duration ${d.duration.toFixed(1)}s`);
    const fps = 15;
    let first = null;
    let early = null;
    const frames = Math.ceil(d.duration * fps);
    for (let f = 0; f < frames; f++) {
      d.update(1 / fps);
      d.render();
      if (f === 0) first = Uint8ClampedArray.from(d.frame);
      if (f === Math.round(0.5 * fps)) early = Uint8ClampedArray.from(d.frame);
    }
    assert.ok(sandDiff(first, early) > 0.05, `${scene.id}: nothing happens in the first half second`);
    assert.notEqual(d.completeAt, null, `${scene.id}: painting never completed`);
    assert.notEqual(d.finishedAt, null, `${scene.id}: loop sweep never finished`);
    assert.ok(sandDiff(first, d.frame) < 3, `${scene.id}: last frame does not return to the first (${sandDiff(first, d.frame).toFixed(2)})`);
  }
});
