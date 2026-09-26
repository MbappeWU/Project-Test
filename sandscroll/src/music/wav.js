// 16-bit PCM stereo WAV encoder (pure JS, returns bytes). TPDF dither from a fixed-seed Rng
// keeps quiet reverb tails free of truncation distortion while staying deterministic.

import { Rng } from '../core/rng.js';

export function encodeWav(left, right, sampleRate) {
  const frames = left.length;
  const dataBytes = frames * 4;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (off, s) => {
    for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); // byte rate
  view.setUint16(32, 4, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  const next = new Rng(0x5eed).next;
  const quantize = (x) => {
    const dither = next() - next();
    const v = Math.round(x * 32767 + dither);
    return v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  };
  let off = 44;
  for (let i = 0; i < frames; i++) {
    view.setInt16(off, quantize(left[i]), true);
    view.setInt16(off + 2, quantize(right[i]), true);
    off += 4;
  }
  return bytes;
}
