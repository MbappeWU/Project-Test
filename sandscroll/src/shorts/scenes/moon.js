import { ridge, underRidge, spline, ellipse } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 中秋 · 海上生明月 — a tall night sky, a full moon, its path on the sea, and two friends on a
// rock sharing the same moon (天涯共此时). Portrait canvas 1080x1920.
export default {
  id: 'moon',
  music: 'moonrise',
  title: { cn: '海上生明月', en: 'Mid-Autumn Moon' },
  hook: { cn: '画一轮中秋月，送给想念的人', en: 'A Mid-Autumn moon for someone you miss' },
  theme: '团圆 · 思念',
  poem: {
    columns: ['海上生明月', '天涯共此时'],
    cn: '海上生明月，天涯共此时',
    en: 'Over the sea a bright moon rises; far apart, we share this hour.',
    by: '唐 · 张九龄《望月怀远》  ·  Zhang Jiuling, Tang dynasty',
  },
  seal: '明月',
  build(stage, rng) {
    const H0 = 1180;
    const mx = rng.float(520, 600);
    const my = rng.float(620, 650);
    const mr = 158;
    const n = stage.noise;
    const off = rng.float(0, 100);
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(1.95, 0.5, 0, H0, 0.1, off), { y0: -60, y1: H0 + 40 }));
    const sea = stage.streaky(1.3, 0.22, 0.0014, 0.07, off + 5);
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1090, H0], [1090, 1930], [-10, 1930]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => sea(x, y) * (0.7 + 0.45 * Math.min(1, (y / stage.s - H0) / 600)),
        order: 'down',
        duration: 8,
      }),
    );
    const west = ridge(n, -160, 380, H0 + 3, 44, { offset: off, peaks: [[120, 40, 80]], taper: 0.3 });
    const east = ridge(n, 760, 1240, H0 + 3, 30, { offset: off + 30, peaks: [[980, 22, 70]], taper: 0.3 });
    acts.push(K.reveal((st) => st.mask(underRidge(west, H0 + 4), { feather: 1.2, rough: 0.25 }), { op: 'set', level: stage.mottle(2.1, 0.1), order: 'left', duration: 3 }));
    acts.push(K.reveal((st) => st.mask(underRidge(east, H0 + 4), { feather: 1.2, rough: 0.25 }), { op: 'set', level: stage.mottle(1.9, 0.1), order: 'right', duration: 3 }));
    acts.push(...K.moon(stage, mx, my, mr, { halo: 2.3, glow: 0.55, duration: 8 }));
    const cy = my + mr * rng.float(0.35, 0.6);
    acts.push(K.carve(spline([[mx - 480, cy + 30], [mx - 160, cy + 8], [mx + 160, cy + 16], [mx + 520, cy - 8]], 12), { width: 14, strength: 0.32, speed: 420, rim: 0.1 }));
    acts.push(K.carve(spline([[mx - 360, cy + 64], [mx - 60, cy + 50], [mx + 300, cy + 58]], 12), { width: 9, strength: 0.28, speed: 420, rim: 0.1 }));
    acts.push(...K.moonPath(stage, rng, { x: mx, horizon: H0, spread: 70, count: 40 }));
    acts.push(...K.waves(stage, rng, { horizon: H0, avoid: mx, count: 18, strength: 0.72 }));
    // Two friends on a foreground rock, looking at the same moon.
    const rock = spline([[-30, 1930], [-30, 1165], [70, 1146], [185, 1152], [268, 1186], [330, 1270], [380, 1430], [430, 1650], [470, 1930]], 8, true);
    acts.push(K.reveal((st) => st.mask(rock, { feather: 1, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: stage.mottle(2.5, 0.1), order: 'up', duration: 4 }));
    for (let i = 0; i < 4; i++) {
      const y = 1250 + i * 130;
      acts.push(K.carve(spline([[20 + i * 20, y], [140 + i * 30, y + 40], [230 + i * 40, y + 110]], 8), { width: 3, strength: 0.4, speed: 260, rest: 0.05 }));
    }
    acts.push(...sitter(96, 1150, 76));
    acts.push(...sitter(182, 1156, 66));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 968, y: 500, size: 66, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 886, 928, { size: 64, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A small seated figure seen from behind (robe and head), poured dark.
export function sitter(x, ground, h) {
  const body = spline([[x - h * 0.55, ground], [x - h * 0.45, ground - h * 0.5], [x - h * 0.2, ground - h * 0.95], [x + h * 0.2, ground - h * 0.95], [x + h * 0.45, ground - h * 0.5], [x + h * 0.55, ground]], 6, true);
  return [
    K.reveal((st) => st.mask(body, { feather: 0.6 }), { op: 'set', level: 2.8, order: 'up', duration: 0.8, rest: 0.05 }),
    K.reveal((st) => st.mask(ellipse(x, ground - h * 1.12, h * 0.2, h * 0.23, 0, 16), { feather: 0.5 }), { op: 'set', level: 2.8, order: 'up', duration: 0.4, rest: 0.1 }),
  ];
}
