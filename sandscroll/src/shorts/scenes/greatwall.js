import { ridge, spline, underRidge, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import * as L from '../../core/landscape.js';

// 长城 — the Great Wall climbing a knife-edge ridge from the lower left to a watchtower on the
// summit (the Jinshanling / Simatai view), the dawn sun behind it, misty ranges and geese.
// Portrait canvas 1080x1920.
export default {
  id: 'greatwall',
  music: 'wall',
  title: { cn: '长城', en: 'The Great Wall' },
  hook: { cn: '长城不是一天建成的', en: "The Great Wall wasn't built in a day" },
  theme: '坚持 · 同心',
  poem: {
    columns: ['志合者', '不以山海为远'],
    cn: '志合者，不以山海为远',
    en: 'For those who share a purpose, no mountain and no sea is too far.',
    by: '晋 · 葛洪《抱朴子》  ·  Ge Hong, Jin dynasty',
  },
  seal: '山海',
  build(stage, rng) {
    const n = stage.noise;
    const s = stage.s;
    const off = rng.float(0, 200);
    const sunX = rng.float(680, 705);
    const sunY = rng.float(540, 556);
    const acts = [];

    // Dawn sky: deep amber overhead, glowing low; the sun rises behind the summit.
    acts.push(...K.cover(stage, stage.vgrad(1.15, 0.26, 0, 1150, 0.1, off), { y0: -60, y1: 1620 }));
    acts.push(...K.moon(stage, sunX, sunY, 104, { halo: 3.1, glow: 0.5, strength: 0.95, duration: 5 }));
    acts.push(cloud(stage, sunX - 230, sunX + 190, sunY - 36, 10, 0.3));

    // Far ranges, lightest first; the wall runs on into the distance along the right one.
    const farR1 = ridge(n, 640, 1160, 900, 120, { offset: off + 11, freq: 1 / 300, peaks: [[rng.float(920, 960), 70, 110]], taper: 0.2 });
    const farR2 = ridge(n, 760, 1160, 1070, 90, { offset: off + 17, freq: 1 / 240, peaks: [[1060, 50, 90]], taper: 0.2 });
    acts.push(L.range(stage, farR1, { level: 0.46, mist: 0.9, mistDepth: 130, order: 'right', duration: 4 }));
    acts.push(...L.greatWall(stage, farR1, { x0: 850, x1: 1100, offset: 3, thick: 5, tooth: 4, level: 1.05, towers: [peakOf(farR1, 900, 1060)], towerW: 12, towerH: 11, duration: 2, walk: false }));
    acts.push(L.range(stage, farR2, { level: 0.74, mist: 0.9, mistDepth: 120, order: 'right', duration: 3 }));
    const far1 = ridge(n, -80, 720, 1010, 130, { offset: off + 23, freq: 1 / 320, peaks: [[rng.float(120, 220), 90, 130]] });
    const far2 = ridge(n, -80, 600, 1140, 110, { offset: off + 41, freq: 1 / 260, peaks: [[rng.float(300, 380), 60, 110]] });
    acts.push(L.range(stage, far1, { level: 0.46, mist: 0.9, mistDepth: 130, duration: 4 }));
    acts.push(L.range(stage, far2, { level: 0.72, mist: 0.88, mistDepth: 120, duration: 4 }));

    // The wall's mountain: a steep flight from the near landing to the summit, then a sheer drop
    // into the valley mist. Darker toward the viewer, dissolving into cloud at its far foot.
    const crest = crestLine([
      [-80, 1470], [-10, 1360], [40, 1262], [80, 1222], [130, 1214], [180, 1176], [240, 1112], [290, 1076],
      [350, 1066], [400, 1030], [450, 950], [500, 850], [550, 760], [600, 690], [635, 652], [665, 640],
      [695, 645], [730, 660], [764, 700], [792, 712], [822, 764], [852, 842], [884, 872], [914, 950],
      [950, 1050], [1000, 1120], [1070, 1170], [1160, 1215],
    ]);
    const peakX = 665;
    const grain = stage.mottle(1, 0.12, 0.012, off);
    acts.push(
      K.reveal((st) => st.mask(underRidge(crest, 1940), { feather: 1.2, rough: 0.2, roughScale: 0.1 }), {
        op: 'set',
        level: (x, y) => {
          const vx = x / s;
          const vy = y / s;
          const mist = smoothstep(990, 1290, vy) * smoothstep(380, 660, vx);
          return (1.3 + 1.0 * smoothstep(660, 1550, vy)) * grain(x, y) * (1 - 0.82 * mist);
        },
        order: 'up',
        duration: 7,
      }),
    );
    // Spurs falling away from the crest, their lit sides softly wiped with the side of a finger.
    for (const [x, len, bend] of [[240, 230, 0.5], [430, 300, -0.25], [590, 360, 0.35], [790, 250, 0.6]]) {
      const y = L.crestAt(crest, x) + 40;
      const sway = bend * len * 0.3;
      acts.push(K.carve(spline([[x, y], [x + sway * 0.6 + len * 0.08, y + len * 0.35], [x + sway, y + len * 0.7], [x + sway * 0.6 + len * 0.2, y + len]], 8), { width: 22, strength: 0.16, hard: 0.05, speed: 320, rest: 0.05, rim: 0.05, taper: K.taperEnd }));
    }
    acts.push(L.mistBand(stage, { y: 1165, height: 120, x0: 380, x1: 1080, strength: 0.5, duration: 3 }));
    acts.push(L.mistBand(stage, { y: 1300, height: 80, x0: -40, x1: 1080, strength: 0.42, duration: 3 }));
    const near = ridge(n, 360, 1160, 1480, 120, { offset: off + 89, freq: 1 / 190, peaks: [[1080, 130, 170], [640, 30, 80]], taper: 0.3 });
    acts.push(K.reveal((st) => st.mask(underRidge(near, 1940), { feather: 1.2, rough: 0.28, roughScale: 0.09 }), { op: 'set', level: stage.mottle(2.25, 0.1, 0.012, off + 5), order: 'right', duration: 4 }));

    // The wall, laid from the foreground up the flight to the summit, then over and down.
    const scale = (x) => ramp(x, [[-80, 1], [peakX, 0.34], [820, 0.26]]);
    const tone = (x) => ramp(x, [[-80, 2.85], [peakX, 2.65], [730, 2.45], [820, 1.4]]);
    const face = (x) => ramp(x, [[-80, 0.85], [peakX, 0.5], [820, 1.25]]);
    acts.push(...wall(stage, crest, { x0: -80, x1: peakX + 30, scale, tone, face, duration: 9 }));
    acts.push(...wall(stage, crest, { x0: peakX + 30, x1: 820, scale, tone, face, duration: 2 }));
    acts.push(...tower(stage, crest, 102, { w: 92, h: 80, level: 2.9, windows: 3 }));
    acts.push(...tower(stage, crest, 322, { w: 66, h: 58, level: 2.8, windows: 2 }));
    acts.push(...tower(stage, crest, peakX, { w: 64, h: 54, level: 2.75, windows: 2, roof: true }));
    acts.push(...L.flock(stage, rng, { x: rng.float(480, 505), y: rng.float(500, 520), count: 7, size: 19, dx: 46, dy: 18, level: 1.5 }));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 214, y: 486, size: 66, mode: 'pour', amount: 1.5, perChar: 1.35 }));
    acts.push(...K.seal(stage, this.seal, 128, 968, { size: 62, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A thin lens of lit cloud drifting across the sun (lighter than the sky, darker than the disc).
function cloud(stage, x0, x1, y, thick, level) {
  const upper = spline([[x0, y], [x0 + (x1 - x0) * 0.3, y - thick * 0.6], [x0 + (x1 - x0) * 0.7, y - thick * 0.4], [x1, y + 2]], 10);
  const lower = spline([[x1, y + 2], [x0 + (x1 - x0) * 0.6, y + thick * 0.5], [x0 + (x1 - x0) * 0.25, y + thick * 0.4], [x0, y]], 10);
  return K.reveal((st) => st.mask([...upper, ...lower], { feather: 2, rough: 0.2, roughScale: 0.15 }), { op: 'set', level, order: 'left', duration: 1.2, rest: 0.1 });
}

// Highest point of a crest between two x positions (for placing a tower).
function peakOf(crest, x0, x1) {
  let best = x0;
  for (let x = x0; x <= x1; x += 4) if (L.crestAt(crest, x) < L.crestAt(crest, best)) best = x;
  return best;
}

// Piecewise-linear interpolation through [x, value] stops.
function ramp(x, stops) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, v1] = stops[i];
    if (x <= x1) {
      const [x0, v0] = stops[i - 1];
      return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0);
    }
  }
  return stops[stops.length - 1][1];
}

// Smooth crest through control points, resampled every 4 units of x.
function crestLine(ctrl) {
  const sp = spline(ctrl, 16);
  const out = [];
  for (let x = ctrl[0][0]; x <= ctrl[ctrl.length - 1][0]; x += 4) out.push([x, L.crestAt(sp, x)]);
  return out;
}

// Vertical thickness of the wall at x: constant across the slope, so steep flights stay solid.
function thickAt(crest, x, scale) {
  const slope = (L.crestAt(crest, x + 3) - L.crestAt(crest, x - 3)) / 6;
  return 37 * scale(x) * Math.min(2.3, Math.hypot(1, slope));
}

// The wall along a crest, shrinking with distance (scale(x) = 1 in the foreground): its face
// catches the dawn light under a dark crenellated parapet whose merlons are spaced along the
// slope, so steep flights keep their battlements.
function wall(stage, crest, { x0, x1, scale, tone, face, duration }) {
  const top = [];
  const mid = [];
  const bottom = [];
  let phase = 0;
  let prev = null;
  for (let x = x0; x <= x1; x += 1) {
    const y = L.crestAt(crest, x);
    const k = scale(x);
    const stretch = Math.min(2.3, Math.hypot(1, (L.crestAt(crest, x + 3) - L.crestAt(crest, x - 3)) / 6));
    if (prev) phase += Math.hypot(x - prev[0], y - prev[1]) / Math.max(6, 24 * k);
    prev = [x, y];
    const merlon = phase % 1 < 0.55;
    const th = thickAt(crest, x, scale);
    top.push([x, y - (merlon ? Math.max(3, 12 * k * Math.sqrt(stretch)) : 0)]);
    mid.push([x, y + th * 0.3]);
    bottom.push([x, y + th]);
  }
  const grain = (x) => 1 + 0.06 * stage.noise.n2(x * 0.05, 3.1);
  const facePoly = [...mid, ...bottom.slice().reverse()];
  const parapet = [...top, ...mid.slice().reverse()];
  return [
    K.reveal((st) => st.mask(facePoly, { feather: 0.6, rough: 0.12, roughScale: 0.3 }), { op: 'set', level: (x) => face(x / stage.s) * grain(x), order: 'left', duration, jitter: 0.01 }),
    K.reveal((st) => st.mask(parapet, { feather: 0.5 }), { op: 'set', level: (x) => tone(x / stage.s) * grain(x), order: 'left', duration: duration * 0.6, jitter: 0.01 }),
    K.pour(bottom.filter((_, i) => i % 4 === 0), { width: 2.4, amount: 0.9, speed: 900, rest: 0.05, taper: (u) => 1 - 0.5 * u, scatter: 0.1 }),
  ];
}

// A watchtower astride the wall: crenellated top, arched windows; the summit one carries a
// small hipped roof.
function tower(stage, crest, x, { w, h, level, windows = 2, roof = false }) {
  const yl = L.crestAt(crest, x - w / 2);
  const yr = L.crestAt(crest, x + w / 2);
  const top = Math.min(yl, yr) - h;
  const bot = Math.max(yl, yr) + h * 0.45;
  const t = Math.max(2, h * 0.13);
  const body = [[x - w / 2, bot], [x - w / 2, top - t]];
  const teeth = 7;
  for (let i = 0; i < teeth; i++) {
    const xa = x - w / 2 + (w * i) / teeth;
    const xb = x - w / 2 + (w * (i + 1)) / teeth;
    const y = i % 2 === 0 ? top - t : top;
    body.push([xa, y], [xb, y]);
  }
  body.push([x + w / 2, top - t], [x + w / 2, bot]);
  const acts = [K.reveal((st) => st.mask(body, { feather: 0.5 }), { op: 'set', level, order: 'up', duration: 1.4, jitter: 0.02, rest: 0.1 })];
  if (roof) {
    // Hipped roof with upturned eaves (飞檐) over a small hall.
    const rh = h * 0.46;
    const eave = top - t - rh * 0.5;
    const ridgeY = eave - rh;
    const hall = [[x - w * 0.27, top - t + 1], [x - w * 0.27, eave], [x + w * 0.27, eave], [x + w * 0.27, top - t + 1]];
    const slope = (d) => spline([[x + d * w * 0.58, eave - rh * 0.36], [x + d * w * 0.45, eave - rh * 0.42], [x + d * w * 0.31, eave - rh * 0.74], [x + d * w * 0.21, ridgeY]], 6);
    const tiles = [
      ...spline([[x - w * 0.58, eave - rh * 0.36], [x - w * 0.46, eave - rh * 0.04], [x - w * 0.3, eave + 1], [x + w * 0.3, eave + 1], [x + w * 0.46, eave - rh * 0.04], [x + w * 0.58, eave - rh * 0.36]], 6),
      ...slope(1),
      [x + w * 0.26, ridgeY - rh * 0.18],
      [x + w * 0.2, ridgeY - rh * 0.04],
      [x - w * 0.2, ridgeY - rh * 0.04],
      [x - w * 0.26, ridgeY - rh * 0.18],
      ...slope(-1).reverse(),
    ];
    acts.push(K.reveal((st) => st.mask(hall, { feather: 0.5 }), { op: 'set', level, order: 'up', duration: 0.6, rest: 0.05 }));
    acts.push(K.reveal((st) => st.mask(tiles, { feather: 0.4 }), { op: 'set', level, order: 'up', duration: 0.9, rest: 0.1 }));
  }
  const wy = top + h * 0.42;
  for (let i = 0; i < windows; i++) {
    const wx = x + (windows === 1 ? 0 : (i / (windows - 1) - 0.5) * w * 0.52);
    acts.push(K.reveal((st) => st.mask(arch(wx, wy, w * 0.13, h * 0.3), { feather: 0.5 }), { op: 'carve', strength: 0.8, order: 'up', duration: 0.5, rest: 0.05 }));
  }
  return acts;
}

function arch(cx, cy, w, h) {
  const pts = [[cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2 + w / 2]];
  for (let a = Math.PI; a <= Math.PI * 2 + 1e-6; a += Math.PI / 8) pts.push([cx + (Math.cos(a) * w) / 2, cy - h / 2 + w / 2 + (Math.sin(a) * w) / 2]);
  pts.push([cx + w / 2, cy + h / 2]);
  return pts;
}
