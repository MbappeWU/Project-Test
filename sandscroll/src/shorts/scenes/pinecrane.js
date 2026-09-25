import { ridge, spline, ellipse, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import * as L from '../../core/landscape.js';

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
    acts.push(...K.cover(stage, stage.vgrad(1.95, 1.05, 0, 1200, 0.1, off), { y0: -60, y1: 1320 }));
    const mx = rng.float(630, 650);
    const my = rng.float(585, 600);
    acts.push(...K.moon(stage, mx, my, 112, { halo: 2.4, glow: 0.5, duration: 6 }));
    // Far peaks behind the crane, dissolving into the valley mist.
    const far = ridge(n, 380, 1140, 1160, 70, { offset: off, freq: 1 / 300, peaks: [[720, 150, 120], [1010, 70, 110]], taper: 0.2 });
    acts.push(L.range(stage, far, { level: 1.5, mist: 0.4, mistDepth: 170, order: 'right', duration: 5 }));
    // Valley floor: the stream bed (mid) and the dark bank the crane stands on.
    const bed = stage.streaky(1.35, 0.2, 0.0016, 0.05, off + 7);
    acts.push(K.reveal((st) => st.mask([[-10, 1195], [1090, 1185], [1090, 1930], [-10, 1930]], { feather: 1, rough: 0.2, roughScale: 0.2 }), { op: 'set', level: bed, order: 'down', duration: 4 }));
    const bank = spline([[520, 1232], [600, 1206], [720, 1198], [860, 1192], [1100, 1182], [1100, 1935], [930, 1935], [860, 1720], [790, 1500], [700, 1330]], 8, true);
    acts.push(K.reveal((st) => st.mask(bank, { feather: 1, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: stage.mottle(2.2, 0.12, 0.012, off), order: 'right', duration: 3 }));
    // The cliff at left, with a cleft the spring falls from.
    const cliff = spline([[-30, 792], [70, 786], [150, 806], [214, 842], [262, 892], [296, 950], [352, 988], [420, 1000], [470, 1030], [492, 1100], [488, 1168], [470, 1212], [300, 1226], [262, 1320], [228, 1460], [200, 1660], [182, 1935], [-30, 1935]], 8, true);
    acts.push(K.reveal((st) => st.mask(cliff, { feather: 1.2, rough: 0.35, roughScale: 0.08 }), { op: 'set', level: stage.mottle(2.45, 0.12, 0.012, off + 3), order: 'down', duration: 5 }));
    for (const [x0, y0, x1, y1] of [[20, 860, 190, 900], [30, 960, 230, 1030], [15, 1080, 250, 1180], [40, 1260, 220, 1380], [380, 1040, 470, 1110]]) {
      acts.push(K.carve(spline([[x0, y0], [(x0 + x1) / 2, y0 + (y1 - y0) * 0.3], [x1, y1]], 8), { width: 3, strength: 0.4, speed: 300, rest: 0.05 }));
    }
    acts.push(...pine(stage, rng, mx, my));
    acts.push(...spring(stage, rng));
    acts.push(...crane(stage, { x: 660, y: 1206, u: 64, dir: -1 }));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 968, y: 470, size: 64, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 885, 885, { size: 62, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Old pine rooted on the cliff edge: the trunk twists up and throws a long arm toward the moon,
// so the lowest needle clouds cross the moon's rim (明月松间照).
function pine(stage, rng, mx, my) {
  const acts = [];
  const trunk = spline([[200, 846], [232, 784], [250, 724], [238, 664], [262, 610], [312, 568], [380, 548]], 10);
  acts.push(K.pour(trunk, { width: 44, amount: 2.9, speed: 110, taper: (u) => 1 - 0.6 * u, scatter: 0.3, hard: 0.45 }));
  const arms = [
    { pts: [[246, 738], [330, 722], [430, 730], [520, 712], [612, 716], [700, 698]], w: 20 },
    { pts: [[242, 660], [190, 640], [120, 622]], w: 13 },
    { pts: [[300, 580], [360, 596], [420, 584]], w: 10 },
  ];
  for (const a of arms) acts.push(K.pour(spline(a.pts, 8), { width: a.w, amount: 2.7, speed: 160, taper: (u) => 1 - 0.65 * u, scatter: 0.2 }));
  // Bark: a light rim on the moon side and a few scale marks.
  acts.push(K.carve(spline([[222, 800], [244, 740], [236, 670], [262, 616], [310, 578]], 8), { width: 3, strength: 0.45, speed: 240, rim: 0.1, taper: K.taperBoth }));
  for (let i = 0; i < 6; i++) {
    const [x, y] = trunk[Math.round((0.1 + i * 0.13) * (trunk.length - 1))];
    acts.push(K.carve([[x - 9, y + 3], [x + 2, y - 4], [x + 11, y + 1]], { width: 2.4, strength: 0.4, speed: 120, rest: 0.03 }));
  }
  const clouds = [
    [355, 704, 170, 1],
    [500, 694, 200, 1],
    [648, 686, 186, 1],
    [128, 606, 150, -1],
    [410, 530, 200, 1],
    [292, 640, 120, -1],
  ];
  for (const [cx, cy, w, side] of clouds) {
    const h = w * rng.float(0.28, 0.34);
    const seed = rng.float(0, 100);
    acts.push(
      K.reveal((st) => st.mask(needleCloud(cx, cy, w, h, seed), { feather: 1.2, rough: 0.5, roughScale: 0.16 }), {
        op: 'set',
        level: stage.mottle(2.6, 0.16, 0.035, seed),
        order: side > 0 ? 'left' : 'right',
        duration: 1.6 * (w / 150),
        jitter: 0.1,
        rest: 0.15,
      }),
    );
    // Needle fans scratched into the cloud.
    const fans = Math.max(3, Math.round(w / 34));
    for (let k = 0; k < fans; k++) {
      const u = (k + 0.5) / fans - 0.5;
      const fx = cx + u * w * 0.82;
      const fy = cy + h * 0.2;
      for (const a of [-0.5, 0, 0.5]) {
        const len = h * rng.float(0.45, 0.62);
        acts.push(K.carve([[fx, fy], [fx + Math.sin(a + u * 0.6) * len, fy - Math.cos(a + u * 0.6) * len]], { width: 2, strength: 0.42, speed: 220, rest: 0.02, rim: 0.2, taper: K.taperEnd }));
      }
    }
  }
  return acts;
}

// Flat-bottomed pine needle cloud (松针团).
function needleCloud(cx, cy, w, h, seed) {
  const pts = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const top = Math.sin(a) < 0;
    const bump = 1 + (top ? 0.16 * Math.abs(Math.sin(a * 4.5 + seed)) + 0.07 * Math.sin(a * 11 + seed * 2) : 0.04 * Math.sin(a * 7 + seed));
    pts.push([cx + Math.cos(a) * (w / 2) * bump, cy + Math.sin(a) * (h / 2) * bump * (top ? 1 : 0.42)]);
  }
  return pts;
}

// The spring: a waterfall carved down the cleft, its pool, and the stream running over stones.
function spring(stage, rng) {
  const acts = [];
  for (let i = 0; i < 5; i++) {
    const x = 300 + i * 8;
    const pts = spline([[x - 4, 956], [x + 6, 980], [x + 8, 1040], [x + 6 + rng.float(-3, 3), 1120], [x + 10, 1196]], 10);
    acts.push(K.carve(pts, { width: i % 2 ? 5 : 7, strength: 0.88, speed: 260, rim: 0.15, rest: 0.05, taper: (u) => 0.6 + 0.4 * Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5) }));
  }
  acts.push(K.reveal((st) => K.radialMask(st, 322, 1204, 10, 70, 2), { op: 'carve', strength: 0.45, order: 'out', duration: 1.2 }));
  const stones = [
    [390, 1262, 120, 50],
    [560, 1290, 90, 38],
    [250, 1380, 150, 60],
    [470, 1420, 170, 64],
    [680, 1470, 130, 52],
    [330, 1580, 200, 76],
    [600, 1650, 230, 84],
  ];
  for (const [x, y, w, h] of stones) {
    const shape = spline([[x - w / 2, y + h * 0.35], [x - w * 0.42, y - h * 0.2], [x - w * 0.1, y - h / 2], [x + w * 0.3, y - h * 0.4], [x + w / 2, y + h * 0.1], [x + w * 0.35, y + h * 0.45]], 8, true);
    acts.push(K.reveal((st) => st.mask(shape, { feather: 1, rough: 0.3, roughScale: 0.12 }), { op: 'set', level: 2.6, order: 'up', duration: 1.2, rest: 0.1 }));
    acts.push(K.carve(spline([[x - w * 0.36, y - h * 0.1], [x - w * 0.1, y - h * 0.38], [x + w * 0.22, y - h * 0.3]], 6), { width: 3, strength: 0.55, speed: 220, rest: 0.03 }));
  }
  // Flow lines leaving the pool and running down between (and over) the stones.
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x0 = 300 + t * 160 + rng.float(-10, 10);
    const y0 = 1212 + t * 16;
    const pts = spline([[x0, y0], [x0 + 60 + t * 80, y0 + 60], [x0 + 20 + t * 160 + rng.float(-30, 30), y0 + 200], [x0 + 60 + t * 220, y0 + 420], [x0 + 120 + t * 260, y0 + 720]], 12);
    acts.push(K.carve(pts, { width: 2.5 + t * 3, strength: 0.6, speed: 520, rim: 0.2, rest: 0.04 }));
  }
  return acts;
}

// Red-crowned crane resting on one leg. `dir` -1 faces left, 1 faces right; `u` is the unit size.
function crane(stage, { x, y, u, dir = -1 }) {
  const F =(pts) => pts.map(([a, b]) => [x + (dir < 0 ? a : -a) * u, y + b * u]);
  const acts = [];
  const body = spline([[-1.05, -2.74], [-0.82, -3.04], [-0.3, -3.18], [0.4, -3.1], [1.0, -2.86], [1.36, -2.6], [1.0, -2.36], [0.3, -2.18], [-0.5, -2.24], [-0.96, -2.48]], 8, true);
  acts.push(K.reveal((st) => st.mask(F(body), { feather: 1 }), { op: 'carve', strength: 0.96, order: dir < 0 ? 'left' : 'right', duration: 1.8 }));
  const neck = spline([[-0.74, -2.92], [-1.0, -3.4], [-0.84, -3.96], [-0.98, -4.5], [-1.1, -4.74]], 10);
  acts.push(K.carve(F(neck), { width: 0.3 * u, strength: 0.96, speed: 120, taper: (t) => 1 - 0.35 * t }));
  // Black throat and neck, leaving a white nape.
  acts.push(K.pour(F(spline([[-0.9, -3.08], [-1.08, -3.44], [-0.94, -3.98], [-1.07, -4.52]], 8)), { width: 0.15 * u, amount: 2.2, speed: 110, taper: K.taperBoth }));
  acts.push(K.reveal((st) => st.mask(F(ellipse(-1.1, -4.8, 0.21, 0.155, 0, 20)), { feather: 0.6 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.4 }));
  acts.push(K.carve(F([[-1.28, -4.79], [-1.96, -4.63]]), { width: 0.085 * u, strength: 0.94, speed: 120, taper: (t) => 1 - 0.7 * t }));
  // Black tertials drooping over the tail.
  const plume = spline([[0.3, -2.98], [0.9, -3.02], [1.42, -2.76], [1.74, -2.34], [1.62, -2.08], [1.46, -2.3], [1.3, -2.1], [1.1, -2.34], [0.86, -2.3], [0.58, -2.56]], 8, true);
  acts.push(K.reveal((st) => st.mask(F(plume), { feather: 1, rough: 0.3, roughScale: 0.3 }), { op: 'set', level: 2.7, order: dir < 0 ? 'right' : 'left', duration: 1.2 }));
  // One leg straight down, the other folded into the belly feathers.
  acts.push(K.carve(F([[0.06, -2.2], [0.03, -1.1], [0.07, 0]]), { width: 0.075 * u, strength: 0.9, speed: 120, taper: K.even }));
  acts.push(K.carve(F([[-0.08, -2.2], [-0.42, -1.62], [-0.06, -1.32]]), { width: 0.07 * u, strength: 0.9, speed: 100, taper: K.even }));
  acts.push(K.carve(F([[-0.3, 0.02], [0.07, 0], [0.34, 0.03]]), { width: 0.06 * u, strength: 0.8, speed: 100, taper: K.even }));
  const [hx, hy] = F([[-1.08, -4.93]])[0];
  acts.push(K.redDot(stage, hx, hy, 0.11 * u));
  return acts;
}
