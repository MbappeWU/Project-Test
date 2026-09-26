import { alphaMask } from './mask.js';

// Text is rasterized through an injected canvas factory so the same code runs in the
// browser (HTMLCanvas/OffscreenCanvas) and in Node (@napi-rs/canvas).
export const FONTS = {
  brush: '"Zhi Mang Xing", "Ma Shan Zheng", "STXingkai", "KaiTi", serif',
  kai: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
  serif: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
};

// Vertical inscription (竖排), columns read right to left. `x` is the centre of the first
// (rightmost) column and `y` its top, in virtual units. Returns the carved/poured mask plus a
// reveal order that writes one character after another, each from top to bottom.
export function inscription(stage, { columns, x, y, size = 56, colGap = 1.3, rowGap = 1.06, font = FONTS.brush, align = 'top', ltr = false }) {
  const s = stage.s;
  const px = size * s;
  const pitchX = px * colGap;
  const pitchY = px * rowGap;
  const rows = Math.max(...columns.map((c) => [...c].length));
  // Columns normally advance leftwards (竖排); `ltr` lays single-character columns out as a
  // left-to-right title with `x` marking the first character.
  const dir = ltr ? -1 : 1;
  const colX = (ci) => x * s - dir * ci * pitchX;
  const x0 = Math.floor(Math.min(colX(0), colX(columns.length - 1)) - px);
  const y0 = Math.floor(y * s - px * 0.3);
  const w = Math.ceil(pitchX * (columns.length - 1) + px * 2);
  const h = Math.ceil(pitchY * rows + px * 0.8);
  const canvas = stage.scratch(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = `${px.toFixed(1)}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const boxes = [];
  columns.forEach((col, ci) => {
    const chars = [...col];
    const offset = align === 'bottom' ? rows - chars.length : align === 'center' ? (rows - chars.length) / 2 : 0;
    chars.forEach((ch, ri) => {
      const cx = colX(ci);
      const cy = y * s + (ri + offset + 0.5) * pitchY;
      ctx.fillText(ch, cx - x0, cy - y0);
      boxes.push({ cx, cy, ci, ri });
    });
  });
  const img = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = img[i * 4 + 3];
  const mask = alphaMask(alpha, w, h, x0, y0, stage.width, stage.height);
  const n = boxes.length;
  const order = (X, Y) => {
    const ci = Math.round((dir * (x * s - X)) / pitchX);
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const b = boxes[i];
      if (b.ci !== ci) continue;
      const dd = Math.abs(Y - b.cy);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    const b = boxes[best];
    const within = ((Y - (b.cy - px / 2)) / px) * 0.8 + ((X - (b.cx - px / 2)) / px) * 0.2;
    return (best + Math.min(0.98, Math.max(0, within))) / n;
  };
  return { mask, order, chars: n };
}
