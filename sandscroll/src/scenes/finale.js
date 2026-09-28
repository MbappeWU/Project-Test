import { ridge, spline, ellipse } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 天涯若比邻 — cranes form a bridge (鹊桥) across the moonlit Pacific, from the Great Wall to the Golden Gate.
export default {
  id: 'finale',
  music: 'finale',
  opening: 1.0,
  title: { cn: '天涯若比邻', en: 'Neighbours across the Ocean' },
  poem: {
    columns: ['海内存知己', '天涯若比邻'],
    cn: '海内存知己，天涯若比邻',
    en: 'A true friend within the four seas makes the ends of the earth feel next door.',
    by: '唐 · 王勃《送杜少府之任蜀州》  ·  Wang Bo, Tang dynasty',
  },
  note: { cn: '谨以此卷，致中美两国人民的友谊', en: 'Dedicated to the friendship between the peoples of China and the United States' },
  seal: '和合',
  build(stage, rng) {
    const n = stage.noise;
    const H0 = 720;
    const off = rng.float(0, 100);
    const mx = rng.float(900, 1020);
    const my = rng.float(150, 175);
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(1.9, 0.75, 0, H0, 0.1, off), { rows: 6, y0: -60, y1: H0 + 30 }));
    const sea = stage.streaky(1.3, 0.2, 0.0012, 0.08, off + 5);
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1930, H0], [1930, 1090], [-10, 1090]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => sea(x, y) * (0.75 + 0.4 * Math.min(1, (y / stage.s - H0) / 360)),
        order: 'down',
        duration: 7,
      }),
    );
    acts.push(...K.moon(stage, mx, my, 66, { halo: 2.8, glow: 0.55 }));

    // West shore: ranges and the Great Wall. East shore: hills and the Golden Gate.
    const west = ridge(n, -120, 620, H0 + 4, 150, { offset: off, freq: 1 / 260, peaks: [[160, 90, 140], [420, 40, 90]], taper: 0.3 });
    const east = ridge(n, 1320, 2080, H0 + 4, 70, { offset: off + 50, freq: 1 / 260, peaks: [[1880, 40, 120]], taper: 0.3 });
    acts.push(L.range(stage, west, { base: H0 + 3, level: 2.2, mist: 0.2, mistDepth: 40, duration: 6 }));
    acts.push(...L.greatWall(stage, west, { x0: 40, x1: 540, offset: 3, thick: 7, tooth: 5, level: 3, towers: [165, 415], towerW: 18, towerH: 16, duration: 5, walk: false }));
    acts.push(L.range(stage, east, { base: H0 + 3, level: 2.1, mist: 0.2, mistDepth: 40, order: 'right', duration: 5 }));
    acts.push(...miniBridge(1450, 1760, H0));

    acts.push(...K.moonPath(stage, rng, { x: mx, horizon: H0, count: 26 }));
    acts.push(...K.waves(stage, rng, { horizon: H0, avoid: mx, count: 12, strength: 0.7 }));

    // The crane bridge: luminous birds along an arch from shore to shore.
    const count = rng.int(12, 14);
    const x0 = 520;
    const x1 = 1460;
    const rise = 270;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = x0 + (x1 - x0) * t + rng.float(-10, 10);
      const y = 630 - rise * Math.sin(Math.PI * t) + rng.float(-12, 12);
      const size = 78 + 34 * Math.sin(Math.PI * t) * rng.float(0.85, 1.1);
      const heading = Math.atan((-rise * Math.PI * Math.cos(Math.PI * t)) / (x1 - x0));
      acts.push(...crane(x, y, size, heading, rng.float(0, 1)));
    }

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 1790, y: 70, size: 58, mode: 'carve', strength: 0.9, perChar: 1.35 }));
    acts.push(...K.seal(stage, this.seal, 1714, 470, { size: 60, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A red-crowned crane in flight, carved light: near wing raised, far wing lowered, long neck
// stretched forward and legs trailing, fingered primaries at the wing tips.
function crane(x, y, size, heading, phase) {
  const u = size / 2;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const T = ([a, b]) => [x + (a * c - b * s) * u, y + (a * s + b * c) * u];
  const lift = 0.75 + 0.5 * phase;
  const near = [[0.22, -0.06], [0.05, -0.42 * lift], [-0.12, -0.82 * lift], [-0.3, -1.12 * lift], [-0.42, -1.06 * lift], [-0.4, -0.96 * lift], [-0.52, -0.98 * lift], [-0.52, -0.86 * lift], [-0.62, -0.84 * lift], [-0.58, -0.7 * lift], [-0.66, -0.62 * lift], [-0.5, -0.36], [-0.34, -0.06]];
  const far = [[0.1, 0.05], [-0.05, 0.36 * lift], [-0.25, 0.58 * lift], [-0.4, 0.6 * lift], [-0.36, 0.48 * lift], [-0.48, 0.46 * lift], [-0.42, 0.3], [-0.3, 0.06]];
  const body = ellipse(0, 0, 0.46, 0.13, 0, 24);
  const neck = spline([[0.36, -0.03], [0.75, -0.14], [1.1, -0.12], [1.34, -0.16]], 6);
  return [
    K.reveal((st) => st.mask([far.map(T)], { feather: 0.7 }), { op: 'carve', strength: 0.7, order: 'left', duration: 0.5, rest: 0.02 }),
    K.reveal((st) => st.mask([body.map(T), near.map(T)], { feather: 0.7 }), { op: 'carve', strength: 0.95, order: 'left', duration: 0.9, rest: 0.03 }),
    K.carve(neck.map(T), { width: Math.max(2, u * 0.075), strength: 0.93, speed: 240, taper: (t) => 1 - 0.35 * t, rest: 0.02 }),
    K.reveal((st) => st.mask(ellipse(1.38, -0.17, 0.085, 0.065, 0, 12).map(T), { feather: 0.5 }), { op: 'carve', strength: 0.96, order: 'out', duration: 0.2, rest: 0 }),
    K.carve([T([1.44, -0.16]), T([1.72, -0.12])], { width: Math.max(1.4, u * 0.035), strength: 0.9, speed: 160, taper: (t) => 1 - 0.7 * t, rest: 0.02 }),
    K.carve([T([-0.4, 0.05]), T([-0.95, 0.12]), T([-1.5, 0.18])], { width: Math.max(1.5, u * 0.04), strength: 0.85, speed: 240, taper: (t) => 1 - 0.4 * t, rest: 0.08 }),
  ];
}

// Miniature Golden Gate on the far shore.
function miniBridge(t1, t2, water) {
  const acts = [];
  const top = water - 118;
  const deck = water - 38;
  for (const tx of [t1, t2]) {
    acts.push(K.pour([[tx - 5, water], [tx - 5, top]], { width: 5, amount: 3, speed: 200, taper: K.even }));
    acts.push(K.pour([[tx + 5, water], [tx + 5, top]], { width: 5, amount: 3, speed: 200, taper: K.even }));
    for (const f of [0.28, 0.55, 0.8, 1]) {
      const y = water - (water - top) * f;
      acts.push(K.pour([[tx - 9, y], [tx + 9, y]], { width: 3.5, amount: 3, speed: 120, taper: K.even, rest: 0.02 }));
    }
  }
  acts.push(K.pour([[t1 - 200, deck], [t2 + 200, deck]], { width: 4, amount: 3, speed: 400, taper: K.even }));
  const cable = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    cable.push([t1 + (t2 - t1) * t, top + 4 * (deck - 6 - top) * t * (1 - t)]);
  }
  acts.push(K.pour(cable, { width: 2.4, amount: 2.8, speed: 300, taper: K.even }));
  acts.push(K.pour(spline([[t1 - 200, deck], [t1 - 90, top + 50], [t1, top]], 8), { width: 2.4, amount: 2.8, speed: 300, taper: K.even }));
  acts.push(K.pour(spline([[t2, top], [t2 + 90, top + 50], [t2 + 200, deck]], 8), { width: 2.4, amount: 2.8, speed: 300, taper: K.even }));
  return acts;
}

