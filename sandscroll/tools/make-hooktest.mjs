#!/usr/bin/env node
// Renders the hook-test reels (沙画变身 · Sand Twist, batch 3, "开头改版试验"): the same reels as
// batch 2 with a new opening (src/core/hookcut.js), 8-12 s, 1080x1920, H.264, under 9 MB.
//   node tools/make-hooktest.mjs [--only tea,kite] [--out hooktest] [--seed 2026] [--preview] [--snap 1]
// Per reel: Rxx-id.mp4 with the program music and Rxx-id-nomusic.mp4, the identical video
// stream without an audio track (for a test against the platform's own music library), plus
// hooktest.json with variant, hook text, trend, accent, cover time and captions for posting.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { HookCut } from '../src/core/hookcut.js';
import { HOOKTEST, HOOKTEST_FIRST } from '../src/hooktest/index.js';
import { HOOKTEST_COPY } from '../src/hooktest/copy.js';
import { REEL_SERIES } from '../src/reels/index.js';
import { nodeCanvas, savePng } from '../src/node/canvas.js';
import { write, capArgs } from '../src/node/encoder.js';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    out: { type: 'string', default: 'hooktest' },
    seed: { type: 'string', default: '2026' },
    fps: { type: 'string', default: '30' },
    crf: { type: 'string', default: '20' },
    gop: { type: 'string', default: '900' },
    ab: { type: 'string', default: '128k' },
    'max-mb': { type: 'string', default: '9' },
    preview: { type: 'boolean' },
    snap: { type: 'string' },
  },
});

const fps = Number(args.fps);
const sampleRate = 48000;
const width = args.preview ? 540 : 1080;
const height = args.preview ? 960 : 1920;
const seed = Number(args.seed);
const wanted = args.only ? args.only.split(',') : null;
const encoding = `libx264 -preset slow -crf ${args.crf} (rate capped to stay under ${args['max-mb']} MB) -g ${args.gop} -pix_fmt yuv420p -profile:v high; aac -b:a ${args.ab} (music version only); -movflags +faststart`;
fs.mkdirSync(args.out, { recursive: true });
const canvas = nodeCanvas();

const idOf = (i, scene) => `R${String(HOOKTEST_FIRST + i).padStart(2, '0')}-${scene.id}`;

for (const [i, scene] of HOOKTEST.entries()) {
  if (wanted && !wanted.includes(scene.id)) continue;
  const base = path.join(args.out, idOf(i, scene));
  const t0 = performance.now();
  const info = await renderReel(scene, base);
  const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(2);
  console.log(`${path.basename(base)} (${scene.variant}): ${info.seconds.toFixed(2)}s, ${mb(`${base}.mp4`)} MB / ${mb(`${base}-nomusic.mp4`)} MB, cover ${info.cover}s, seam ${info.seam.toFixed(2)}, in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}
if (!args.preview) writeIndex();

async function renderReel(scene, base) {
  const cut = new HookCut({ scene, width, height, seed, canvas, fps, sampleRate });
  const nomusic = `${base}-nomusic.mp4`;
  const ff = run([
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', args.preview ? 'veryfast' : 'slow', '-crf', args.crf, ...capArgs(Number(args['max-mb']), cut.seconds, args.ab), '-g', args.gop,
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-an', '-movflags', '+faststart', '-y', nomusic,
  ]);
  const snapEvery = args.snap ? Math.round(Number(args.snap) * fps) : 0;
  await cut.render(async (rgba, i) => {
    await write(ff.stdin, Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength));
    if ((snapEvery && i % snapEvery === 0) || i === cut.plan.cover) savePng(rgba, width, height, `${base}-${i === cut.plan.cover ? 'cover' : String(Math.round((i / fps) * 10)).padStart(3, '0')}.png`);
  });
  ff.stdin.end();
  if ((await ff.done) !== 0) throw new Error(`ffmpeg failed for ${scene.id}`);
  // The music version muxes the very same video stream with the program music.
  const pcm = `${base}.f32`;
  fs.writeFileSync(pcm, Buffer.from(cut.audio.buffer, cut.audio.byteOffset, cut.audio.byteLength));
  const mux = run([
    '-i', nomusic, '-f', 'f32le', '-ar', String(sampleRate), '-ac', '2', '-i', pcm,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', args.ab, '-shortest', '-movflags', '+faststart', '-y', `${base}.mp4`,
  ]);
  mux.stdin.end();
  const code = await mux.done;
  fs.rmSync(pcm);
  if (code !== 0) throw new Error(`ffmpeg mux failed for ${scene.id}`);
  return { seconds: cut.seconds, cover: cut.coverTime, seam: cut.seam };
}

function run(ffargs) {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', ...ffargs], { stdio: ['pipe', 'inherit', 'pipe'] });
  ff.stderr.on('data', (d) => process.stderr.write(`[ffmpeg] ${d}`));
  ff.done = new Promise((resolve) => ff.on('close', resolve));
  return ff;
}

// hooktest.json lists every reel whose MP4s are in the output folder, so batch renders stay complete.
function writeIndex() {
  const items = [];
  for (const [i, scene] of HOOKTEST.entries()) {
    const id = idOf(i, scene);
    const file = path.join(args.out, `${id}.mp4`);
    const nomusic = path.join(args.out, `${id}-nomusic.mp4`);
    if (!fs.existsSync(file) || !fs.existsSync(nomusic)) continue;
    const cut = new HookCut({ scene, width: 108, height: 192, seed, canvas, fps, sampleRate, music: false });
    const copy = HOOKTEST_COPY[scene.id];
    items.push({
      id,
      file: path.basename(file),
      file_nomusic: path.basename(nomusic),
      size_bytes: fs.statSync(file).size,
      size_bytes_nomusic: fs.statSync(nomusic).size,
      duration_seconds: Math.round(cut.seconds * 100) / 100,
      cover_time_sec: cut.coverTime,
      guess: !!scene.guess,
      hook_variant: scene.variant,
      hook_text: scene.hook.en,
      hook: scene.hook,
      trend: scene.trend,
      accent: scene.accent,
      remake_of: scene.remakeOf || null,
      title: scene.title,
      theme: scene.theme,
      description: scene.description || null,
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
  const index = {
    series: REEL_SERIES,
    batch: 'hook test (batch 3): only the opening differs from batch 2',
    encoding,
    accent_color: '#C8322B',
    loop: 'Variant A ends on the finished picture that the video opens with; variant B ends on the frame just before its first. Replays run on seamlessly.',
    items,
  };
  fs.writeFileSync(path.join(args.out, 'hooktest.json'), `${JSON.stringify(index, null, 2)}\n`);
}
