import { ridge, underRidge, spline, ellipse, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import * as L from '../../core/landscape.js';

// Far edge of the stream.
const WATER = 1184;

// Stones in the stream [x, y, r]; the crane's rock is the large flat one.
const STONES = [
  [470, 1228, 26],
  [566, 1262, 18],
  [890, 1236, 30],
  [1010, 1276, 24],
  [396, 1296, 22],
];
const ROCK = [700, 1206, 118, 30];

// 松鹤 · 明月松间照，清泉石上流 — a hanging-scroll night: the moon caught in the arm of an old
// pine that leans from a cliff, a spring falling between dark rocks and running over stones,
// and a red-crowned crane resting on one leg by the water. Portrait canvas 1080x1920.
export default {
  id: 'pinecrane',
  music: 'pine',
  title: { cn: '松鹤', en: 'Pine and Crane' },
  hook: { cn: '三十秒，给心放个假', en: 'Thirty seconds of calm' },
  theme: '宁静 · 松弛',
  poem: {
    columns: ['明月松间照', '清泉石上流'],
    cn: '明月松间照，清泉石上流',
    en: 'The bright moon shines between the pines; a clear spring flows over the stones.',
    by: '唐 · 王维《山居秋暝》  ·  Wang Wei, Tang dynasty',
  },
  seal: '松风',
  build(stage, rng) {
    const n = stage.noise;
    const off = rng.float(0, 100);
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(1.95, 0.95, 0, 1150, 0.1, off), { y0: -60, y1: 1240 }));
    // The stream, then the near bank in front of it.
    const water = stage.streaky(1.3, 0.2, 0.0016, 0.06, off + 7);
    acts.push(K.reveal((st) => st.mask([[-10, WATER], [1090, WATER], [1090, 1400], [-10, 1400]], { feather: 1, rough: 0.15, roughScale: 0.2 }), { op: 'set', level: water, order: 'down', duration: 2 }));
    const near = ridge(n, -20, 1100, 1350, 44, { offset: off + 50, freq: 1 / 200, peaks: [[1000, 56, 110], [620, 26, 70], [300, 30, 90]] });
    acts.push(K.reveal((st) => st.mask(underRidge(near, 1935), { feather: 1, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: stage.mottle(2.2, 0.14, 0.012, off), order: 'down', duration: 3 }));
    const mx = rng.float(636, 650);
    const my = rng.float(582, 594);
    acts.push(...K.moon(stage, mx, my, 112, { halo: 2.4, glow: 0.5, duration: 6 }));
    // Far peaks behind the crane, dissolving into the mist above the water.
    const far = ridge(n, 400, 1140, 1150, 60, { offset: off, freq: 1 / 280, peaks: [[760, 150, 120], [1020, 60, 110]], taper: 0.2 });
    acts.push(L.range(stage, far, { base: WATER, level: 1.55, mist: 0.5, mistDepth: 140, order: 'right', duration: 4 }));
    acts.push(L.mistBand(stage, { y: WATER - 44, height: 40, x0: 380, strength: 0.3, duration: 2 }));
    acts.push(...cliff(stage, off));
    acts.push(...banks(stage, near));
    acts.push(...pine(stage, rng, mx, my));
    acts.push(...spring(stage, rng));
    acts.push(...K.moonPath(stage, rng, { x: mx, horizon: WATER + 30, bottom: 1330, spread: 26, count: 9, strength: 0.7 }));
    acts.push(...crane(stage, { x: 700, y: 1188, u: 76, dir: -1 }));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 968, y: 470, size: 64, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 885, 885, { size: 62, seed: rng.int(1, 999) }));
    return acts;
  },
};

function cliff(stage, off) {
  const acts = [];
  const edge = [[-30, 792], [70, 786], [150, 806], [214, 842], [258, 886], [284, 930], [336, 946], [396, 958], [438, 990], [452, 1060], [444, 1140], [420, 1192], [320, 1200], [284, 1250], [262, 1330], [240, 1470], [214, 1660], [196, 1935]];
  const shape = spline([...edge, [-30, 1935]], 8, true);
  acts.push(K.reveal((st) => st.mask(shape, { feather: 1.2, rough: 0.35, roughScale: 0.08 }), { op: 'set', level: stage.mottle(2.5, 0.12, 0.012, off + 3), order: 'down', duration: 5 }));
  // Moonlit rim along the top, then axe-cut texture strokes (斧劈皴) down the rock planes.
  acts.push(K.carve(spline(edge.slice(0, 6), 10).map(([x, y]) => [x, y + 7]), { width: 7, strength: 0.32, speed: 320, rim: 0.1, taper: K.taperBoth }));
  acts.push(K.carve(spline(edge.slice(6, 11), 10).map(([x, y]) => [x - 6, y + 6]), { width: 6, strength: 0.3, speed: 320, rim: 0.1, taper: K.taperBoth }));
  const planes = [[40, 850, 170, 930], [20, 950, 210, 1060], [60, 1070, 250, 1200], [20, 1230, 200, 1330], [70, 1380, 210, 1500], [350, 1000, 430, 1080], [340, 1080, 420, 1160]];
  for (const [x0, y0, x1, y1] of planes) {
    acts.push(K.carve(spline([[x0, y0], [x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.25], [x1, y1]], 8), { width: 3.2, strength: 0.42, speed: 520, rest: 0.02 }));
    for (let k = 1; k <= 3; k++) {
      const sx = x0 + (x1 - x0) * (0.2 + k * 0.18);
      const sy = y0 + (y1 - y0) * (0.1 + k * 0.12) + 14;
      acts.push(K.carve([[sx, sy], [sx - 16, sy + 34]], { width: 4, strength: 0.24, speed: 300, rest: 0.01, taper: K.taperEnd }));
    }
  }
  return acts;
}

// Near bank: a moonlit rim on its crest and a few big foreground rocks, kept low in contrast
// (the platforms' captions and buttons sit over this part of the frame).
function banks(stage, near) {
  const acts = [];
  const crest = near.filter(([x]) => x > 250 && x < 1060);
  acts.push(K.carve(crest.map(([x, y]) => [x, y + 6]), { width: 5, strength: 0.34, speed: 520, rim: 0.1, taper: K.taperBoth }));
  for (const [x, y, w, h, seed] of [[860, 1560, 460, 170, 3], [330, 1680, 420, 190, 11], [720, 1860, 520, 200, 19]]) {
    acts.push(K.reveal((st) => st.mask(stoneShape(stage.noise, x, y, w / 2, h / 2, seed), { feather: 1, rough: 0.35, roughScale: 0.08 }), { op: 'set', level: stage.mottle(2.55, 0.1, 0.012, seed), order: 'up', duration: 0.6, rest: 0.03 }));
    acts.push(K.carve(spline([[x - w * 0.4, y - h * 0.2], [x - w * 0.12, y - h * 0.46], [x + w * 0.3, y - h * 0.42]], 8), { width: 5, strength: 0.34, speed: 600, rest: 0.02, taper: K.taperBoth }));
    for (let k = 0; k < 3; k++) {
      const sx = x - w * 0.25 + k * w * 0.22;
      const sy = y - h * 0.3 + (k % 2) * 16;
      acts.push(K.carve([[sx, sy], [sx - 22, sy + h * 0.32]], { width: 3.5, strength: 0.22, speed: 400, rest: 0.01, taper: K.taperEnd }));
    }
  }
  return acts;
}

// Old pine rooted on the cliff edge: the trunk twists up and throws a long arm toward the moon,
// so the needle clouds frame the moon and cross its rim (明月松间照).
function pine(stage, rng, mx, my) {
  const acts = [];
  for (const r of [[[196, 846], [150, 830], [104, 836]], [[214, 852], [252, 880], [270, 912]]]) {
    acts.push(K.pour(spline(r, 8), { width: 14, amount: 2.6, speed: 140, taper: (u) => 1 - 0.7 * u, scatter: 0.2 }));
  }
  const trunk = spline([[192, 856], [232, 792], [266, 744], [272, 690], [252, 640], [270, 592], [322, 556], [392, 538]], 10);
  acts.push(K.pour(trunk, { width: 54, amount: 3, speed: 100, taper: (u) => 1 - 0.62 * u, scatter: 0.3, hard: 0.5 }));
  const arms = [
    { pts: [[268, 736], [344, 722], [440, 718], [520, 702], [610, 708], [700, 702], [770, 690]], w: 26 },
    { pts: [[256, 652], [196, 630], [128, 616], [72, 606]], w: 17 },
    { pts: [[388, 540], [446, 526], [500, 522]], w: 12 },
    { pts: [[262, 610], [300, 630], [330, 632]], w: 9 },
  ];
  for (const a of arms) acts.push(K.pour(spline(a.pts, 8), { width: a.w, amount: 2.8, speed: 150, taper: (u) => 1 - 0.68 * u, scatter: 0.2, rest: 0.1 }));
  // Bark: a light rim on the side facing the moon.
  acts.push(K.carve(spline([[222, 812], [258, 756], [264, 694], [248, 646], [268, 600], [318, 566]], 8).map(([x, y]) => [x + 12, y + 2]), { width: 4, strength: 0.4, speed: 240, rim: 0.1, taper: K.taperBoth }));
  // Bark plates (龟甲纹): short arcs stacked up the trunk.
  for (let i = 0; i < 9; i++) {
    const t = 0.04 + i * 0.085;
    const [x, y] = trunk[Math.round(t * (trunk.length - 1))];
    const r = 17 * (1 - t * 0.6);
    const dx = (i % 2 ? 5 : -5) * (1 - t);
    acts.push(K.carve(spline([[x + dx - r, y + 5], [x + dx - r * 0.2, y - 4], [x + dx + r * 0.7, y + 3]], 4), { width: 3, strength: 0.5, speed: 140, rest: 0.02, taper: K.taperBoth }));
  }
  const clouds = [
    [344, 710, 180, 1],
    [516, 678, 214, 1],
    [690, 692, 190, 1],
    [118, 598, 172, -1],
    [300, 624, 120, -1],
    [428, 518, 232, 1],
  ];
  for (const [cx, cy, w, side] of clouds) {
    const h = w * rng.float(0.3, 0.36);
    const seed = rng.float(0, 100);
    acts.push(
      K.reveal((st) => st.mask(needleCloud(cx, cy, w, h, seed), { feather: 1.2, rough: 0.5, roughScale: 0.16 }), {
        op: 'set',
        level: stage.mottle(2.7, 0.16, 0.035, seed),
        order: side > 0 ? 'left' : 'right',
        duration: 1.5 * (w / 150),
        jitter: 0.1,
        rest: 0.12,
      }),
    );
    // Moonlight catching the edges that face the moon.
    const glow = 1 - Math.hypot(cx - mx, cy - my) / 330;
    if (glow > 0) {
      const rim = [];
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI + (i / 40) * Math.PI;
        const [px, py] = needleEdge(cx, cy, w, h, seed, a);
        const facing = (Math.cos(a) * (mx - px) + Math.sin(a) * (my - py)) / Math.hypot(mx - px, my - py);
        if (facing > 0.25) rim.push([px - Math.cos(a) * 4, py - Math.sin(a) * 4]);
        else if (rim.length) break;
      }
      if (rim.length > 3) acts.push(K.carve(rim, { width: 3.5, strength: 0.25 + 0.3 * glow, speed: 300, rest: 0.02, taper: K.taperBoth }));
    }
    // Needle fans scratched into each cloud.
    const fans = Math.max(3, Math.round(w / 40));
    for (let k = 0; k < fans; k++) {
      const u = (k + 0.5) / fans - 0.5;
      const fx = cx + u * w * 0.8 + rng.float(-6, 6);
      const fy = cy + h * 0.16;
      for (const a of [-0.55, 0, 0.55]) {
        const len = h * rng.float(0.5, 0.68);
        const ang = a + u * 0.5;
        acts.push(K.carve([[fx, fy], [fx + Math.sin(ang) * len, fy - Math.cos(ang) * len]], { width: 2.4, strength: 0.45, speed: 420, rest: 0.01, rim: 0.2, taper: K.taperEnd }));
      }
    }
  }
  return acts;
}

// Flat-bottomed pine needle cloud (松针团).
function needleCloud(cx, cy, w, h, seed) {
  const pts = [];
  for (let i = 0; i < 64; i++) pts.push(needleEdge(cx, cy, w, h, seed, (i / 64) * TAU));
  return pts;
}

function needleEdge(cx, cy, w, h, seed, a) {
  const top = Math.sin(a) < 0;
  const bump = 1 + (top ? 0.16 * Math.abs(Math.sin(a * 4.5 + seed)) + 0.07 * Math.sin(a * 11 + seed * 2) : 0.04 * Math.sin(a * 7 + seed));
  return [cx + Math.cos(a) * (w / 2) * bump, cy + Math.sin(a) * (h / 2) * bump * (top ? 1 : 0.42)];
}

// Irregular stone outline: rounded top, flattened waterline.
function stoneShape(noise, x, y, rx, ry, seed) {
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const k = 1 + 0.16 * noise.n2(seed + Math.cos(a) * 1.2, Math.sin(a) * 1.2);
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k * (Math.sin(a) > 0 ? 0.45 : 1)]);
  }
  return pts;
}

// The spring: a sheet of water falling from the cleft, its spray, and the stream running over
// stones in long lines that part around them.
function spring(stage, rng) {
  const acts = [];
  // Water slides out from under a dark lip, pale at first, whitening as it falls.
  const sheet = spline([[300, 946], [328, 948], [344, 1000], [350, 1100], [362, 1196], [290, 1198], [290, 1100], [294, 1000]], 8, true);
  acts.push(
    K.reveal((st) => st.mask(sheet, { feather: 1.4, rough: 0.45, roughScale: 0.22 }).map((a, X, Y) => a * Math.min(1, 0.45 + (Y / st.s - 946) / 260)), {
      op: 'carve',
      strength: 0.62,
      order: 'down',
      duration: 1.6,
    }),
  );
  acts.push(K.reveal((st) => st.mask(spline([[282, 950], [300, 932], [334, 932], [352, 950], [320, 958]], 6, true), { feather: 0.8, rough: 0.3, roughScale: 0.3 }), { op: 'set', level: 2.8, order: 'left', duration: 0.5 }));
  for (const [dx, w, from, to] of [[6, 5, 0.02, 1], [16, 3.5, 0.12, 0.72], [26, 6, 0, 1], [38, 3.5, 0.3, 1], [48, 4.5, 0.08, 0.86], [56, 3, 0.45, 1]]) {
    const pts = spline([[292 + dx * 0.7, 950], [294 + dx * 0.85, 1000], [296 + dx, 1100], [298 + dx * 1.1, 1192]], 12);
    const a = Math.round(from * (pts.length - 1));
    const b = Math.round(to * (pts.length - 1));
    acts.push(K.carve(pts.slice(a, b + 1), { width: w, strength: 0.88, speed: 280, rim: 0.12, rest: 0.03, taper: K.taperStart }));
  }
  for (const [x0, a] of [[296, -2.4], [312, -1.9], [338, -1.3], [356, -0.8]]) {
    acts.push(K.carve(spline([[x0, 1196], [x0 + Math.cos(a) * 22, 1196 + Math.sin(a) * 22], [x0 + Math.cos(a) * 34, 1190]], 6), { width: 3, strength: 0.6, speed: 160, rest: 0.02, taper: K.taperEnd }));
  }
  acts.push(K.reveal((st) => K.radialMask(st, 326, 1196, 16, 90, 2), { op: 'carve', strength: 0.5, order: 'out', duration: 1 }));
  const n = stage.noise;
  const [rx, ry, rw, rh] = ROCK;
  acts.push(K.reveal((st) => st.mask(stoneShape(n, rx, ry, rw / 2, rh, 7), { feather: 1, rough: 0.25, roughScale: 0.12 }), { op: 'set', level: stage.mottle(2.6, 0.08), order: 'up', duration: 1 }));
  acts.push(K.carve(spline([[rx - rw * 0.4, ry - rh * 0.55], [rx, ry - rh * 0.8], [rx + rw * 0.4, ry - rh * 0.6]], 8), { width: 5, strength: 0.4, speed: 260, taper: K.taperBoth }));
  for (const [x, y, r] of STONES) {
    const seed = rng.float(0, 50);
    acts.push(K.reveal((st) => st.mask(stoneShape(n, x, y, r * 1.5, r, seed), { feather: 1, rough: 0.25, roughScale: 0.12 }), { op: 'set', level: stage.mottle(2.65, 0.1, 0.02, seed), order: 'up', duration: 0.7, rest: 0.05 }));
    acts.push(K.carve(spline([[x - r * 0.9, y - r * 0.45], [x - r * 0.1, y - r * 0.85], [x + r * 0.7, y - r * 0.6]], 6), { width: 3.5, strength: 0.42, speed: 240, rest: 0.02, taper: K.taperBoth }));
  }
  // Water lines: long, gently wavy, parting around each stone and meeting again behind it.
  const obstacles = [...STONES.map(([x, y, r]) => [x, y, r * 1.5, r * 0.7]), [rx, ry, rw / 2, rh * 0.55]];
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const y0 = WATER + 10 + Math.pow(t, 1.25) * 150;
    const x0 = i < 3 ? 380 + rng.float(0, 120) : 300 + rng.float(-20, 60);
    const x1 = 1100;
    const ph = rng.float(0, TAU);
    const pts = [];
    for (let x = x0; x <= x1; x += 8) {
      let y = y0 + (1.5 + t * 3.5) * Math.sin(x / (70 + t * 60) + ph);
      for (const [sx, sy, ax, ay] of obstacles) {
        const dx = (x - sx) / (ax * 1.3);
        const dy = (y - sy) / (ay * 1.6);
        const d = dx * dx + dy * dy;
        if (d < 1) y += (y < sy ? -1 : 1) * ay * 1.6 * (1 - Math.sqrt(d)) * 0.9;
      }
      pts.push([x, y]);
    }
    let j = rng.int(0, 4);
    while (j < pts.length - 3) {
      const len = rng.int(14, 40);
      acts.push(K.carve(pts.slice(j, Math.min(pts.length, j + len)), { width: 2.2 + t * 2.6, strength: 0.6 + t * 0.12, speed: 520, rim: 0.2, rest: 0.01, taper: K.taperBoth }));
      j += len + rng.int(1, 5);
    }
  }
  return acts;
}

// Red-crowned crane resting on one leg. `dir` -1 faces left, 1 faces right; `u` is the unit size.
function crane(stage, { x, y, u, dir = -1 }) {
  const F = (pts) => pts.map(([a, b]) => [x - dir * a * u, y + b * u]);
  const acts = [];
  const body = spline([[-1.05, -2.74], [-0.82, -3.04], [-0.3, -3.18], [0.4, -3.1], [1.0, -2.86], [1.36, -2.6], [1.0, -2.36], [0.3, -2.18], [-0.5, -2.24], [-0.96, -2.48]], 8, true);
  acts.push(K.reveal((st) => st.mask(F(body), { feather: 1 }), { op: 'carve', strength: 0.96, order: dir < 0 ? 'left' : 'right', duration: 3.2 }));
  const neck = spline([[-0.74, -2.92], [-1.0, -3.4], [-0.84, -3.96], [-0.98, -4.5], [-1.1, -4.74]], 10);
  acts.push(K.carve(F(neck), { width: 0.3 * u, strength: 0.96, speed: 70, taper: (t) => 1 - 0.35 * t }));
  acts.push(K.reveal((st) => st.mask(F(ellipse(-1.1, -4.8, 0.21, 0.155, 0, 20)), { feather: 0.6 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.8 }));
  acts.push(K.carve(F([[-1.28, -4.79], [-1.98, -4.64]]), { width: 0.085 * u, strength: 0.94, speed: 70, taper: (t) => 1 - 0.7 * t }));
  // Black throat and neck, leaving a white nape; black face at the base of the bill.
  acts.push(K.pour(F(spline([[-1.06, -3.3], [-0.9, -3.94], [-1.02, -4.5], [-1.18, -4.72]], 8)), { width: 0.2 * u, amount: 2.4, speed: 70, taper: (t) => 0.4 + 0.6 * Math.min(1, t * 2.5) }));
  acts.push(K.pour(F([[-1.22, -4.76], [-1.3, -4.78]]), { width: 0.12 * u, amount: 2.2, speed: 60, taper: K.even }));
  // Black tertials drooping over the tail.
  const plume = spline([[0.3, -2.98], [0.9, -3.02], [1.42, -2.76], [1.74, -2.34], [1.62, -2.08], [1.46, -2.3], [1.3, -2.1], [1.1, -2.34], [0.86, -2.3], [0.58, -2.56]], 8, true);
  acts.push(K.reveal((st) => st.mask(F(plume), { feather: 1, rough: 0.3, roughScale: 0.3 }), { op: 'set', level: 2.7, order: dir < 0 ? 'right' : 'left', duration: 2 }));
  // One leg straight down, the other folded into the belly feathers.
  acts.push(K.carve(F([[0.06, -2.2], [0.03, -1.1], [0.07, 0]]), { width: 0.075 * u, strength: 0.9, speed: 70, taper: K.even }));
  acts.push(K.carve(F([[-0.08, -2.2], [-0.42, -1.62], [-0.06, -1.32]]), { width: 0.07 * u, strength: 0.9, speed: 60, taper: K.even }));
  acts.push(K.carve(F([[-0.3, 0.02], [0.07, 0], [0.34, 0.03]]), { width: 0.06 * u, strength: 0.8, speed: 100, taper: K.even }));
  // A faint line for the folded wing, the eye, and the red crown (丹顶) set into the head.
  acts.push(K.pour(F(spline([[-0.62, -2.9], [-0.1, -2.72], [0.5, -2.56], [0.96, -2.46]], 8)), { width: 2.2, amount: 0.5, speed: 110, taper: K.taperBoth, scatter: 0 }));
  acts.push(K.reveal((st) => st.mask(F(ellipse(-1.2, -4.8, 0.04, 0.04, 0, 8)), { feather: 0.3 }), { op: 'set', level: 2.4, order: 'out', duration: 0.1 }));
  const [hx, hy] = F([[-1.06, -4.88]])[0];
  acts.push(K.redDot(stage, hx, hy, 0.085 * u));
  return acts;
}
