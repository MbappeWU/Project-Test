import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.resolve(here, '../../assets/fonts');

const FONT_FILES = [
  ['ZhiMangXing-Regular.ttf', 'Zhi Mang Xing'],
  ['MaShanZheng-Regular.ttf', 'Ma Shan Zheng'],
  ['CormorantGaramond.ttf', 'Cormorant Garamond'],
  ['CormorantGaramond-Italic.ttf', 'Cormorant Garamond'],
];

let registered = false;

// Canvas factory for the stage in Node; registers the bundled OFL fonts once.
export function nodeCanvas(fontDir = FONT_DIR) {
  if (!registered) {
    const missing = [];
    for (const [file, family] of FONT_FILES) {
      const p = path.join(fontDir, file);
      if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family);
      else missing.push(file);
    }
    if (missing.length) {
      console.warn(`[sandscroll] missing fonts (${missing.join(', ')}); run tools/fetch-fonts.sh. Falling back to system fonts.`);
    }
    registered = true;
  }
  return { create: (w, h) => createCanvas(w, h) };
}

export function savePng(frame, width, height, file) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(width, height);
  img.data.set(frame);
  ctx.putImageData(img, 0, 0);
  fs.writeFileSync(file, c.toBuffer('image/png'));
}
