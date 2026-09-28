import { spline, ellipse } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 竹里馆 — a recluse playing the qin alone in a moonlit bamboo grove.
export default {
  id: 'bamboo',
  music: 'bamboo',
  opening: 0.9,
  title: { cn: '竹里馆', en: 'The Bamboo Grove' },
  poem: {
    columns: ['独坐幽篁里', '弹琴复长啸'],
    cn: '独坐幽篁里，弹琴复长啸',
    en: 'Alone I sit in the secluded bamboo, playing the qin and whistling long.',
    by: '唐 · 王维《竹里馆》  ·  Wang Wei, Tang dynasty',
  },
  seal: '清风',
  build(stage, rng) {
    const acts = [];
    const ground = 930;
    acts.push(...K.cover(stage, stage.vgrad(1.6, 1.0, 0, 1080, 0.12, rng.float(0, 60)), { rows: 6, y0: -60, y1: 1140 }));
    const mx = rng.float(820, 1000);
    acts.push(...K.moon(stage, mx, 230, 110, { halo: 2.4, glow: 0.5 }));
    // Distant bamboo carved in light (moonlit), near bamboo poured dark.
    for (const x of [620, 1180, 1400]) acts.push(...carvedBamboo(x, ground, rng));
    acts.push(...L.bambooGrove(stage, rng, { x: 250, top: -40, bottom: ground + 20, count: 3, lean: 0.03 }));
    acts.push(...L.bambooGrove(stage, rng, { x: 1700, top: -40, bottom: ground + 20, count: 3, lean: -0.04 }));
    acts.push(K.reveal((st) => st.mask([[-10, ground], [1930, ground], [1930, 1090], [-10, 1090]], { feather: 2, rough: 0.3 }), { op: 'set', level: 2.0, order: 'left', duration: 4 }));
    acts.push(...scholar(900, ground));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 1400, y: 380, size: 52, mode: 'carve', strength: 0.88, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 1332, 760, { size: 54, seed: rng.int(1, 999) }));
    return acts;
  },
};

function carvedBamboo(x, ground, rng) {
  const acts = [];
  const w = rng.float(9, 13);
  for (let y = ground; y > -40; y -= 120) {
    acts.push(K.carve([[x, y], [x + 4, y - 112]], { width: w, strength: 0.42, speed: 300, taper: K.even, rest: 0.02 }));
  }
  for (let k = 0; k < 2; k++) {
    const cy = rng.float(200, 600);
    for (let j = 0; j < 3; j++) {
      const a = (rng.chance(0.5) ? 0.4 : Math.PI - 0.4) + (j - 1) * 0.45;
      const L = rng.float(70, 100);
      acts.push(K.carve(spline([[x, cy], [x + Math.cos(a) * L * 0.5, cy + Math.sin(a) * L * 0.5 - 6], [x + Math.cos(a) * L, cy + Math.sin(a) * L]], 6), { width: 12, strength: 0.4, speed: 200, taper: K.taperEnd, rest: 0.03 }));
    }
  }
  return acts;
}

// Seated figure with a qin across the knees, silhouetted against the moonlit grove.
function scholar(x, ground) {
  const acts = [];
  const body = spline([[x - 70, ground], [x - 58, ground - 60], [x - 28, ground - 120], [x, ground - 132], [x + 26, ground - 118], [x + 60, ground - 58], [x + 76, ground]], 8, true);
  acts.push(K.reveal((st) => st.mask(body, { feather: 0.8 }), { op: 'set', level: 2.7, order: 'up', duration: 2.4 }));
  acts.push(K.reveal((st) => st.mask(ellipse(x + 2, ground - 150, 17, 20, 0, 24), { feather: 0.8 }), { op: 'set', level: 2.7, order: 'up', duration: 0.8 }));
  acts.push(K.reveal((st) => st.mask(ellipse(x + 2, ground - 174, 8, 8, 0, 16), { feather: 0.6 }), { op: 'set', level: 2.7, order: 'up', duration: 0.4 }));
  // The qin: a long slender board across the lap.
  acts.push(K.pour([[x - 120, ground - 44], [x + 130, ground - 58]], { width: 11, amount: 2.8, speed: 160, taper: K.even }));
  acts.push(K.carve([[x - 110, ground - 50], [x + 120, ground - 63]], { width: 1.4, strength: 0.6, speed: 200, taper: K.even }));
  return acts;
}
