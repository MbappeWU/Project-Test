import { ridge } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 长城 — the Great Wall over layered ranges at dawn, geese heading east across the sea.
export default {
  id: 'greatwall',
  music: 'wall',
  opening: 0.22,
  title: { cn: '长城', en: 'The Great Wall at Dawn' },
  poem: {
    columns: ['志合者', '不以山海为远'],
    cn: '志合者，不以山海为远',
    en: 'For those who share a purpose, no mountain and no sea is too far.',
    by: '晋 · 葛洪《抱朴子》  ·  Ge Hong, Jin dynasty',
  },
  seal: '山海',
  build(stage, rng) {
    const n = stage.noise;
    const off = rng.float(0, 200);
    const sunX = rng.float(420, 640);
    const sunY = rng.float(250, 320);
    const sky = stage.vgrad(0.62, 0.1, 0, 640, 0.14, off);

    const far = ridge(n, -60, 1980, 560, 150, { offset: off, freq: 1 / 380, peaks: [[rng.float(300, 700), 80, 160]] });
    const mid = ridge(n, -60, 1980, 660, 190, { offset: off + 31, freq: 1 / 330, peaks: [[rng.float(1100, 1500), 110, 190]] });
    const wallRidge = ridge(n, -60, 1980, 790, 210, { offset: off + 57, freq: 1 / 300, peaks: [[rng.float(700, 1000), 120, 200], [rng.float(1500, 1750), 70, 150]] });
    const near = ridge(n, -80, 980, 1150, 330, { offset: off + 83, freq: 1 / 260, peaks: [[140, 150, 190]], taper: 0.3 });
    const nearRight = ridge(n, 1250, 2100, 1130, 160, { offset: off + 97, freq: 1 / 240, peaks: [[1800, 60, 150]], taper: 0.3 });

    const towers = [];
    const step = rng.float(230, 300);
    for (let x = 180 + rng.float(0, 80); x < 1860; x += step * rng.float(0.8, 1.2)) {
      // Snap each tower to the local high point of the ridge.
      let best = x;
      for (let dx = -60; dx <= 60; dx += 6) if (L.crestAt(wallRidge, x + dx) < L.crestAt(wallRidge, best)) best = x + dx;
      towers.push(best);
    }

    const acts = [];
    acts.push(...K.cover(stage, sky, { rows: 5, y0: -60, y1: 700, rate: 0.9 }));
    acts.push(...K.moon(stage, sunX, sunY, 62, { halo: 3.2, glow: 0.5, strength: 0.9, duration: 5 }));
    acts.push(L.range(stage, far, { level: 0.42, mist: 0.85, mistDepth: 150, duration: 8 }));
    acts.push(L.greatWall(stage, far, { x0: 60, x1: 1860, offset: 3, thick: 5, tooth: 4, level: 0.95, towers: towers.filter((_, i) => i % 2).map((x) => x + 40), towerW: 12, towerH: 11, duration: 6, walk: false }));
    acts.push(L.range(stage, mid, { level: 0.75, mist: 0.9, mistDepth: 170, order: 'right', duration: 8 }));
    acts.push(L.range(stage, wallRidge, { level: 1.15, mist: 0.85, mistDepth: 190, duration: 9 }));
    acts.push(L.greatWall(stage, wallRidge, { x0: -20, x1: 1940, offset: 4, thick: 15, tooth: 8, level: 2.5, towers, duration: 12 }));
    acts.push(...L.flock(stage, rng, { x: rng.float(1250, 1450), y: rng.float(170, 230), count: 7, size: 13, dx: 40, dy: 15, level: 1.2 }));
    acts.push(L.range(stage, nearRight, { level: 1.45, mist: 0.5, mistDepth: 120, order: 'right', duration: 5 }));
    acts.push(L.range(stage, near, { level: 2.1, mist: 0.15, mistDepth: 60, duration: 6 }));
    acts.push(...L.pine(stage, rng, { x: 300, y: L.crestAt(near, 300) + 14, height: 290, lean: 0.55, tiers: 4 }));

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 1790, y: 70, size: 58, mode: 'pour', amount: 1.5, perChar: 1.35 }));
    acts.push(...K.seal(stage, this.seal, 1717, 520, { size: 60, seed: rng.int(1, 999) }));
    return acts;
  },
};
