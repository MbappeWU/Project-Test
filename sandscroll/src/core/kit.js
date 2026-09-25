import { palm, pour, carve, reveal, call, wait } from './actions.js';
import { Mask } from './mask.js';
import { arc, ellipse, clamp, TAU } from './geom.js';
import { inscription } from './text.js';
import { Overlay, captionSprite, sealSprite, textBlockSprite } from './overlay.js';

// Reusable gestures shared by the scenes. All coordinates are virtual (stage.VW x stage.VH).

// Palm passes across a horizontal band, alternating direction, moving density toward `target`.
export function cover(stage, target, { rows = 6, y0 = 0, y1 = stage.VH, x0 = -120, x1 = stage.VW + 120, width = 320, speed = 1700, rate = 0.97, streak = 1, wave = 16, phase = 0 } = {}) {
  const acts = [];
  // Rows closer than half a palm apart so passes overlap without leaving light bands.
  rows = Math.max(rows, Math.ceil((y1 - y0) / (width * 0.45)));
  for (let i = 0; i < rows; i++) {
    const y = y0 + ((i + 0.5) * (y1 - y0)) / rows;
    const pts = [];
    for (let x = x0; x <= x1; x += 40) pts.push([x, y + wave * Math.sin(x / 270 + i * 1.9 + phase)]);
    if (i % 2) pts.reverse();
    acts.push(palm(pts, { width, speed, target, rate, streak: stage.streaks[streak], streakMode: 'target', hard: 0.55, rest: 0.06 }));
  }
  return acts;
}

// Big sweeping arcs that dissolve the previous picture (sand-art transition). The scene's own
// cover then lays its base layer, so a faint ghost of the old picture may survive underneath.
export function wash(stage, rng, { level = 0.55, rate = 0.8, arcs = 5, width = 360, speed = 1700 } = {}) {
  const acts = [];
  const target = typeof level === 'function' ? level : stage.streaky(level, 0.22, 0.0015, 0.03, rng.float(0, 100));
  for (let i = 0; i < arcs; i++) {
    const fromLeft = i % 2 === 1;
    const r = rng.float(1000, 1500);
    const cy = ((i + 0.5) / arcs) * stage.VH + rng.float(-120, 120);
    const reach = rng.float(0.45, 0.8);
    const cx = fromLeft ? stage.VW * reach - r : stage.VW * (1 - reach) + r;
    const base = fromLeft ? 0 : Math.PI;
    const pts = arc(cx, cy, r, base - 0.85, base + 0.85, 48);
    if (rng.chance(0.5)) pts.reverse();
    acts.push(palm(pts, { width, speed, target, rate, streak: stage.streaks[i % 3], rest: 0.05 }));
  }
  return acts;
}

export function radialMask(stage, cx, cy, r0, r1, power = 2) {
  const s = stage.s;
  const X = cx * s;
  const Y = cy * s;
  const R0 = r0 * s;
  const R1 = r1 * s;
  const x0 = Math.max(0, Math.floor(X - R1));
  const y0 = Math.max(0, Math.floor(Y - R1));
  const x1 = Math.min(stage.width, Math.ceil(X + R1));
  const y1 = Math.min(stage.height, Math.ceil(Y + R1));
  const m = new Mask(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x + 0.5 - X, y + 0.5 - Y);
      const t = clamp((d - R0) / (R1 - R0), 0, 1);
      m.a[(y - y0) * m.w + (x - x0)] = d < R0 ? 1 : Math.pow(1 - t, power);
    }
  }
  return m;
}

// Carves a luminous moon (or sun) with a soft halo.
export function moon(stage, cx, cy, r, { duration = 7, halo = 2.1, glow = 0.38, strength = 0.97 } = {}) {
  return [
    reveal((st) => st.mask(ellipse(cx, cy, r, r, 0, 96), { feather: 1.2, rough: 0.1, roughScale: 0.12 }), {
      op: 'carve',
      strength,
      order: 'spiral',
      duration,
      jitter: 0.05,
    }),
    reveal((st) => radialMask(st, cx, cy, r * 0.98, r * halo, 2.2), { op: 'carve', strength: glow, order: 'out', duration: 3.5, jitter: 0.08 }),
  ];
}

// Horizontal wave strokes on a sea between horizon and bottom, denser near the horizon.
export function waves(stage, rng, { horizon = 640, bottom = stage.VH, x0 = 0, x1 = stage.VW, count = 18, strength = 0.62, avoid = null } = {}) {
  const acts = [];
  for (let i = 0; i < count; i++) {
    const t = Math.pow((i + rng.float(0.1, 0.9)) / count, 1.6);
    const y = horizon + 12 + t * (bottom - horizon - 20);
    const len = 120 + t * 520 * rng.float(0.6, 1.2);
    let cx = rng.float(x0 + len / 2, x1 - len / 2);
    if (avoid && Math.abs(cx - avoid) < len / 2 + 30) cx = cx < avoid ? cx - len / 2 : cx + len / 2;
    const amp = 2 + t * 7;
    const wl = 60 + t * 120;
    const pts = [];
    const ph = rng.float(0, TAU);
    for (let x = cx - len / 2; x <= cx + len / 2; x += 6) pts.push([x, y + amp * Math.sin(x / wl + ph)]);
    if (rng.chance(0.5)) pts.reverse();
    acts.push(carve(pts, { width: 2.5 + t * 6, strength: strength * rng.float(0.8, 1.1), speed: 380 + t * 200, rim: 0.35, rest: rng.float(0.08, 0.25) }));
  }
  return acts;
}

// Shimmering column of moonlight on water: short bright dashes widening toward the viewer.
export function moonPath(stage, rng, { x, horizon = 640, bottom = stage.VH, spread = 60, count = 34, strength = 0.8 } = {}) {
  const acts = [];
  for (let i = 0; i < count; i++) {
    const t = (i + rng.float(0, 1)) / count;
    const y = horizon + 8 + Math.pow(t, 1.3) * (bottom - horizon - 10);
    const w = (10 + t * spread * 2.4) * rng.float(0.5, 1.3);
    const cx = x + rng.gauss(0, 4 + t * spread * 0.35);
    const pts = [
      [cx - w / 2, y],
      [cx + w / 2, y + rng.float(-1.5, 1.5)],
    ];
    if (i % 2) pts.reverse();
    acts.push(carve(pts, { width: 3 + t * 5, strength: strength * rng.float(0.7, 1.05), speed: 260, rim: 0.2, rest: 0.04 }));
  }
  return acts;
}

// Carves or pours a vertical inscription character by character.
export function inscribe(stage, { columns, x, y, size = 58, mode = 'carve', strength = 0.9, amount = 1.3, perChar = 1.5, font, align, ltr, colGap, rowGap }) {
  let meta = null;
  const chars = columns.reduce((n, c) => n + [...c].length, 0);
  const act = reveal(
    (st) => {
      meta = inscription(st, { columns, x, y, size, font, align, ltr, colGap, rowGap });
      return meta.mask;
    },
    {
      op: mode === 'carve' ? 'carve' : 'add',
      strength,
      amount,
      duration: chars * perChar,
      order: (X, Y) => meta.order(X, Y),
      jitter: 0.012 / Math.max(1, chars / 6),
      rest: 0.8,
    },
  );
  act.tag = 'inscription';
  return act;
}

export function seal(stage, text, x, y, { size = 70, seed = 5 } = {}) {
  return [
    call((st) => {
      const sprite = sealSprite(st, text, { size, seed });
      const o = new Overlay(sprite, x * st.s - sprite.w / 2, y * st.s - sprite.h / 2, { fadeIn: 0.35, hold: 1e9, fadeOut: 1.5, blend: 'multiply', maxOpacity: 0.92 });
      st.addOverlay(o);
      st.sealOverlay = o;
      st.emit('cue', 'seal');
    }),
    wait(1.2),
  ];
}

export function caption(stage, { cn, en, by }, { hold = 22, delay = 0, bottom = 26 } = {}) {
  return call((st) => {
    const sprite = captionSprite(st, { cn, en, by });
    const o = new Overlay(sprite, (st.width - sprite.w) / 2, st.height - sprite.h - bottom * st.s, { delay, fadeIn: 2.2, hold, fadeOut: 2.5 });
    st.addOverlay(o);
    st.captionOverlay = o;
  });
}

// Small museum-plaque note at the top centre (historical or news context for the picture).
export function note(stage, { cn, en }, { hold = 22, delay = 0 } = {}) {
  return call((st) => {
    const sprite = textBlockSprite(
      st,
      [
        { text: cn, size: 26, face: 'kai', color: 'rgba(255, 243, 222, 0.92)' },
        { text: en, size: 22, face: 'kai', italic: true, gap: 2, color: 'rgba(255, 238, 212, 0.88)' },
      ],
      { maxWidth: Math.min(1500, st.VW - 60), pad: 10 },
    );
    const o = new Overlay(sprite, (st.width - sprite.w) / 2, 14 * st.s, { delay, fadeIn: 2.2, hold, fadeOut: 2.5 });
    st.addOverlay(o);
    st.noteOverlay = o;
  });
}

// A tiny touch of cinnabar (the crane's red crown); stays until the picture is washed away.
export function redDot(stage, x, y, r = 5) {
  return call((st) => {
    const R = Math.max(2, Math.round(r * st.s));
    const size = R * 2 + 2;
    const canvas = st.scratch(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(196, 36, 30)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, R, 0, Math.PI * 2);
    ctx.fill();
    const sprite = { w: size, h: size, data: ctx.getImageData(0, 0, size, size).data };
    const o = new Overlay(sprite, x * st.s - size / 2, y * st.s - size / 2, { fadeIn: 0.6, hold: 1e9, fadeOut: 1.2, blend: 'multiply', maxOpacity: 0.9 });
    st.addOverlay(o);
    (st.accents ||= []).push(o);
  });
}

// Removes seal, caption and note before the next picture begins.
export function clearOverlays() {
  return call((st) => {
    for (const key of ['sealOverlay', 'captionOverlay', 'noteOverlay']) {
      st[key]?.dismiss(1.2);
      st[key] = null;
    }
    for (const o of st.accents || []) o.dismiss(1.2);
    st.accents = [];
  });
}

export { pour, carve, palm, reveal, call, wait, even, taperBoth, taperEnd, taperStart } from './actions.js';
