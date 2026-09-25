#!/usr/bin/env node
// SandScroll broadcaster: renders the sand-painting show and its music in real time and hands
// raw frames + PCM to ffmpeg, which encodes H.264/AAC for YouTube (RTMPS) or writes a file.
//
//   Live:    YOUTUBE_STREAM_KEY=xxxx node src/node/stream.mjs
//   File:    node src/node/stream.mjs --out preview.mp4 --duration 300
//
// All options can also be given as environment variables (see deploy/.env.example).
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { Show } from '../core/show.js';
import { SCENES } from '../scenes/index.js';
import { MusicEngine } from '../music/engine.js';
import { nodeCanvas } from './canvas.js';
import { loadConfig } from './config.js';
import { rawInputArgs, startFfmpeg, write, interleave } from './encoder.js';

const env = process.env;
const { values: args } = parseArgs({
  options: {
    out: { type: 'string' },
    rtmp: { type: 'string', default: env.SANDSCROLL_RTMP_URL },
    duration: { type: 'string', default: env.SANDSCROLL_DURATION },
    width: { type: 'string', default: env.SANDSCROLL_WIDTH || '1920' },
    height: { type: 'string', default: env.SANDSCROLL_HEIGHT || '1080' },
    fps: { type: 'string', default: env.SANDSCROLL_FPS || '30' },
    seed: { type: 'string', default: env.SANDSCROLL_SEED },
    config: { type: 'string', default: env.SANDSCROLL_CONFIG || 'program.json' },
    program: { type: 'string', default: env.SANDSCROLL_PROGRAM },
    start: { type: 'string', default: env.SANDSCROLL_START || '0' },
    'video-bitrate': { type: 'string', default: env.SANDSCROLL_VIDEO_BITRATE || '6800k' },
    'audio-bitrate': { type: 'string', default: env.SANDSCROLL_AUDIO_BITRATE || '192k' },
    preset: { type: 'string', default: env.SANDSCROLL_X264_PRESET || 'veryfast' },
    crf: { type: 'string', default: '19' },
    realtime: { type: 'boolean' },
    timelapse: { type: 'string', default: '1' },
    heartbeat: { type: 'string', default: env.SANDSCROLL_HEARTBEAT || '/tmp/sandscroll.heartbeat' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (args.help) {
  console.log(`Usage: node src/node/stream.mjs [options]

Live to YouTube:   YOUTUBE_STREAM_KEY=... node src/node/stream.mjs
Render a file:     node src/node/stream.mjs --out preview.mp4 --duration 5m

  --out FILE            write an MP4 instead of streaming
  --rtmp URL            ingest URL (default: YouTube RTMPS with $YOUTUBE_STREAM_KEY)
  --duration 90s|5m|2h  stop after this long (default: run forever)
  --width/--height/--fps  picture size and rate (default 1920x1080@30)
  --program a,b,c       scene ids to play in order (default: program.json)
  --start N             index in the programme to begin with
  --seed N              performance seed (default: changes daily)
  --config FILE         programme config (default: program.json)
  --video-bitrate 6800k --audio-bitrate 192k --preset veryfast --crf 19
  --realtime            pace to wall-clock even when writing a file
  --timelapse 8         draw N times faster while the music plays at normal speed (promo reels, Shorts)`);
  process.exit(0);
}

const width = Number(args.width);
const height = Number(args.height);
const fps = Number(args.fps);
const sampleRate = 48000;
const samplesPerFrame = sampleRate / fps;
if (!Number.isInteger(samplesPerFrame)) throw new Error(`fps must divide 48000 (got ${fps})`);

const config = loadConfig(args.config);
const seed = Number(args.seed ?? config.seed ?? Math.floor(Date.now() / 86400000));
const program = args.program ? args.program.split(',') : config.program;
const target = resolveTarget();
const realtime = args.realtime ?? target.live;
const maxFrames = args.duration ? Math.round(parseDuration(args.duration) * fps) : Infinity;
const timelapse = Math.max(1, Number(args.timelapse) || 1);

const show = new Show({ width, height, seed, canvas: nodeCanvas(), program, hold: config.hold, notes: config.notes, pace: config.pace, start: Number(args.start) });
const firstScene = SCENES[show.program[show.index % show.program.length]];
const music = new MusicEngine({ sampleRate, seed, mood: firstScene?.music || 'moonrise' });
show.on((event, data) => {
  if (event === 'scene') {
    music.setMood(data.music);
    log(`scene: ${data.id} (${data.title?.cn || ''}) music=${data.music}`);
  } else if (event === 'cue') {
    music.cue(data);
  }
});

const left = new Float32Array(samplesPerFrame);
const right = new Float32Array(samplesPerFrame);
let stopping = false;
let frames = 0;

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (stopping) process.exit(130);
    log(`${sig} received, finishing`);
    stopping = true;
    // Never hang a container stop on a wedged encoder.
    setTimeout(() => process.exit(0), 10000).unref();
  });
}

function resolveTarget() {
  if (args.out) return { live: false, url: args.out };
  let url = args.rtmp;
  if (!url && env.YOUTUBE_STREAM_KEY) url = `rtmps://a.rtmps.youtube.com:443/live2/${env.YOUTUBE_STREAM_KEY}`;
  if (!url) {
    console.error('Nothing to do: set YOUTUBE_STREAM_KEY (or --rtmp URL) to go live, or --out file.mp4 to render.');
    process.exit(2);
  }
  return { live: true, url };
}

function ffmpegArgs() {
  const g = String(fps * 2);
  const input = [
    ...rawInputArgs({ width, height, fps, sampleRate }),
    '-c:v', 'libx264', '-preset', args.preset, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-g', g, '-keyint_min', g, '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', args['audio-bitrate'], '-ar', String(sampleRate), '-ac', '2',
  ];
  if (target.live) {
    const rate = args['video-bitrate'];
    const buf = `${parseInt(rate, 10) * 2}k`;
    return [...input, '-b:v', rate, '-maxrate', rate, '-bufsize', buf, '-x264-params', 'nal-hrd=cbr', '-flvflags', 'no_duration_filesize', '-f', 'flv', target.url];
  }
  return [...input, '-crf', args.crf, '-movflags', '+faststart', '-y', target.url];
}

async function runEncoder(ff) {
  const start = performance.now();
  const startFrame = frames;
  const frameMs = 1000 / fps;
  let lastStat = start;
  let renderMs = 0;
  while (!stopping && ff.alive && frames < maxFrames) {
    const t0 = performance.now();
    show.update(timelapse / fps);
    show.render();
    music.setSandActivity(show.activity);
    music.renderInto(left, right);
    renderMs += performance.now() - t0;
    // Zero-copy view of the frame: safe because we wait for 'drain' before the next render.
    const frame = Buffer.from(show.frame.buffer, show.frame.byteOffset, show.frame.byteLength);
    await Promise.all([write(ff.video, frame), write(ff.audio, interleave(left, right))]);
    frames++;
    if (realtime) {
      const due = start + (frames - startFrame) * frameMs;
      const wait = due - performance.now();
      if (wait > 1) await new Promise((r) => setTimeout(r, wait));
    }
    const now = performance.now();
    if (now - lastStat > 60000 || (!realtime && frames % (fps * 60) === 0)) {
      const elapsed = (now - start) / 1000;
      const produced = (frames - startFrame) / fps;
      log(`t=${fmt(frames / fps)} speed=${(produced / elapsed).toFixed(2)}x render=${(renderMs / (frames - startFrame)).toFixed(1)}ms/frame scene=${show.scene?.id}`);
      lastStat = now;
      heartbeat();
    }
  }
  ff.video.end();
  ff.audio.end();
  return ff.done;
}

function heartbeat() {
  try {
    fs.writeFileSync(args.heartbeat, `${Date.now()} ${frames} ${show.scene?.id || ''}\n`);
  } catch {
    // Heartbeat is best-effort (read-only filesystems, etc.).
  }
}

async function main() {
  log(`SandScroll ${width}x${height}@${fps} seed=${seed} program=${show.program.join(',')} -> ${target.live ? redact(target.url) : target.url}`);
  heartbeat();
  let backoff = 2000;
  for (;;) {
    const began = Date.now();
    const ff = startFfmpeg(ffmpegArgs());
    const code = await runEncoder(ff);
    if (Date.now() - began > 300000) backoff = 2000;
    if (stopping || frames >= maxFrames || !target.live) {
      if (code !== 0 && code !== null) {
        console.error(`ffmpeg exited with code ${code}`);
        process.exitCode = 1;
      }
      break;
    }
    // Network hiccup or ingest restart: keep the show running and reconnect.
    log(`encoder stopped (code ${code}); reconnecting in ${backoff / 1000}s`);
    await new Promise((r) => setTimeout(r, backoff));
    backoff = Math.min(60000, backoff * 2);
  }
  log(`done: ${fmt(frames / fps)} rendered`);
}

function parseDuration(s) {
  const m = /^(\d+(?:\.\d+)?)(h|m|s)?$/.exec(String(s).trim());
  if (!m) throw new Error(`bad duration ${s}`);
  return Number(m[1]) * ({ h: 3600, m: 60, s: 1 }[m[2] || 's']);
}

function fmt(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function redact(url) {
  return url.replace(/(live2\/)([^/?]+)/, (_, a, key) => `${a}${key.slice(0, 4)}…`);
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

