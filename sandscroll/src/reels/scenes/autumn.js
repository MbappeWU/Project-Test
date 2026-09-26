import { spline, ellipse, ridge, underRidge } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import { Mask } from '../../core/mask.js';

// 一叶知秋 — a bare branch, a great maple leaf turning as it falls and a few more drifting down;
// a gust of wind sweeps them off and they rise again as a V of wild geese flying south across
// a pale moon, over low distant hills.
const V = {
  lead: [206, 906],
  upper: [[344, 846], [482, 786], [620, 726], [758, 666]],
  lower: [[344, 962], [482, 1018], [620, 1074], [758, 1130]],
};
const MOON = [640, 700, 185];

export default {
  id: 'autumn',
  music: 'plum',
  title: { cn: '一叶知秋', en: 'Autumn in One Leaf' },
  theme: '季节 · 秋天（#FallVibes）',
  hook: { en: 'Autumn, in one leaf', cn: '一叶知秋' },
  payoff: { en: 'Let it fall. Watch it fly.', cn: '叶落，雁南飞' },
  inscription: { columns: ['一叶知秋'], note: '出自《淮南子》“见一叶落而知岁之将暮”' },
  seal: '秋',
  twist: '飘落的枫叶化作一行南飞的大雁',
  build(stage, rng) {
    const off = rng.float(0, 100);
    const acts = [];

    // Picture A: the branch in one bright stroke, the great leaf, leaves on the branch and falling.
    const branch = spline([[-40, 462], [110, 492], [250, 540], [372, 600], [468, 676]], 10);
    const first = K.carve(branch, { width: 40, strength: 0.94, speed: 700, rim: 0.35, taper: (u) => 1 - 0.72 * u, rest: 0.05 });
    first.mark = 'open';
    acts.push(first);
    const twigs = [
      [[118, 494], [150, 452], [196, 420]],
      [[250, 540], [300, 520], [352, 526]],
      [[372, 600], [382, 644], [370, 690]],
      [[196, 520], [214, 566], [206, 606]],
    ];
    for (const t of twigs) acts.push(K.carve(spline(t, 6), { width: 12, strength: 0.9, speed: 500, rim: 0.25, taper: (u) => 1 - 0.65 * u, rest: 0.02 }));

    const big = maple(500, 1110, 390, 0.4, 0.86);
    acts.push(...leaf(big, { strength: 0.8, duration: 2.2, veins: true }));
    const bigVeins = K.wait(0.01);
    bigVeins.mark = 'A';
    acts.push(bigVeins);

    // Leaves still on the branch (they stay to the end) and three more falling.
    const kept = [maple(196, 420, 58, -0.5, 0.9), maple(352, 526, 50, 0.9, 0.75), maple(206, 606, 44, 2.7, 0.8)];
    for (const l of kept) acts.push(...leaf(l, { strength: 0.85, duration: 0.5 }));
    const falling = [maple(200, 930, 64, -0.9, 0.55), maple(790, 650, 70, 1.1, 0.8), maple(790, 1150, 56, 2.2, 0.6), maple(470, 700, 46, -2.4, 0.9)];
    for (const l of falling) acts.push(...leaf(l, { strength: 0.85, duration: 0.55 }));
    acts.push(K.wait(2));

    // Twist: a gust of wind sweeps the leaves away...
    const sky = stage.vgrad(2.0, 1.45, 380, 1250, 0.08, off);
    const gusts = [[1110, 800, -50, 730], [-50, 910, 1110, 860], [1110, 1030, -50, 980], [-50, 1150, 1110, 1110], [1110, 700, 300, 690]];
    gusts.forEach(([x0, y0, x1, y1], i) => {
      const pts = spline([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 + (i % 2 ? 40 : -40)], [x1, y1]], 16);
      const g = K.palm(pts, { width: i === 4 ? 180 : 250, speed: 1700, target: sky, rate: 0.93, streak: stage.streaks[i % 3], hard: 0.35, rest: 0.05 });
      if (i === 0) g.mark = 'twist';
      acts.push(g);
    });
    // The palm settles the dust of the gust into clean evening sky.
    acts.push(...K.cover(stage, sky, { y0: 760, y1: 1320, width: 260, speed: 2600, rate: 0.95, wave: 10 }));
    // ...a pale moon rises behind them, and they fly again as geese.
    acts.push(...K.moon(stage, MOON[0], MOON[1], MOON[2], { strength: 0.55, glow: 0.28, halo: 1.9, duration: 1.8 }));
    const birds = [[V.lead, 92, 0]];
    for (let i = 0; i < 4; i++) {
      birds.push([V.upper[i], 84 - 6 * i, (i * 2 + 1) % 3]);
      birds.push([V.lower[i], 84 - 6 * i, (i * 2 + 2) % 3]);
    }
    for (const [[x, y], size, pose] of birds) acts.push(goose(x, y, size, pose));
    const flock = K.wait(0.01);
    flock.mark = 'geese';
    acts.push(flock);

    // Final: dusk light on the horizon and low distant hills, calm under the payoff line.
    acts.push(K.reveal((st) => horizonGlow(st, 1080, 1250, 1290), { op: 'carve', strength: 0.5, order: 'left', duration: 1.4, jitter: 0.03 }));
    const n = stage.noise;
    const far = ridge(n, -40, 1120, 1262, 60, { offset: off, peaks: [[800, 70, 140], [150, 40, 120]] });
    const near = ridge(n, -40, 1120, 1318, 40, { offset: off + 30, peaks: [[340, 50, 190], [1000, 30, 120]] });
    acts.push(K.reveal((st) => st.mask(underRidge(far, 1940), { feather: 1.5, rough: 0.2 }), { op: 'set', level: stage.mottle(2.2, 0.08), order: 'right', duration: 1.6 }));
    acts.push(K.reveal((st) => st.mask(underRidge(near, 1940), { feather: 1.5, rough: 0.2 }), { op: 'set', level: stage.mottle(2.7, 0.08, 0.012, 7), order: 'left', duration: 1.6 }));

    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 470, size: 56, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 950, 782, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A soft band of dusk light: rises from y0, strongest at y1, cut off below y2 (behind the hills).
function horizonGlow(st, y0, y1, y2) {
  const s = st.s;
  const top = Math.floor(y0 * s);
  const h = Math.ceil((y2 - y0) * s);
  const m = new Mask(0, top, st.width, h);
  for (let y = 0; y < h; y++) {
    const v = (y + top) / s;
    const a = v < y1 ? ((v - y0) / (y1 - y0)) ** 2 : 1;
    m.a.fill(a, y * st.width, (y + 1) * st.width);
  }
  return m;
}

// A five-lobed maple leaf: base (petiole joint) at (x, y), lobe length `size`, turned by `rot`
// and foreshortened across by `squash` as it spins. Returns outline, veins and stalk.
function maple(x, y, size, rot, squash = 1) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const T = ([a, b]) => {
    const px = a * squash * size;
    const py = b * size;
    return [x + px * c - py * s, y + px * s + py * c];
  };
  const dir = (th) => [Math.sin(th), -Math.cos(th)];
  const perp = (th) => [Math.cos(th), Math.sin(th)];
  const lobes = [
    [-1.85, 0.56],
    [-0.92, 0.92],
    [0, 1],
    [0.92, 0.92],
    [1.85, 0.56],
  ];
  const side = [[0.3, 0.19], [0.48, 0.17], [0.6, 0.29], [0.66, 0.14], [0.8, 0.19], [0.87, 0.07]];
  const L = (th, len, u, v) => {
    const [dx, dy] = dir(th);
    const [qx, qy] = perp(th);
    return [(u * dx + v * qx) * len, (u * dy + v * qy) * len];
  };
  const pts = [[0, 0.07]];
  const veins = [];
  lobes.forEach(([th, len], i) => {
    for (const [u, v] of side) pts.push(L(th, len, u, -v));
    pts.push(L(th, len, 1, 0));
    for (let k = side.length - 1; k >= 0; k--) pts.push(L(th, len, side[k][0], side[k][1]));
    if (i < lobes.length - 1) {
      const mid = (th + lobes[i + 1][0]) / 2;
      const [dx, dy] = dir(mid);
      const r = 0.24 + 0.06 * (1 - Math.abs(mid) / 1.4);
      pts.push([dx * r, dy * r]);
    }
    veins.push({ main: true, pts: [[0, 0], L(th, len, 0.5, 0.02 * Math.sign(th)), L(th, len, 0.97, 0)] });
    for (const sg of [-1, 1]) {
      veins.push({ main: false, pts: [L(th, len, 0.3, 0), L(th, len, 0.52, sg * 0.2)] });
      veins.push({ main: false, pts: [L(th, len, 0.6, 0), L(th, len, 0.77, sg * 0.13)] });
    }
  });
  const stalk = [[0, 0.02], [0.04, 0.22], [0.12, 0.45]];
  return {
    outline: pts.map(T),
    veins: veins.map((v) => ({ main: v.main, pts: spline(v.pts.map(T), 4) })),
    stalk: spline(stalk.map(T), 5),
    size,
  };
}

// Carves a leaf out of the sand: pale gold blade, brighter veins, a fine stalk.
function leaf(l, { strength, duration, veins = false }) {
  const w = Math.max(2.5, l.size / 30);
  const acts = [
    K.reveal((st) => st.mask(l.outline, { feather: 0.7, rough: 0.12, roughScale: 0.25 }), { op: 'carve', strength, order: 'out', duration, jitter: 0.04, rest: 0.03 }),
    K.carve(l.stalk, { width: w * 1.6, strength: 0.9, speed: 400, rim: 0.2, taper: (u) => 1 - 0.5 * u, rest: 0.02 }),
  ];
  for (const v of l.veins) {
    if (!v.main && !veins) continue;
    acts.push(K.carve(v.pts, { width: v.main ? w * 1.4 : w * 0.8, strength: 0.95, speed: v.main ? 700 : 600, rim: 0.4, taper: (u) => 1 - 0.7 * u, rest: 0.01 }));
  }
  return acts;
}

// A wild goose flying west, carved in light: long neck and small head forward, wings raised or
// beating down, the far wing fainter behind. `pose` 0..2 picks the wingbeat.
const POSES = [
  [0.35, 0.62],
  [2.5, 0.45],
  [1.05, 0.8],
];
function goose(x, y, size, pose) {
  const u = size;
  const tilt = -0.08;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const T = ([a, b]) => {
    const px = -a * u;
    const py = b * u;
    return [x + px * c - py * s, y + px * s + py * c];
  };
  const wing = (g, len) => {
    const d = [-Math.sin(g), -Math.cos(g)];
    const p = [Math.cos(g), -Math.sin(g)];
    const R = [0.06, -0.06];
    const at = (k, q) => [R[0] + d[0] * k * len + p[0] * q, R[1] + d[1] * k * len + p[1] * q];
    return [at(0, 0.2), at(0.45, 0.15), at(0.85, 0.04), at(1, -0.1), at(0.9, -0.16), at(0.55, -0.15), at(0.05, -0.16)];
  };
  const [gNear, gFar] = POSES[pose];
  const body = ellipse(0, 0, 0.5, 0.12, 0, 20);
  const neck = [[0.3, -0.09], [0.94, -0.14], [0.97, -0.06], [0.35, 0.08]];
  const head = ellipse(1.0, -0.1, 0.09, 0.062, 0, 12);
  const bill = [[1.05, -0.13], [1.22, -0.09], [1.05, -0.06]];
  const tail = [[-0.42, -0.07], [-0.7, -0.03], [-0.7, 0.06], [-0.42, 0.07]];
  const near = [body, neck, head, bill, tail, wing(gNear, 0.95)].map((p) => ccw(p.map(T)));
  const far = ccw(wing(gFar, 0.75).map(([a, b]) => [a - 0.12, b - 0.02]).map(T));
  return [
    K.reveal((st) => st.mask(far, { feather: 0.5 }), { op: 'carve', strength: 0.72, order: 'right', duration: 0.35, rest: 0.02 }),
    K.reveal((st) => st.mask(near, { feather: 0.5 }), { op: 'carve', strength: 0.95, order: 'right', duration: 0.8, rest: 0.08 }),
  ];
}

// Consistent winding so overlapping polygons in one mask add up instead of cancelling.
function ccw(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a < 0 ? poly.slice().reverse() : poly;
}

