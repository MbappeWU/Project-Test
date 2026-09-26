import { ridge, spline, ellipse } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 江雪 — a lone fisherman in straw cape and hat, fishing the cold river in falling snow.
export default {
  id: 'riverboat',
  music: 'river',
  opening: 0.5,
  title: { cn: '江雪', en: 'River Snow' },
  poem: {
    columns: ['孤舟蓑笠翁', '独钓寒江雪'],
    cn: '孤舟蓑笠翁，独钓寒江雪',
    en: 'In a lone boat, an old man in straw cape and hat fishes alone in the snow on the cold river.',
    by: '唐 · 柳宗元《江雪》  ·  Liu Zongyuan, Tang dynasty',
  },
  seal: '江雪',
  build(stage, rng) {
    const n = stage.noise;
    const off = rng.float(0, 100);
    const acts = [];
    const R = 700;
    acts.push(...K.cover(stage, stage.vgrad(0.95, 0.55, 0, R, 0.12, off), { rows: 5, y0: -60, y1: R + 40 }));
    // Snow-covered ranges: pale masses edged with dark rock lines.
    const back = ridge(n, -60, 1980, R - 10, 230, { offset: off, freq: 1 / 330, peaks: [[rng.float(500, 900), 120, 200]] });
    const front = ridge(n, 900, 2050, R + 4, 170, { offset: off + 40, freq: 1 / 260, peaks: [[1500, 80, 160]], taper: 0.25 });
    acts.push(L.range(stage, back, { base: R + 4, level: 0.16, mist: 0.1, mistDepth: 40, duration: 6 }));
    acts.push(K.pour(back, { width: 4, amount: 2.2, speed: 420, taper: K.even, scatter: 0.4 }));
    acts.push(...rockLines(back, rng, 16));
    acts.push(L.range(stage, front, { base: R + 4, level: 0.1, mist: 0.1, mistDepth: 30, order: 'right', duration: 5 }));
    acts.push(K.pour(front, { width: 4.5, amount: 2.4, speed: 420, taper: K.even, scatter: 0.4 }));
    acts.push(...rockLines(front, rng, 10));
    // The river.
    acts.push(
      K.reveal((st) => st.mask([[-10, R], [1930, R], [1930, 1090], [-10, 1090]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: stage.streaky(0.75, 0.2, 0.0015, 0.08, off + 3),
        order: 'down',
        duration: 6,
      }),
    );
    for (let i = 0; i < 8; i++) {
      const y = R + 40 + i * 42;
      const x0 = rng.float(-50, 1200);
      acts.push(K.carve([[x0, y], [x0 + rng.float(300, 700), y + rng.float(-3, 3)]], { width: 2.5 + i * 0.4, strength: 0.45, speed: 520, rest: 0.05 }));
    }
    // Lone boat and the fisherman.
    const bx = rng.float(1020, 1160);
    const by = 860;
    acts.push(K.reveal((st) => st.mask(spline([[bx - 170, by - 16], [bx - 60, by + 4], [bx + 80, by + 2], [bx + 170, by - 22], [bx + 120, by + 18], [bx - 110, by + 20]], 8, true), { feather: 0.8 }), { op: 'set', level: 2.7, order: 'left', duration: 2.5 }));
    acts.push(K.reveal((st) => st.mask(spline([[bx - 40, by - 6], [bx - 36, by - 60], [bx - 8, by - 88], [bx + 22, by - 60], [bx + 30, by - 6]], 8, true), { feather: 0.8, rough: 0.35, roughScale: 0.4 }), { op: 'set', level: 2.6, order: 'up', duration: 1.8 }));
    acts.push(K.reveal((st) => st.mask([[bx - 50, by - 86], [bx + 34, by - 86], [bx - 8, by - 118]], { feather: 0.8 }), { op: 'set', level: 2.7, order: 'up', duration: 1 }));
    acts.push(K.pour(spline([[bx + 14, by - 60], [bx + 150, by - 150], [bx + 300, by - 180]], 10), { width: 3, amount: 2.2, speed: 200, taper: (u) => 1 - 0.7 * u }));
    acts.push(K.pour([[bx + 300, by - 178], [bx + 306, by + 40]], { width: 1.2, amount: 1.4, speed: 200, taper: K.even }));
    acts.push(K.carve(spline([[bx - 190, by + 26], [bx, by + 30], [bx + 190, by + 26]], 6), { width: 2.2, strength: 0.5, speed: 300 }));
    acts.push(snow(stage, rng, 260));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 330, y: 70, size: 56, mode: 'pour', amount: 1.6, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 255, 470, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Dark rock strokes (皴法) under the ridge: short, roughly parallel, following the slope.
function rockLines(crest, rng, count) {
  const acts = [];
  for (let i = 0; i < count; i++) {
    const k = rng.int(3, crest.length - 4);
    const [x, y] = crest[k];
    const [nx, ny] = crest[k + 2];
    const slope = Math.atan2(ny - y, nx - x);
    const down = slope + (slope < 0 ? -1 : 1) * 1.2;
    for (let j = 0; j < rng.int(2, 4); j++) {
      const sx = x + j * 9 + rng.float(-3, 3);
      const sy = y + 6 + j * 5;
      const len = rng.float(26, 60);
      const a = Math.PI / 2 + (down - Math.PI / 2) * 0.35 + rng.float(-0.15, 0.15);
      acts.push(K.pour([[sx, sy], [sx + Math.cos(a) * len, sy + Math.sin(a) * len]], { width: 3, amount: 1.7, speed: 220, taper: (u) => 1 - 0.85 * u, rest: 0.02, scatter: 0.2 }));
    }
  }
  return acts;
}

// Falling snow: many small flakes carved in one gesture, appearing in random order.
function snow(stage, rng, count) {
  const flakes = [];
  for (let i = 0; i < count; i++) {
    const r = rng.float(2.2, 4.6);
    flakes.push(ellipse(rng.float(0, 1920), rng.float(0, 1070), r, r, 0, 8));
  }
  return K.reveal((st) => st.mask(flakes, { feather: 0.4 }), { op: 'carve', strength: 0.9, order: () => 0, jitter: 1, duration: 16 });
}
