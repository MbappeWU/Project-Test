import { spline, ridge } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 长桥卧波 — the Golden Gate Bridge rising out of the fog: a bridge joining two shores.
export default {
  id: 'goldengate',
  music: 'bridge',
  opening: 0.3,
  title: { cn: '长桥卧波', en: 'A Bridge upon the Waves' },
  poem: {
    columns: ['长桥卧波', '未云何龙'],
    cn: '长桥卧波，未云何龙',
    en: 'A long bridge lies upon the waves: no clouds, yet a dragon takes flight.',
    by: '唐 · 杜牧《阿房宫赋》  ·  Du Mu, Tang dynasty',
  },
  note: { cn: '金门大桥 · 旧金山', en: 'The Golden Gate Bridge, San Francisco' },
  seal: '长桥',
  build(stage, rng) {
    const n = stage.noise;
    const off = rng.float(0, 100);
    const W0 = 800;
    const deckY = 688;
    const t1 = rng.float(540, 580);
    const t2 = t1 + rng.float(770, 820);
    const topY = 450;
    const sky = stage.vgrad(0.85, 0.16, 0, W0, 0.12, off);
    const water = stage.streaky(0.95, 0.22, 0.0015, 0.07, off + 9);

    const acts = [];
    acts.push(...K.cover(stage, sky, { rows: 5, y0: -60, y1: W0 + 20, rate: 0.9 }));
    const marin = ridge(n, 1350, 2100, W0 - 4, 150, { offset: off, freq: 1 / 300, peaks: [[1700, 70, 200]], taper: 0.25 });
    const city = ridge(n, -150, 520, W0 - 4, 70, { offset: off + 20, freq: 1 / 200, taper: 0.3 });
    acts.push(L.range(stage, marin, { level: 0.62, mist: 0.6, mistDepth: 90, order: 'right', duration: 6 }));
    acts.push(L.range(stage, city, { level: 0.5, mist: 0.6, mistDepth: 60, duration: 4 }));
    acts.push(
      K.reveal((st) => st.mask([[-10, W0], [1930, W0], [1930, 1090], [-10, 1090]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => water(x, y) * (0.8 + 0.4 * Math.min(1, (y / stage.s - W0) / 280)),
        order: 'down',
        duration: 7,
      }),
    );

    // Towers: two legs joined by stepped portal struts (Art Deco silhouette).
    for (const tx of [t1, t2]) acts.push(...tower(stage, tx, W0 + 10, topY));
    // Deck and approach piers.
    acts.push(K.reveal((st) => st.mask([[-10, deckY], [1930, deckY], [1930, deckY + 13], [-10, deckY + 13]], { feather: 0.6 }), { op: 'set', level: 2.4, order: 'left', duration: 6 }));
    acts.push(K.carve([[0, deckY + 16], [1920, deckY + 16]], { width: 2, strength: 0.45, speed: 900, taper: () => 1 }));
    for (const px of [80, 220, t2 + 330, t2 + 470]) {
      if (px > 1900) continue;
      acts.push(K.pour([[px, deckY + 12], [px, W0 + 6]], { width: 9, amount: 2.2, speed: 220, taper: () => 1 }));
    }
    // Main and side cables, then the suspenders.
    const sag = deckY - 12;
    const main = parabola(t1, topY, t2, topY, sag);
    const left = parabola(t1 - 460, deckY - 4, t1, topY, null);
    const right = parabola(t2, topY, t2 + 460, deckY - 4, null);
    for (const c of [left, main, right]) acts.push(K.pour(c, { width: 4.5, amount: 2.4, speed: 420, taper: () => 1, scatter: 0.1 }));
    for (const c of [left, main, right]) {
      for (let i = 2; i < c.length - 2; i += 2) {
        const [x, y] = c[i];
        if (y > deckY - 8) continue;
        acts.push(K.pour([[x, y], [x, deckY]], { width: 1.5, amount: 1.3, speed: 900, rest: 0.01, taper: () => 1, scatter: 0 }));
      }
    }
    // Fog rolling through the Golden Gate (the towers' feet dissolve into it).
    acts.push(L.mistBand(stage, { y: W0 - 20, height: 70, strength: 0.62, duration: 5 }));
    acts.push(L.mistBand(stage, { y: 380, height: 45, x0: 1100, x1: 1920, strength: 0.35, duration: 3 }));
    // Tower reflections and a small sailboat.
    for (const tx of [t1, t2]) {
      for (let y = W0 + 20; y < 1060; y += rng.float(14, 26)) {
        const w = rng.float(8, 30);
        acts.push(K.pour([[tx - w / 2 + rng.float(-4, 4), y], [tx + w / 2, y]], { width: 3, amount: 0.7, speed: 300, rest: 0.01, taper: () => 1 }));
      }
    }
    const bx = rng.float(1450, 1650);
    const by = rng.float(930, 980);
    acts.push(K.reveal((st) => st.mask([[bx, by - 90], [bx + 58, by - 6], [bx, by - 6]], { feather: 0.8 }), { op: 'carve', strength: 0.85, order: 'down', duration: 1.5 }));
    acts.push(K.reveal((st) => st.mask([[bx - 4, by - 70], [bx - 42, by - 8], [bx - 4, by - 8]], { feather: 0.8 }), { op: 'carve', strength: 0.75, order: 'down', duration: 1.2 }));
    acts.push(K.pour([[bx - 2, by - 96], [bx - 2, by - 2]], { width: 3, amount: 2, speed: 200 }));
    acts.push(K.reveal((st) => st.mask(spline([[bx - 60, by], [bx + 70, by], [bx + 50, by + 14], [bx - 44, by + 14]], 3), { feather: 0.8 }), { op: 'set', level: 2.4, order: 'left', duration: 1.2 }));
    acts.push(...K.waves(stage, rng, { horizon: W0, count: 12, strength: 0.55 }));

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 250, y: 80, size: 60, mode: 'pour', amount: 1.5, perChar: 1.4 }));
    acts.push(...K.seal(stage, this.seal, 170, 390, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

function parabola(x0, y0, x1, y1, lowY) {
  const pts = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    let y;
    if (lowY !== null) y = y0 + (y1 - y0) * t + 4 * (lowY - (y0 + y1) / 2) * t * (1 - t);
    else y = y0 + (y1 - y0) * t + 60 * t * (1 - t);
    pts.push([x, y]);
  }
  return pts;
}

function tower(stage, cx, baseY, topY) {
  const acts = [];
  const h = baseY - topY;
  const legW = 15;
  const gap = 20;
  const levels = [0.2, 0.46, 0.67, 0.85];
  const legs = [-1, 1].map((side) => {
    const inner = cx + side * (gap / 2);
    const outer = cx + side * (gap / 2 + legW);
    const pts = [[inner, baseY], [outer, baseY]];
    // Stepped setbacks at each strut level.
    let o = outer;
    for (const f of levels) {
      const y = baseY - h * f;
      pts.push([o, y]);
      o -= side * 1.6;
      pts.push([o, y]);
    }
    pts.push([o, topY], [inner, topY]);
    return side < 0 ? pts : pts;
  });
  for (const leg of legs) acts.push(K.reveal((st) => st.mask(leg, { feather: 0.6 }), { op: 'set', level: 2.5, order: 'up', duration: 3.2, jitter: 0.01 }));
  for (const f of [...levels, 0.995]) {
    const y = baseY - h * f;
    const hh = f > 0.99 ? 12 : 9;
    const w = gap / 2 + legW + 1;
    acts.push(K.reveal((st) => st.mask([[cx - w, y - hh / 2], [cx + w, y - hh / 2], [cx + w, y + hh / 2], [cx - w, y + hh / 2]], { feather: 0.5 }), { op: 'set', level: 2.5, order: 'left', duration: 0.5, rest: 0.05 }));
  }
  // Vertical fluting catches the light.
  for (const side of [-1, 1]) {
    const x = cx + side * (gap / 2 + legW * 0.5);
    acts.push(K.carve([[x, baseY - 6], [x, topY + 14]], { width: 1.6, strength: 0.4, speed: 500, taper: () => 1 }));
  }
  return acts;
}
