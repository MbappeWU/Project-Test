import { spline, ellipse } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 平平 · 福双 — two giant pandas among bamboo, envoys of friendship.
export default {
  id: 'pandas',
  music: 'panda',
  opening: 0.12,
  title: { cn: '熊猫', en: 'Envoys of Friendship' },
  poem: {
    columns: ['咬定青山不放松'],
    cn: '咬定青山不放松',
    en: 'Biting firm into the green mountain, never letting go.',
    by: '清 · 郑燮《竹石》  ·  Zheng Xie, Qing dynasty',
  },
  note: {
    cn: '大熊猫“平平”“福双”即将落户亚特兰大动物园',
    en: 'Giant pandas Ping Ping and Fu Shuang are coming to Zoo Atlanta',
  },
  seal: '平安',
  build(stage, rng) {
    const ground = 905;
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(0.28, 0.1, 0, 1080, 0.12, rng.float(0, 50)), { rows: 5, y0: -60, y1: 1140 }));
    // Ground first, then the two pandas (the heroes), then the bamboo grove framing them.
    acts.push(K.reveal((st) => st.mask(groundPoly(ground), { feather: 2, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: stage.streaky(0.75, 0.25, 0.003, 0.05), order: 'left', duration: 5 }));
    const u = rng.float(73, 78);
    acts.push(...panda(stage, rng, { x: 700, y: ground, u, facing: 1, bamboo: true }));
    acts.push(...panda(stage, rng, { x: 1170, y: ground, u: u * 0.9, facing: -1, bamboo: false }));
    acts.push(...L.bambooGrove(stage, rng, { x: 150, top: -40, bottom: ground + 30, count: 3, lean: 0.04 }));
    acts.push(...L.bambooGrove(stage, rng, { x: 1760, top: -40, bottom: ground + 30, count: 3, lean: -0.05 }));
    for (let i = 0; i < 26; i++) {
      const x = rng.float(40, 1880);
      const y = ground + rng.float(-4, 30);
      const h = rng.float(18, 44);
      acts.push(K.pour(spline([[x, y], [x + rng.float(-6, 6), y - h * 0.5], [x + rng.float(-14, 14), y - h]], 5), { width: 3, amount: 1.4, speed: 260, rest: 0.02, taper: K.taperEnd }));
    }
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 1450, y: 150, size: 54, mode: 'pour', amount: 1.5, perChar: 1.4 }));
    acts.push(...K.seal(stage, this.seal, 1450, 598, { size: 56, seed: rng.int(1, 999) }));
    return acts;
  },
};

function groundPoly(y) {
  const pts = [[-20, y + 6]];
  for (let x = 0; x <= 1940; x += 40) pts.push([x, y + 6 * Math.sin(x / 170) + 4 * Math.sin(x / 57)]);
  pts.push([1940, 1100], [-20, 1100]);
  return pts;
}

function panda(stage, rng, { x, y, u, facing = 1, bamboo: holding = true }) {
  const acts = [];
  const f = facing;
  const P = (dx, dy) => [x + dx * u * f, y + dy * u];
  const E = (cx, cy, rx, ry, rot = 0) => ellipse(x + cx * u * f, y + cy * u, rx * u, ry * u, rot * f, 64);
  const mirror = (pts) => pts.map(([a, b]) => [-a, b]);
  const outline = { width: 0.07 * u, amount: 1.9, speed: 220, taper: K.even, scatter: 0.08, rest: 0.08 };
  const hx = 0.12;
  const hy = -3.5;

  // Pear-shaped sitting body: narrow shoulders, round belly, flat seat.
  const half = [[0, -2.72], [0.9, -2.66], [1.3, -2.2], [1.5, -1.4], [1.46, -0.62], [1.22, -0.12], [0.62, 0.03], [0, 0.04]];
  const bodyCtrl = [...half, ...mirror(half).reverse().slice(1, -1)].map(([a, b]) => P(a, b));
  const body = spline(bodyCtrl, 8, true);
  acts.push(K.reveal((st) => st.mask(body, { feather: 1 }), { op: 'set', level: 0.05, order: 'down', duration: 2.5 }));
  acts.push(K.pour(body, outline));

  // Hind legs, then the black shoulder band running into the forelegs.
  for (const s of [-1, 1]) {
    acts.push(K.reveal((st) => st.mask(E(s * 0.98, -0.42, 0.6, 0.44, s * -0.25), { feather: 1, rough: 0.15, roughScale: 0.25 }), { op: 'set', level: 2.6, order: 'up', duration: 1.4 }));
  }
  const reach = holding ? 1 : 0;
  for (const s of [-1, 1]) {
    const out = s === 1 && reach;
    const arm = out
      ? [[0.45, -2.72], [1.12, -2.62], [1.42, -2.2], [1.62, -1.72], [1.52, -1.38], [1.2, -1.36], [1.02, -1.6], [0.86, -2.02], [0.62, -2.34]]
      : [[0.45, -2.72], [1.15, -2.6], [1.44, -2.12], [1.44, -1.62], [1.1, -1.3], [0.52, -1.22], [0.3, -1.4], [0.42, -1.62], [0.82, -1.78], [0.76, -2.28]];
    const pts = spline(arm.map(([a, b]) => P(s * a, b)), 6, true);
    acts.push(K.reveal((st) => st.mask(pts, { feather: 1, rough: 0.12, roughScale: 0.3 }), { op: 'set', level: 2.7, order: 'down', duration: 1.6 }));
  }

  // Head over the shoulders, ears behind it.
  const head = E(hx, hy, 1.14, 0.98);
  for (const s of [-1, 1]) {
    acts.push(K.reveal((st) => st.mask(E(hx + s * 0.86, hy - 0.8, 0.37, 0.34), { feather: 1, rough: 0.15, roughScale: 0.3 }), { op: 'set', level: 2.7, order: 'out', duration: 1.1 }));
  }
  acts.push(K.reveal((st) => st.mask(head, { feather: 1 }), { op: 'set', level: 0.04, order: 'out', duration: 2 }));
  acts.push(K.pour(head, outline));
  // Slanted teardrop eye patches with bright eyes.
  for (const s of [-1, 1]) {
    const ex = hx + s * 0.43 + 0.06;
    acts.push(K.reveal((st) => st.mask(E(ex, hy + 0.02, 0.25, 0.37, s * 0.55), { feather: 1, rough: 0.12, roughScale: 0.3 }), { op: 'set', level: 2.8, order: 'down', duration: 1.2 }));
    acts.push(K.reveal((st) => st.mask(E(ex + s * 0.03, hy - 0.05, 0.08, 0.09), { feather: 0.6 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.4, rest: 0.1 }));
  }
  const nx = hx + 0.06;
  acts.push(K.reveal((st) => st.mask(E(nx, hy + 0.44, 0.16, 0.1), { feather: 0.8 }), { op: 'set', level: 2.7, order: 'down', duration: 0.6 }));
  acts.push(K.pour(spline([P(nx - 0.2, hy + 0.64), P(nx - 0.08, hy + 0.72), P(nx, hy + 0.62), P(nx + 0.08, hy + 0.72), P(nx + 0.2, hy + 0.64)], 6), { width: 0.05 * u, amount: 1.6, speed: 120, taper: K.even }));

  if (holding) {
    // A bamboo stalk gripped at the side, leafy crown above, a leaf in the mouth.
    const sx = 1.45;
    acts.push(K.pour([P(sx, -0.95), P(sx + 0.08, -5.4)], { width: 0.15 * u, amount: 2.3, speed: 170, taper: K.even }));
    for (const ny of [-2.4, -3.6, -4.7]) {
      const [cx, cy] = P(sx + 0.08 * ((-0.95 - ny) / 4.45), ny);
      acts.push(K.carve([[cx - 0.1 * u, cy], [cx + 0.1 * u, cy]], { width: 0.035 * u, strength: 0.85, speed: 80, taper: K.even, rest: 0.04 }));
    }
    const [tx, ty] = P(sx + 0.08, -5.35);
    const base = f > 0 ? 0 : Math.PI;
    for (const [ang, len] of [[-1.25, 1.2], [-0.7, 1.35], [-0.2, 1.15], [0.3, 0.95]]) {
      acts.push(...L.leaf(tx, ty, base + f * ang, len * u, 0.17 * u));
    }
    const [mx, my] = P(nx + 0.05, hy + 0.66);
    acts.push(...L.leaf(mx, my, base + f * -0.35, 0.95 * u, 0.12 * u));
  } else {
    acts.push(K.pour(spline([P(hx - 0.62, hy - 0.54), P(hx - 0.4, hy - 0.64), P(hx - 0.18, hy - 0.56)], 5), { width: 0.04 * u, amount: 1.2, speed: 100, taper: K.taperBoth }));
  }
  return acts;
}
