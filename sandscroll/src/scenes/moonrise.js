import { ridge, underRidge, spline } from '../core/geom.js';
import * as K from '../core/kit.js';

// 海上生明月 — one moon over the Pacific, seen from both shores.
export default {
  id: 'moonrise',
  music: 'moonrise',
  opening: 0.9,
  title: { cn: '海上生明月', en: 'Moonrise over the Pacific' },
  poem: {
    columns: ['海上生明月', '天涯共此时'],
    cn: '海上生明月，天涯共此时',
    en: 'Over the sea a bright moon rises; far apart, we share this hour.',
    by: '唐 · 张九龄《望月怀远》  ·  Zhang Jiuling, Tang dynasty',
  },
  seal: '明月',
  build(stage, rng) {
    const H0 = 640;
    const mx = rng.float(1210, 1400);
    const my = rng.float(250, 300);
    const mr = rng.float(80, 90);
    const n = stage.noise;
    const off = rng.float(0, 100);

    const sky = stage.vgrad(1.85, 0.42, 0, H0, 0.1, off);
    const sea = stage.streaky(1.25, 0.22, 0.0012, 0.08, off + 7);
    const seaLevel = (x, y) => sea(x, y) * (0.72 + 0.5 * Math.min(1, (y / stage.s - H0) / 420));

    const leftShore = ridge(n, -200, 560, H0 + 3, 60, { offset: off, peaks: [[140, 60, 90], [330, 28, 70]], taper: 0.3 });
    const rightShore = ridge(n, 1540, 2100, H0 + 3, 34, { offset: off + 40, peaks: [[1800, 24, 80]], taper: 0.35 });

    const acts = [];
    acts.push(...K.cover(stage, sky, { rows: 6, y0: -60, y1: H0 + 40 }));
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1930, H0], [1930, 1090], [-10, 1090]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: seaLevel,
        order: 'down',
        duration: 9,
        jitter: 0.03,
      }),
    );
    acts.push(
      K.reveal((st) => st.mask(underRidge(leftShore, H0 + 6), { feather: 1.5, rough: 0.25 }), { op: 'set', level: stage.mottle(2.1, 0.1), order: 'left', duration: 6 }),
      K.reveal((st) => st.mask(underRidge(rightShore, H0 + 6), { feather: 1.5, rough: 0.25 }), { op: 'set', level: stage.mottle(1.9, 0.1), order: 'right', duration: 4 }),
    );
    acts.push(...K.moon(stage, mx, my, mr, { halo: 2.6, glow: 0.55 }));

    // Thin clouds drifting across the moon, one curling in the Chinese manner.
    const cy = my + mr * rng.float(0.45, 0.8);
    acts.push(
      K.carve(spline([[mx - 520, cy + 30], [mx - 200, cy + 8], [mx + 120, cy + 14], [mx + 420, cy - 6]], 12), { width: 13, strength: 0.32, speed: 420, rim: 0.1 }),
      K.carve(spline([[mx - 380, cy + 58], [mx - 90, cy + 44], [mx + 260, cy + 50]], 12), { width: 8, strength: 0.28, speed: 420, rim: 0.1 }),
    );

    acts.push(...K.moonPath(stage, rng, { x: mx, horizon: H0, count: 30 }));
    acts.push(...K.waves(stage, rng, { horizon: H0, avoid: mx, count: 18, strength: 0.75 }));

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 330, y: 105, size: 64, mode: 'carve', strength: 0.9, perChar: 1.35 }));
    acts.push(...K.seal(stage, this.seal, 205, 520, { size: 64, seed: rng.int(1, 999) }));
    return acts;
  },
};
