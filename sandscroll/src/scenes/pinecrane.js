import { ridge, spline, ellipse } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 松鹤 — a red-crowned crane beneath an old pine, a spring running over the stones by moonlight.
export default {
  id: 'pinecrane',
  music: 'pine',
  opening: 1.0,
  title: { cn: '松鹤', en: 'Pine and Crane' },
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
    acts.push(...K.cover(stage, stage.vgrad(1.75, 1.05, 0, 1080, 0.1, off), { rows: 6, y0: -60, y1: 1140 }));
    const mx = rng.float(1180, 1300);
    acts.push(...K.moon(stage, mx, 250, 92, { halo: 2.6, glow: 0.5 }));
    const far = ridge(n, -60, 1980, 700, 170, { offset: off, freq: 1 / 360, peaks: [[1500, 90, 220]] });
    acts.push(L.range(stage, far, { level: 1.45, mist: 0.55, mistDepth: 160, order: 'right', duration: 7 }));
    // Cliff at left carrying the pine, rocks and a spring at right.
    const cliff = spline([[-20, 520], [160, 560], [300, 660], [380, 820], [470, 950], [520, 1100], [-20, 1100]], 8);
    acts.push(K.reveal((st) => st.mask(cliff, { feather: 1.2, rough: 0.35, roughScale: 0.08 }), { op: 'set', level: stage.mottle(2.4, 0.12), order: 'down', duration: 6 }));
    for (let i = 0; i < 5; i++) {
      const y = 620 + i * 90;
      acts.push(K.carve(spline([[20 + i * 30, y], [140 + i * 40, y + 30], [230 + i * 45, y + 80]], 8), { width: 3, strength: 0.45, speed: 260, rest: 0.05 }));
    }
    acts.push(...L.pine(stage, rng, { x: 250, y: 610, height: 380, lean: 0.9, tiers: 4, scale: 1.05, level: 2.6 }));
    const rocks = [[1320, 940, 190, 80], [1560, 900, 150, 70], [1760, 960, 220, 90], [1100, 990, 160, 60]];
    for (const [x, y, w, h] of rocks) {
      acts.push(K.reveal((st) => st.mask(spline([[x - w / 2, y + h / 2], [x - w * 0.4, y - h * 0.3], [x - w * 0.05, y - h / 2], [x + w * 0.35, y - h * 0.35], [x + w / 2, y + h / 2]], 8, true), { feather: 1, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: 2.3, order: 'up', duration: 1.6 }));
      acts.push(K.carve(spline([[x - w * 0.2, y - h * 0.2], [x, y - h * 0.38], [x + w * 0.25, y - h * 0.2]], 6), { width: 2.4, strength: 0.4, speed: 200 }));
    }
    for (let i = 0; i < 9; i++) {
      const y = 880 + i * 22;
      const x0 = 1050 + rng.float(-40, 40);
      acts.push(K.carve(spline([[x0, y], [x0 + 260, y + rng.float(-12, 12)], [x0 + 560, y + rng.float(-14, 14)], [1930, y + rng.float(-10, 10)]], 10), { width: 2.2 + i * 0.25, strength: 0.55, speed: 520, rest: 0.05 }));
    }
    acts.push(...standingCrane(stage, rng, { x: 1480, y: 870, u: 60 }));

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 880, y: 90, size: 58, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 804, 480, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Red-crowned crane standing on one leg, facing left.
export function standingCrane(stage, rng, { x, y, u }) {
  const P = ([a, b]) => [x + a * u, y + b * u];
  const acts = [];
  const body = ellipse(0, -2.6, 1.05, 0.46, -0.22, 40).map(([a, b]) => [a, b]);
  acts.push(K.reveal((st) => st.mask(body.map(P), { feather: 1 }), { op: 'carve', strength: 0.95, order: 'left', duration: 2 }));
  const neck = spline([[-0.72, -2.85], [-1.02, -3.45], [-0.82, -4.1], [-1.02, -4.7]], 10);
  acts.push(K.carve(neck.map(P), { width: 0.3 * u, strength: 0.95, speed: 110, taper: (t) => 1 - 0.35 * t }));
  acts.push(K.pour(spline([[-0.86, -3.0], [-1.08, -3.5], [-0.92, -4.05]], 8).map(P), { width: 0.1 * u, amount: 1.6, speed: 100, taper: K.taperBoth }));
  acts.push(K.reveal((st) => st.mask(ellipse(-1.06, -4.78, 0.2, 0.15, 0, 20).map(P), { feather: 0.6 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.5 }));
  acts.push(K.carve([P([-1.22, -4.76]), P([-1.82, -4.62])], { width: 0.08 * u, strength: 0.92, speed: 120, taper: (t) => 1 - 0.7 * t }));
  // Black tertials drooping over the tail.
  acts.push(K.reveal((st) => st.mask(spline([[0.55, -2.9], [1.25, -2.7], [1.55, -2.1], [1.2, -2.25], [0.8, -2.35]], 8, true).map(P), { feather: 1, rough: 0.3, roughScale: 0.3 }), { op: 'set', level: 2.6, order: 'right', duration: 1.2 }));
  // One leg straight down, the other folded up.
  acts.push(K.carve([P([0.05, -2.2]), P([0.02, -1.1]), P([0.06, 0])], { width: 0.07 * u, strength: 0.9, speed: 120, taper: K.even }));
  acts.push(K.carve([P([-0.1, -2.2]), P([-0.4, -1.6]), P([-0.05, -1.3])], { width: 0.07 * u, strength: 0.9, speed: 100, taper: K.even }));
  acts.push(K.redDot(stage, x - 1.02 * u, y - 4.9 * u, 0.1 * u));
  return acts;
}
