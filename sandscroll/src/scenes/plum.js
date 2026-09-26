import { ellipse, TAU } from '../core/geom.js';
import * as K from '../core/kit.js';

// 梅 — a plum branch slanting across the moon above shallow water.
export default {
  id: 'plum',
  music: 'plum',
  opening: 0.7,
  title: { cn: '梅', en: 'Plum Blossom' },
  poem: {
    columns: ['疏影横斜水清浅', '暗香浮动月黄昏'],
    cn: '疏影横斜水清浅，暗香浮动月黄昏',
    en: 'Sparse shadows slant across clear shallow water; a hidden fragrance drifts in the moonlit dusk.',
    by: '宋 · 林逋《山园小梅》  ·  Lin Bu, Song dynasty',
  },
  seal: '暗香',
  build(stage, rng) {
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(1.25, 0.8, 0, 1080, 0.12, rng.float(0, 50)), { rows: 5, y0: -60, y1: 1140 }));
    const mx = rng.float(1080, 1180);
    const my = rng.float(330, 380);
    acts.push(...K.moon(stage, mx, my, 170, { halo: 1.7, glow: 0.4, duration: 9 }));
    // Shallow water: a few long light strokes near the bottom.
    for (let i = 0; i < 6; i++) {
      const y = 900 + i * 28;
      const x0 = rng.float(200, 700);
      acts.push(K.carve([[x0, y], [x0 + rng.float(500, 1000), y + rng.float(-3, 3)]], { width: 3 + i * 0.5, strength: 0.4, speed: 520, rest: 0.05 }));
    }
    // Angular old branch (女字枝) from lower left, sweeping up across the moon.
    const main = [[40, 1000], [260, 860], [360, 880], [560, 700], [700, 650], [860, 520], [1020, 470], [1240, 330], [1420, 250], [1600, 210]];
    acts.push(K.pour(main, { width: 48, amount: 3, speed: 100, taper: (u) => 1 - 0.78 * u, scatter: 0.35, hard: 0.55 }));
    // Bark: a few light scratches along the old wood.
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = main[i];
      const [bx, by] = main[i + 1];
      acts.push(K.carve([[ax + (bx - ax) * 0.2, ay + (by - ay) * 0.2 - 4], [ax + (bx - ax) * 0.75, ay + (by - ay) * 0.75 - 3]], { width: 2.4, strength: 0.4, speed: 200, rest: 0.03 }));
    }
    const twigs = [];
    for (let i = 2; i < main.length - 1; i++) {
      const [x, y] = main[i];
      const up = i % 2 === 0;
      const len = rng.float(110, 200) * (1 - i * 0.05);
      const a = up ? rng.float(-2.3, -1.6) : rng.float(-0.6, 0.2);
      const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len];
      const mid = [x + Math.cos(a) * len * 0.55 + rng.float(-10, 10), y + Math.sin(a) * len * 0.55 + rng.float(-10, 10)];
      twigs.push([[x, y], mid, tip]);
      acts.push(K.pour([[x, y], mid, tip], { width: 13, amount: 2.7, speed: 160, taper: (u) => 1 - 0.75 * u }));
      const a2 = a + (up ? 0.6 : -0.6);
      const tip2 = [mid[0] + Math.cos(a2) * len * 0.4, mid[1] + Math.sin(a2) * len * 0.4];
      twigs.push([mid, tip2]);
      acts.push(K.pour([mid, tip2], { width: 5, amount: 2.3, speed: 160, taper: (u) => 1 - 0.8 * u, rest: 0.05 }));
    }
    // Blossoms carved in light along branch and twigs; dark buds at the tips.
    const spots = [];
    for (const t of twigs) for (const p of t.slice(1)) spots.push(p);
    for (let i = 3; i < main.length; i++) spots.push(main[i]);
    for (const [x, y] of spots) {
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const bx = x + rng.float(-26, 26);
        const by = y + rng.float(-22, 22);
        const r = rng.float(14, 22);
        acts.push(...blossom(bx, by, r, rng.float(0, TAU)));
      }
      acts.push(K.reveal((st) => st.mask(ellipse(x + rng.float(-8, 8), y + rng.float(-8, 8), 4.5, 5.5, 0, 12), { feather: 0.5 }), { op: 'set', level: 2.6, order: 'out', duration: 0.2, rest: 0.03 }));
    }
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 300, y: 70, size: 52, mode: 'carve', strength: 0.88, perChar: 1.15 }));
    acts.push(...K.seal(stage, this.seal, 230, 515, { size: 56, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Five rounded petals carved from the sand, a dark calyx dot and stamens.
function blossom(x, y, r, rot) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * TAU) / 5;
    petals.push(ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.44, a, 16));
  }
  const acts = [K.reveal((st) => st.mask(petals, { feather: 0.6 }), { op: 'carve', strength: 0.9, order: 'out', duration: 0.5, rest: 0.03 })];
  acts.push(K.reveal((st) => st.mask(ellipse(x, y, r * 0.16, r * 0.16, 0, 10), { feather: 0.4 }), { op: 'set', level: 1.6, order: 'out', duration: 0.1, rest: 0 }));
  for (let i = 0; i < 3; i++) {
    const a = rot + i * 2.1;
    acts.push(K.pour([[x, y], [x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45]], { width: 1.2, amount: 1.2, speed: 60, taper: K.even, rest: 0 }));
  }
  return acts;
}
