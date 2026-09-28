#!/usr/bin/env node
// Renders the vertical "一沙一世界" shorts: MP4 (1080x1920, H.264 + AAC), a 9:16 cover for
// TikTok, a 3:4 cover for 小红书 and a text file with the posting copy for each episode.
//   node tools/make-shorts.mjs [--only moon,panda] [--out shorts] [--seed 2026] [--preview] [--snap 5]
// Files stay under --max-mb (default 9 MB, for a 10 MB browser-upload limit): x264 keeps CRF
// quality and only caps the peaks, and the sand grain is static, so a long keyframe interval
// (--gop) saves far more than a higher CRF.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createCanvas } from '@napi-rs/canvas';
import { ShortDirector, hookLines } from '../src/core/short.js';
import { Overlay, textBlockSprite } from '../src/core/overlay.js';
import { MusicEngine } from '../src/music/engine.js';
import { SHORTS, CTA, SERIES, episodeLabel } from '../src/shorts/index.js';
import { COPY } from '../src/shorts/copy.js';
import { nodeCanvas, savePng } from '../src/node/canvas.js';
import { rawInputArgs, startFfmpeg, write, interleave, capArgs } from '../src/node/encoder.js';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    out: { type: 'string', default: 'shorts' },
    seed: { type: 'string', default: '2026' },
    fps: { type: 'string', default: '30' },
    draw: { type: 'string', default: '30' },
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
const spf = sampleRate / fps;
const width = args.preview ? 540 : 1080;
const height = args.preview ? 960 : 1920;
const seed = Number(args.seed);
const wanted = args.only ? args.only.split(',') : null;
fs.mkdirSync(args.out, { recursive: true });
const canvas = nodeCanvas();

const baseOf = (i, scene) => path.join(args.out, `EP${String(i + 1).padStart(2, '0')}-${scene.id}`);

for (const [i, scene] of SHORTS.entries()) {
  if (wanted && !wanted.includes(scene.id)) continue;
  const base = baseOf(i, scene);
  const t0 = performance.now();
  const info = await renderShort(scene, episodeLabel(i), base);
  console.log(`${path.basename(base)}: ${info.seconds.toFixed(1)}s video in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}
if (!args.preview) writeCopyIndex();

async function renderShort(scene, ep, base) {
  const director = new ShortDirector({ scene, width, height, seed, canvas, episode: ep, drawSeconds: Number(args.draw), cta: CTA });
  const music = new MusicEngine({ sampleRate, seed: seed + scene.id.length, mood: scene.music });
  director.on((event, data) => event === 'cue' && music.cue(data));
  const total = Math.ceil((director.duration + 0.4) * fps);
  const fadeFrames = Math.round(1.6 * fps);
  const ff = startFfmpeg([
    ...rawInputArgs({ width, height, fps, sampleRate }),
    '-c:v', 'libx264', '-preset', args.preview ? 'veryfast' : 'slow', '-crf', args.crf, ...capArgs(Number(args['max-mb']), total / fps, args.ab), '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-g', args.gop, '-c:a', 'aac', '-b:a', args.ab, '-movflags', '+faststart', '-y', `${base}.mp4`,
  ]);
  const left = new Float32Array(spf);
  const right = new Float32Array(spf);
  const snapEvery = args.snap ? Math.round(Number(args.snap) * fps) : 0;
  let cover = null;
  for (let f = 0; f < total; f++) {
    director.update(1 / fps);
    director.render();
    if (!cover && director.finishedAt !== null) cover = Uint8ClampedArray.from(director.frame);
    music.setSandActivity(director.activity);
    music.renderInto(left, right);
    const fade = Math.min(1, (total - f) / fadeFrames);
    if (fade < 1) {
      for (let k = 0; k < spf; k++) {
        const g = fade - (k / spf) / fadeFrames;
        left[k] *= Math.max(0, g);
        right[k] *= Math.max(0, g);
      }
    }
    const frame = Buffer.from(director.frame.buffer, director.frame.byteOffset, director.frame.byteLength);
    await Promise.all([write(ff.video, frame), write(ff.audio, interleave(left, right))]);
    if (snapEvery && f % snapEvery === 0) savePng(director.frame, width, height, `${base}-${String(Math.round(f / fps)).padStart(3, '0')}s.png`);
  }
  ff.video.end();
  ff.audio.end();
  const code = await ff.done;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code} for ${scene.id}`);
  if (!args.preview) {
    saveCovers(director, scene, cover || director.frame, base);
    fs.writeFileSync(`${base}.txt`, copyText(scene, ep));
  } else if (cover) {
    savePng(cover, width, height, `${base}-final.png`);
  }
  return { seconds: total / fps };
}

// 9:16 (TikTok) and 3:4 (小红书) covers: the finished painting with the episode title on top.
function saveCovers(director, scene, frame, base) {
  const st = director.stage;
  const title = textBlockSprite(
    st,
    [
      { text: `${SERIES.cn} · 数字沙画`, size: 30, face: 'kai', color: 'rgba(245, 214, 170, 0.95)' },
      ...hookLines(scene.hook.cn).map((text, i) => ({ text, size: 84, face: 'brush', gap: i ? 0 : 8, leading: 0.2, color: 'rgba(255, 247, 230, 1)' })),
    ],
    { maxWidth: 980, pad: 28, halo: 20, band: 0.55 },
  );
  const stamp = (buf, h, y) => {
    const o = new Overlay(title, (width - title.w) / 2, y);
    o.opacity = 1;
    o.composite(buf, width, 0, 0, width, h);
    return buf;
  };
  writeJpeg(stamp(Uint8ClampedArray.from(frame), height, 150 * st.s), width, height, `${base}-cover-9x16.jpg`);
  const cropH = Math.round(height * 0.75);
  const top = Math.round(height * 0.125);
  const crop = frame.slice(top * width * 4, (top + cropH) * width * 4);
  // The 3:4 crop keeps the subject clear by putting the title over the ground/sea below it.
  writeJpeg(stamp(crop, cropH, cropH - title.h - 70 * st.s), width, cropH, `${base}-cover-3x4.jpg`);
}

function writeJpeg(rgba, w, h, file) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  fs.writeFileSync(file, c.toBuffer('image/jpeg', 92));
}

function copyText(scene, ep) {
  const c = COPY[scene.id] || {};
  const lines = [`${ep}  ${scene.title.cn} · ${scene.title.en}`, `主题：${scene.theme || ''}`, ''];
  if (c.xhs) {
    lines.push('【小红书】', `标题：${c.xhs.title}`, '', c.xhs.body, '', c.xhs.tags.map((t) => `#${t}`).join(' '), '');
  }
  if (c.tiktok) {
    lines.push('【TikTok】', c.tiktok.caption, '', c.tiktok.tags.map((t) => `#${t}`).join(' '), '');
  }
  lines.push('发布时请在平台勾选「AI 生成内容 / AI-generated」标识（数字沙画由代码生成，AI 辅助创作）。');
  return `${lines.join('\n')}\n`;
}

// Lists every episode rendered into the output folder, so rendering in batches with --only
// still leaves one complete copy.md.
function writeCopyIndex() {
  const md = ['# 一沙一世界 · 发布文案', ''];
  for (const [i, scene] of SHORTS.entries()) {
    const base = baseOf(i, scene);
    if (!fs.existsSync(`${base}.mp4`)) continue;
    md.push(`## ${path.basename(base)}`, '', '```', copyText(scene, episodeLabel(i)).trim(), '```', '');
  }
  fs.writeFileSync(path.join(args.out, 'copy.md'), `${md.join('\n')}\n`);
}
