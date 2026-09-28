import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalFonts } from '@napi-rs/canvas';
import { HookCut, hookLines, sandDiff } from '../src/core/hookcut.js';
import { ReelDirector } from '../src/core/reel.js';
import { Stage } from '../src/core/stage.js';
import { SHORT_VIRTUAL } from '../src/core/short.js';
import { hookSprite } from '../src/core/overlay.js';
import { HOOKTEST } from '../src/hooktest/index.js';
import { HOOKTEST_COPY } from '../src/hooktest/copy.js';
import { MOOD_NAMES } from '../src/music/engine.js';
import { nodeCanvas } from '../src/node/canvas.js';

const canvas = nodeCanvas();
const W = 90;
const H = 160;

test('hook-test reels: metadata, copy and three reels per opening', () => {
  const ids = new Set();
  const count = { A: 0, B: 0 };
  for (const scene of HOOKTEST) {
    assert.ok(!ids.has(scene.id), `duplicate id ${scene.id}`);
    ids.add(scene.id);
    assert.ok(scene.variant in count, `${scene.id}: variant must be A or B`);
    count[scene.variant]++;
    const words = scene.hook.en.split(/\s+/).filter((w) => /\w/.test(w));
    assert.ok(words.length <= 6, `${scene.id}: hook over 6 words`);
    assert.equal(scene.hook.lines.join(' ').toLowerCase(), scene.hook.en.toLowerCase(), `${scene.id}: caption lines must spell the hook`);
    if (scene.variant === 'B') assert.ok(scene.hookMark, `${scene.id}: variant B needs hookMark`);
    if (scene.guess) assert.ok(scene.cover?.mark, `${scene.id}: a guessing reel needs a cover mark`);
    assert.ok(MOOD_NAMES.includes(scene.music), `${scene.id}: unknown mood ${scene.music}`);
    for (const key of ['title', 'hook', 'payoff', 'inscription', 'seal', 'twist', 'trend', 'accent']) assert.ok(scene[key], `${scene.id}: missing ${key}`);
    const copy = HOOKTEST_COPY[scene.id];
    assert.ok(copy, `${scene.id}: missing copy`);
    assert.ok([...copy.caption_en].length <= 150, `${scene.id}: caption_en over 150 characters`);
    assert.match(copy.caption_en, /made with code/, `${scene.id}: caption must disclose code generation`);
    assert.match(copy.caption_zh, /代码生成/, `${scene.id}: Chinese caption must disclose code generation`);
  }
  assert.deepEqual(count, { A: 3, B: 3 });
});

test('hook captions are bold sans with capitals at least 5% of the frame height', { skip: !GlobalFonts.has('Anton') && 'Anton is not installed (npm run setup)' }, () => {
  const st = new Stage({ width: 1080, height: 1920, canvas, virtual: SHORT_VIRTUAL });
  const ctx = st.scratch(8, 8).getContext('2d');
  for (const scene of HOOKTEST) {
    for (const line of hookSprite(st, hookLines(scene)).lines) {
      ctx.font = line.font;
      const cap = ctx.measureText('H').actualBoundingBoxAscent;
      assert.ok(cap >= 0.05 * 1920, `${scene.id}: "${line.text}" capitals ${cap.toFixed(0)} px`);
    }
  }
});

test('hook-test cuts run 8-12 s, open on a picture and loop seamlessly', async () => {
  for (const scene of HOOKTEST) {
    const cut = new HookCut({ scene, width: W, height: H, seed: 3, canvas, music: false });
    assert.ok(cut.seconds >= 8 && cut.seconds <= 12, `${scene.id}: ${cut.seconds.toFixed(1)} s`);
    const d = new ReelDirector({ scene, width: W, height: H, seed: 3, canvas });
    d.render();
    const table = Uint8ClampedArray.from(d.frame);
    let first = null;
    await cut.render(async (rgba, i) => {
      if (i === 0) first = Uint8ClampedArray.from(rgba);
    });
    assert.ok(sandDiff(first, table, W, H) > 4, `${scene.id}: frame 0 is close to the empty table (${sandDiff(first, table, W, H).toFixed(2)})`);
    assert.ok(cut.seam < 3, `${scene.id}: last frame does not run into the first (${cut.seam.toFixed(2)})`);
    if (scene.guess) {
      const twist = Math.round(cut.plan.marks.twist * cut.fps);
      assert.ok(cut.plan.coverFrame < twist, `${scene.id}: the cover shows the answer`);
    }
  }
});
