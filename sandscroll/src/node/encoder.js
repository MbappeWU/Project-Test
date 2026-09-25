import { spawn } from 'node:child_process';

// ffmpeg reading raw RGBA video on stdin and 48 kHz float stereo PCM on fd 3.
// Raw inputs need no probing; probing would make ffmpeg wait on one pipe while we fill the other.
export function rawInputArgs({ width, height, fps, sampleRate = 48000 }) {
  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-probesize', '32', '-analyzeduration', '0', '-thread_queue_size', '1024',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
    '-probesize', '32', '-analyzeduration', '0', '-thread_queue_size', '1024',
    '-f', 'f32le', '-ar', String(sampleRate), '-ac', '2', '-i', 'pipe:3',
    '-map', '0:v', '-map', '1:a',
  ];
}

export function startFfmpeg(args) {
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'pipe', 'pipe'] });
  ff.stderr.on('data', (d) => process.stderr.write(`[ffmpeg] ${d}`));
  ff.video = ff.stdin;
  ff.audio = ff.stdio[3];
  ff.alive = true;
  for (const s of [ff.video, ff.audio]) s.on('error', () => (ff.alive = false));
  ff.done = new Promise((resolve) => ff.on('close', (code) => {
    ff.alive = false;
    resolve(code);
  }));
  return ff;
}

export function write(stream, buf) {
  if (stream.write(buf)) return Promise.resolve();
  return new Promise((resolve) => {
    const onDrain = () => {
      stream.off('close', onDrain);
      resolve();
    };
    stream.once('drain', onDrain);
    stream.once('close', onDrain);
  });
}

// Interleaves two channels into one f32le buffer.
export function interleave(left, right) {
  const pcm = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    pcm[2 * i] = left[i];
    pcm[2 * i + 1] = right[i];
  }
  return Buffer.from(pcm.buffer);
}
