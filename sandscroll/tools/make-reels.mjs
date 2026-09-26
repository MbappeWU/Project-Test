#!/usr/bin/env node
// Renders the loopable "沙画变身 · Sand Twist" TikTok reels (1080x1920, H.264 + AAC, under 9 MB).
//   node tools/make-reels.mjs [--only koi,cat] [--out reels] [--seed 2026] [--preview] [--snap 2]
// Writes one MP4 per reel plus reels.json (cover time, captions, hashtags, encoding) for posting.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ReelDirector } from '../src/core/reel.js';
import { MusicEngine } from '../src/music/engine.js';
import { REELS, REEL_SERIES } from '../src/reels/index.js';
import { REEL_COPY } from '../src/reels/copy.js';
import { nodeCanvas, savePng } from '../src/node/canvas.js';
import { rawInputArgs, startFfmpeg, write, interleave } from '../src/node/encoder.js';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    out: { type: 'string', default: 'reels' },
    seed: { type: 'string', default: '2026' },
    fps: { type: 'string', default: '30' },
    crf: { type: 'string', default: '20' },
    gop: { type: 'string', default: '900' },
    ab: { type: 'string', default: '128k' },
    preview: { type: 'boolean' },
    snap: { type: 'string' },
  },
});

const fps = Number(args.fps);
const sampleRate = 48000;
const spf = sampleRate / fps;
const width = args.preview ? 540 : 1080;
const height = args.preview ? 960 : 1920;
const seed = Number(args.seed);
const wanted = args.only ? args.only.split(',') : null;
// A long keyframe interval is what keeps the files small: the sand grain is static, so
// repeated keyframes would re-encode the whole grain texture every couple of seconds.
const encoding = `libx264 -preset slow -crf ${args.crf} -g ${args.gop} -pix_fmt yuv420p -profile:v high; aac -b:a ${args.ab}; -movflags +faststart`;
fs.mkdirSync(args.out, { recursive: true });
const canvas = nodeCanvas();

const baseOf = (i, scene) => path.join(args.out, `R${String(i + 1).padStart(2, '0')}-${scene.id}`);

for (const [i, scene] of REELS.entries()) {
  if (wanted && !wanted.includes(scene.id)) continue;
  const base = baseOf(i, scene);
  const t0 = performance.now();
  const info = await renderReel(scene, base);
  console.log(`${path.basename(base)}: ${info.seconds.toFixed(1)}s, ${(fs.statSync(`${base}.mp4`).size / 1e6).toFixed(2)} MB, in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}
if (!args.preview) writeIndex();

async function renderReel(scene, base) {
  const director = new ReelDirector({ scene, width, height, seed, canvas });
  const music = new MusicEngine({ sampleRate, seed: seed + scene.id.length, mood: scene.music });
  director.on((event, data) => event === 'cue' && music.cue(data));
  const total = Math.ceil(director.duration * fps);
  const fadeFrames = Math.round(0.5 * fps);
  const ff = startFfmpeg([
    ...rawInputArgs({ width, height, fps, sampleRate }),
    '-c:v', 'libx264', '-preset', args.preview ? 'veryfast' : 'slow', '-crf', args.crf, '-g', args.gop, '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-c:a', 'aac', '-b:a', args.ab, '-movflags', '+faststart', '-y', `${base}.mp4`,
  ]);
  const left = new Float32Array(spf);
  const right = new Float32Array(spf);
  const snapEvery = args.snap ? Math.round(Number(args.snap) * fps) : 0;
  for (let f = 0; f < total; f++) {
    director.update(1 / fps);
    director.render();
    music.setSandActivity(director.activity);
    music.renderInto(left, right);
    // Short fade at the very end so the replay starts cleanly on the opening glissando.
    const fade = Math.min(1, (total - f) / fadeFrames);
    if (fade < 1) {
      for (let k = 0; k < spf; k++) {
        const g = Math.max(0, fade - k / spf / fadeFrames);
        left[k] *= g;
        right[k] *= g;
      }
    }
    const frame = Buffer.from(director.frame.buffer, director.frame.byteOffset, director.frame.byteLength);
    await Promise.all([write(ff.video, frame), write(ff.audio, interleave(left, right))]);
    if (snapEvery && f % snapEvery === 0) savePng(director.frame, width, height, `${base}-${String(Math.round((f / fps) * 10)).padStart(3, '0')}.png`);
  }
  ff.video.end();
  ff.audio.end();
  const code = await ff.done;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code} for ${scene.id}`);
  return { seconds: total / fps };
}

// reels.json lists every reel whose MP4 is in the output folder, so batch renders stay complete.
function writeIndex() {
  const items = [];
  for (const [i, scene] of REELS.entries()) {
    const base = baseOf(i, scene);
    if (!fs.existsSync(`${base}.mp4`)) continue;
    // Cover: the finished picture once the artist's hand has left the frame.
    const director = new ReelDirector({ scene, width: 108, height: 192, seed, canvas });
    while ((director.completeAt === null || director.stage.handVisible) && director.time < 60) {
      director.update(1 / fps);
      director.render();
    }
    const copy = REEL_COPY[scene.id];
    items.push({
      file: path.basename(`${base}.mp4`),
      size_bytes: fs.statSync(`${base}.mp4`).size,
      duration_seconds: Math.round(director.duration * 100) / 100,
      cover_time_sec: Math.ceil((director.time + 0.3) * 10) / 10,
      title: scene.title,
      theme: scene.theme,
      hook: scene.hook,
      twist: scene.twist,
      payoff: scene.payoff,
      inscription: scene.inscription,
      seal: scene.seal,
      caption_en: copy.caption_en,
      caption_zh: copy.caption_zh,
      hashtags: copy.hashtags,
      ai_generated: true,
      music: { mood: scene.music, source: 'Original, generated by the project music engine (src/music); no recordings, samples or third-party works.', license: null },
    });
  }
  const index = { series: REEL_SERIES, encoding, loop: 'The last frame sweeps back to the opening frame, so replays run on seamlessly.', items };
  fs.writeFileSync(path.join(args.out, 'reels.json'), `${JSON.stringify(index, null, 2)}\n`);
}
