import { spline } from '../core/geom.js';
import * as K from '../core/kit.js';

// Programme title card: 山海不为远 carved large, then the dedication.
export default {
  id: 'title',
  music: 'moonrise',
  opening: 0.95,
  title: { cn: '山海不为远', en: 'No Distance Too Far' },
  poem: null,
  note: {
    cn: '中国风沙画 · 古琴 · 古筝 · 洞箫  |  谨以此卷，记2026年中美元首互访',
    en: 'Chinese sand painting with guqin, guzheng and xiao  |  On the occasion of the 2026 China–U.S. state visits',
  },
  seal: '沙卷',
  build(stage, rng) {
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(1.2, 0.95, 0, 1080, 0.14, rng.float(0, 50)), { rows: 5, y0: -60, y1: 1140, rate: 0.9 }));
    // A single horizon line and a small rising moon frame the title.
    acts.push(K.carve(spline([[260, 700], [700, 694], [1220, 698], [1660, 692]], 10), { width: 4, strength: 0.65, speed: 520, rim: 0.3 }));
    acts.push(...K.moon(stage, 1510, 250, 40, { halo: 2.6, glow: 0.45, duration: 4 }));
    acts.push(
      K.inscribe(stage, {
        columns: ['山', '海', '不', '为', '远'],
        x: 610,
        y: 380,
        size: 150,
        colGap: 1.18,
        ltr: true,
        mode: 'carve',
        strength: 0.93,
        perChar: 2.8,
      }),
    );
    acts.push(...K.seal(stage, this.seal, 1440, 575, { size: 72, seed: rng.int(1, 999) }));
    acts.push(K.carve(spline([[760, 770], [900, 764], [1060, 768], [1160, 762]], 8), { width: 2.4, strength: 0.5, speed: 300 }));
    acts.push(K.carve(spline([[840, 800], [960, 796], [1080, 800]], 8), { width: 2, strength: 0.4, speed: 300 }));
    return acts;
  },
};
