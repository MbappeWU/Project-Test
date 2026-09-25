import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShortDirector, hookLines } from '../src/core/short.js';
import { SHORTS, episodeLabel } from '../src/shorts/index.js';
import { COPY } from '../src/shorts/copy.js';
import { MOOD_NAMES } from '../src/music/engine.js';
import { nodeCanvas } from '../src/node/canvas.js';

const canvas = nodeCanvas();

test('hook titles break after full-width punctuation', () => {
  assert.deepEqual(hookLines('画一轮中秋月，送给想念的人'), ['画一轮中秋月', '送给想念的人']);
  assert.deepEqual(hookLines('长城不是一天建成的'), ['长城不是一天建成的']);
});

test('every short has metadata, copy and a playable painting', () => {
  const ids = new Set();
  for (const [i, scene] of SHORTS.entries()) {
    assert.ok(!ids.has(scene.id), `duplicate id ${scene.id}`);
    ids.add(scene.id);
    assert.ok(MOOD_NAMES.includes(scene.music), `${scene.id}: unknown mood ${scene.music}`);
    for (const key of ['title', 'hook', 'poem', 'seal']) assert.ok(scene[key], `${scene.id}: missing ${key}`);
    const copy = COPY[scene.id];
    assert.ok(copy?.xhs && copy?.tiktok, `${scene.id}: missing copy`);
    assert.ok([...copy.xhs.title].length <= 20, `${scene.id}: 小红书 title too long`);
    assert.match(copy.xhs.body, /代码生成/, `${scene.id}: 小红书 copy must disclose code generation`);
    assert.match(copy.tiktok.caption, /made with code/, `${scene.id}: TikTok copy must disclose code generation`);

    const director = new ShortDirector({ scene, width: 270, height: 480, seed: 3, canvas, episode: episodeLabel(i) });
    assert.equal(director.nInk, 1, `${scene.id}: needs exactly one inscription gesture`);
    assert.ok(director.duration > 25 && director.duration < 60, `${scene.id}: duration ${director.duration.toFixed(1)}s`);
    let t = 0;
    while (director.finishedAt === null && t < 90) {
      director.update(1 / 10);
      director.render();
      t += 0.1;
    }
    assert.notEqual(director.finishedAt, null, `${scene.id}: painting never finished`);
    assert.ok(Math.abs(director.finishedAt + director.holdSeconds - director.duration) < 1.5, `${scene.id}: timing drift`);
  }
});
