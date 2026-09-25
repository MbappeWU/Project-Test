import { FONTS } from './text.js';
import { Rng } from './rng.js';

// Sprites composited above the sand: printed captions and the red seal (印).
export class Overlay {
  constructor(sprite, x, y, { delay = 0, fadeIn = 1.6, hold = 12, fadeOut = 2.2, blend = 'normal', maxOpacity = 1 } = {}) {
    this.sprite = sprite;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.delay = delay;
    this.fadeIn = fadeIn;
    this.hold = hold;
    this.fadeOut = fadeOut;
    this.blend = blend;
    this.maxOpacity = maxOpacity;
    this.t = 0;
    this.opacity = 0;
    this.changed = false;
    this.finished = false;
  }

  get total() {
    return this.delay + this.fadeIn + this.hold + this.fadeOut;
  }

  // Ends the overlay early with a fade from its current opacity.
  dismiss(fade = 1.5) {
    const shown = this.t - this.delay;
    if (shown < 0) {
      this.finished = true;
      return;
    }
    this.hold = Math.max(0, shown - this.fadeIn);
    this.fadeOut = fade;
  }

  tick(dt) {
    this.t += dt;
    const t = this.t - this.delay;
    let o = 0;
    if (t < 0) o = 0;
    else if (t < this.fadeIn) o = ease(t / this.fadeIn);
    else if (t < this.fadeIn + this.hold) o = 1;
    else if (t < this.fadeIn + this.hold + this.fadeOut) o = 1 - ease((t - this.fadeIn - this.hold) / this.fadeOut);
    else {
      o = 0;
      this.finished = true;
    }
    o *= this.maxOpacity;
    if (Math.abs(o - this.opacity) > 0.002 || (o === 0) !== (this.opacity === 0)) this.changed = true;
    this.opacity = o;
  }

  rect() {
    return [this.x, this.y, this.x + this.sprite.w, this.y + this.sprite.h];
  }

  composite(frame, W, rx0, ry0, rx1, ry1) {
    const o = this.opacity;
    if (o <= 0.001) return;
    const { w, h, data } = this.sprite;
    const x0 = Math.max(rx0, this.x);
    const y0 = Math.max(ry0, this.y);
    const x1 = Math.min(rx1, this.x + w);
    const y1 = Math.min(ry1, this.y + h);
    const multiply = this.blend === 'multiply';
    for (let y = y0; y < y1; y++) {
      let si = ((y - this.y) * w + (x0 - this.x)) * 4;
      let di = (y * W + x0) * 4;
      for (let x = x0; x < x1; x++, si += 4, di += 4) {
        const a = (data[si + 3] / 255) * o;
        if (a <= 0) continue;
        if (multiply) {
          frame[di] *= 1 - a + (a * data[si]) / 255;
          frame[di + 1] *= 1 - a + (a * data[si + 1]) / 255;
          frame[di + 2] *= 1 - a + (a * data[si + 2]) / 255;
        } else {
          frame[di] += (data[si] - frame[di]) * a;
          frame[di + 1] += (data[si + 1] - frame[di + 1]) * a;
          frame[di + 2] += (data[si + 2] - frame[di + 2]) * a;
        }
      }
    }
  }
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function toSprite(ctx, w, h) {
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

function isCJK(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x2018 && c <= 0x201d);
}

// Draws a line mixing Chinese and Latin text, each run in its own typeface, centred on x.
function drawMixed(ctx, text, x, y, cjkFont, latinFont) {
  const runs = [];
  for (const ch of text) {
    const cjk = isCJK(ch);
    const last = runs[runs.length - 1];
    if (last && last.cjk === cjk) last.text += ch;
    else runs.push({ text: ch, cjk });
  }
  let total = 0;
  for (const r of runs) {
    ctx.font = r.cjk ? cjkFont : latinFont;
    r.w = ctx.measureText(r.text).width;
    total += r.w;
  }
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  let cx = x - total / 2;
  for (const r of runs) {
    ctx.font = r.cjk ? cjkFont : latinFont;
    ctx.fillText(r.text, cx, y);
    cx += r.w;
  }
  ctx.textAlign = align;
}

// Museum-label caption: poem line, English rendering and attribution, bottom centre.
export function captionSprite(stage, { cn, en, by }) {
  const s = stage.s;
  const w = Math.round(1560 * s);
  const h = Math.round(150 * s);
  const canvas = stage.scratch(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const px = (n) => (n * s).toFixed(1);
  const lines = [];
  if (cn) lines.push({ text: cn, cjk: `${px(34)}px ${FONTS.kai}`, latin: `${px(30)}px ${FONTS.serif}`, y: 46, color: 'rgba(255, 244, 222, 0.97)' });
  if (en) lines.push({ text: en, cjk: `${px(26)}px ${FONTS.kai}`, latin: `italic ${px(29)}px ${FONTS.serif}`, y: 88, color: 'rgba(255, 240, 214, 0.93)' });
  if (by) lines.push({ text: by, cjk: `${px(21)}px ${FONTS.kai}`, latin: `${px(22)}px ${FONTS.serif}`, y: 122, color: 'rgba(250, 228, 196, 0.86)' });
  paintLines(ctx, lines, w / 2, s);
  return toSprite(ctx, w, h);
}

function paintLines(ctx, lines, cx, s) {
  for (const pass of ['shadow', 'text']) {
    for (const l of lines) {
      if (pass === 'shadow') {
        ctx.save();
        ctx.fillStyle = 'rgba(30, 14, 4, 0.55)';
        ctx.shadowColor = 'rgba(25, 10, 2, 0.9)';
        ctx.shadowBlur = 14 * s;
        drawMixed(ctx, l.text, cx, l.y * s, l.cjk, l.latin);
        ctx.restore();
      } else {
        ctx.fillStyle = l.color;
        drawMixed(ctx, l.text, cx, l.y * s, l.cjk, l.latin);
      }
    }
  }
}

// Generic single-block text sprite (programme titles, notes). Lines: { text, size, y, italic, color }.
export function textSprite(stage, lines, { width = 1400, height = 200 } = {}) {
  const s = stage.s;
  const w = Math.round(width * s);
  const h = Math.round(height * s);
  const canvas = stage.scratch(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  const px = (n) => (n * s).toFixed(1);
  paintLines(
    ctx,
    lines.map((l) => ({
      text: l.text,
      y: l.y,
      color: l.color || 'rgba(255, 242, 220, 0.95)',
      cjk: `${px(l.size)}px ${FONTS.kai}`,
      latin: `${l.italic ? 'italic ' : ''}${px(l.size * 1.05)}px ${FONTS.serif}`,
    })),
    w / 2,
    s,
  );
  return toSprite(ctx, w, h);
}

// Cinnabar seal with characters cut out (白文印), read right column first, top to bottom.
export function sealSprite(stage, text, { size = 78, seed = 3 } = {}) {
  const s = stage.s;
  const S = Math.round(size * s);
  const pad = Math.round(S * 0.12);
  const W = S + pad * 2;
  const canvas = stage.scratch(W, W);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = 'rgb(176, 30, 26)';
  const rng = new Rng(seed);
  const r = S * 0.06;
  roundRect(ctx, pad, pad, S, S, r);
  ctx.fill();
  const chars = [...text];
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const inner = S * 0.84;
  const off = pad + (S - inner) / 2;
  if (chars.length === 1) {
    ctx.font = `${(inner * 0.86).toFixed(1)}px ${FONTS.kai}`;
    ctx.fillText(chars[0], W / 2, W / 2 + inner * 0.03);
  } else if (chars.length === 2) {
    ctx.font = `${(inner * 0.5).toFixed(1)}px ${FONTS.kai}`;
    ctx.fillText(chars[0], W / 2, off + inner * 0.27);
    ctx.fillText(chars[1], W / 2, off + inner * 0.75);
  } else {
    ctx.font = `${(inner * 0.47).toFixed(1)}px ${FONTS.kai}`;
    const cells = [
      [0.75, 0.27],
      [0.75, 0.76],
      [0.26, 0.27],
      [0.26, 0.76],
    ];
    chars.slice(0, 4).forEach((ch, i) => ctx.fillText(ch, off + inner * cells[i][0], off + inner * cells[i][1]));
  }
  ctx.globalCompositeOperation = 'source-over';
  const img = ctx.getImageData(0, 0, W, W);
  const d = img.data;
  const noise = stage.noise;
  // Ink texture: uneven pressure and worn edges.
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) continue;
      const edge = Math.min(x - pad, y - pad, pad + S - x, pad + S - y) / (S * 0.05);
      const n = noise.n2(seed * 7 + x * 0.35 / s, y * 0.35 / s);
      const wear = 0.18 * noise.n2(seed * 3 + x * 0.05 / s, y * 0.05 / s);
      let a = d[i + 3] / 255;
      if (edge < 1) a *= Math.max(0, Math.min(1, edge * 0.8 + 0.35 + 0.6 * n));
      a *= Math.max(0, Math.min(1, 0.9 + wear + 0.25 * n + (rng.chance(0.012) ? -0.8 : 0)));
      d[i + 3] = Math.round(a * 255);
    }
  }
  return { w: W, h: W, data: d };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
