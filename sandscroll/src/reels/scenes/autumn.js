import { spline, ellipse, arc, ridge, underRidge, clamp, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import { Mask } from '../../core/mask.js';

// 一叶知秋 — a bare branch and one great maple leaf turning as it falls, with more leaves drifting
// round it. Then the palm turns the great leaf into a pale moon, and each falling leaf, smudged
// where it hangs, flies off again as a wild goose: a V heading south-west round the moon, over
// low distant hills.
const MOON = [610, 800, 205];
// Falling leaves and the geese they become: [x, y, goose size, wing pose, leaf turn, leaf squash].
const FLOCK = [
  [182, 1128, 118, 0, -0.5, 0.7],
  [208, 902, 106, 1, 0.9, 0.85],
  [412, 1158, 106, 2, 2.3, 0.65],
  [258, 690, 96, 3, -2.2, 0.9],
  [640, 1166, 96, 1, 1.4, 0.75],
  [858, 1148, 86, 0, -1.1, 0.8],
];

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
    const s = stage.s;
    const acts = [];
    // The sky the palm restores is the opening table itself, so smudged patches never show.
    const sky = stage.mottle(2.6, 0.1, 0.01, 3);
    const lune = moonLevel(stage);
    const bg = (x, y) => {
      const d = Math.hypot(x / s - MOON[0], y / s - MOON[1]) - MOON[2];
      if (d < 0) return lune(x, y);
      return sky(x, y) * (1 - 0.5 * Math.exp(-d / 110));
    };

    // Picture A: the branch in one bright stroke, the great leaf, leaves on the branch and falling.
    const branch = spline([[-40, 408], [110, 432], [250, 472], [360, 520], [440, 574]], 10);
    const first = K.carve(branch, { width: 40, strength: 0.94, speed: 700, rim: 0.35, taper: (u) => 1 - 0.72 * u, rest: 0.05 });
    first.mark = 'open';
    acts.push(first);
    const twigs = [
      [[118, 434], [150, 404], [190, 388]],
      [[250, 472], [298, 452], [344, 452]],
      [[190, 452], [206, 492], [200, 530]],
    ];
    for (const t of twigs) acts.push(K.carve(spline(t, 6), { width: 12, strength: 0.9, speed: 500, rim: 0.25, taper: (u) => 1 - 0.65 * u, rest: 0.02 }));

    const hero = maple(MOON[0], MOON[1], 460, 0.14, 0.95);
    acts.push(...leaf(hero, { strength: 0.82, duration: 1.8, veins: true }));
    const read = K.wait(0.01);
    read.mark = 'A';
    acts.push(read);

    // Leaves still on the branch stay to the end; the falling ones are laid where the geese will fly.
    const kept = [maple(206, 378, 50, -0.4, 0.9), maple(350, 454, 46, 1.0, 0.8), maple(200, 556, 44, 2.9, 0.85)];
    for (const l of kept) acts.push(...leaf(l, { strength: 0.85, duration: 0.3, quick: true }));
    const falling = FLOCK.map(([x, y, size, , turn, squash]) => maple(x, y, size * 0.78, turn, squash));
    for (const l of falling) acts.push(...leaf(l, { strength: 0.85, duration: 0.3, quick: true }));

    // Twist: the palm stirs the great leaf round into a pale moon...
    const [mx, my, mr] = MOON;
    const spiral = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160;
      const a = -Math.PI / 2 + t * TAU * 2.2;
      const r = 400 - 330 * t;
      spiral.push([mx + r * Math.cos(a), my + r * Math.sin(a)]);
    }
    const stir = K.palm(spiral, { width: 230, speed: 1300, target: bg, rate: 0.85, streak: stage.streaks[1], hard: 0.3, rest: 0.05 });
    stir.mark = 'twist';
    acts.push(stir);
    for (const [dr, w] of [[70, 180], [165, 190]]) {
      acts.push(K.palm(arc(mx, my, mr + dr, -Math.PI / 2, Math.PI * 1.55, 90), { width: w, speed: 1700, target: bg, rate: 0.95, streak: stage.streaks[0], hard: 0.35, rest: 0.03 }));
    }
    acts.push(K.reveal((st) => st.mask(ellipse(mx, my, mr, mr, 0, 120), { feather: 1.2, rough: 0.06, roughScale: 0.12 }), { op: 'set', level: lune, order: 'spiral', duration: 1.8, jitter: 0.04, rest: 0.05 }));
    acts.push(K.reveal((st) => K.radialMask(st, mx, my, mr * 0.99, mr * 1.9, 2.2), { op: 'carve', strength: 0.3, order: 'out', duration: 0.9, jitter: 0.06, rest: 0.05 }));

    // ...and each falling leaf, smudged where it hangs, flies off as a goose.
    FLOCK.forEach(([x, y, size, pose], i) => {
      const r = size * 0.28;
      const scrub = arc(x, y - size * 0.15, r, i * 1.3, i * 1.3 + TAU * 1.25, 30);
      acts.push(K.palm(scrub, { width: size * 1.55, speed: 900, target: bg, rate: 0.9, streak: stage.streaks[i % 3], hard: 0.35, rest: 0.02 }));
      acts.push(goose(x, y, size, pose));
    });
    const flock = K.wait(0.01);
    flock.mark = 'geese';
    acts.push(flock);

    // Final: dusk light on the horizon and low distant hills, calm under the payoff line.
    acts.push(K.reveal((st) => horizonGlow(st, 1150, 1285, 1320), { op: 'carve', strength: 0.45, order: 'left', duration: 1.2, jitter: 0.03 }));
    const n = stage.noise;
    const off = rng.float(0, 100);
    const far = ridge(n, -40, 1120, 1300, 50, { offset: off, peaks: [[760, 48, 150], [140, 30, 120]] });
    const near = ridge(n, -40, 1120, 1350, 36, { offset: off + 30, peaks: [[330, 40, 190], [1000, 26, 120]] });
    acts.push(K.reveal((st) => st.mask(underRidge(far, 1940), { feather: 1.5, rough: 0.2 }), { op: 'set', level: stage.mottle(2.9, 0.08), order: 'right', duration: 1.4 }));
    acts.push(K.reveal((st) => st.mask(underRidge(near, 1940), { feather: 1.5, rough: 0.2 }), { op: 'set', level: stage.mottle(3.3, 0.08, 0.012, 7), order: 'left', duration: 1.4 }));

    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 470, size: 56, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 950, 782, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Moon surface: pale in the middle, deeper toward the limb, with faint soft maria.
function moonLevel(stage) {
  const s = stage.s;
  const n = stage.noise;
  const [mx, my, mr] = MOON;
  return (x, y) => {
    const dx = (x / s - mx) / mr;
    const dy = (y / s - my) / mr;
    const q = clamp(Math.hypot(dx, dy), 0, 1);
    const maria = Math.max(0, n.fbm2(dx * 1.7 + 11, dy * 1.7 + 4, 3));
    return 0.34 + 0.42 * q ** 3 + 0.4 * maria;
  };
}

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

// A five-lobed maple leaf whose blade is centred on (x, y): lobe length `size`, turned by `rot`
// and foreshortened across by `squash` as it spins. Returns outline, veins and stalk.
function maple(x, y, size, rot, squash = 1) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const T = ([a, b]) => {
    const px = a * squash * size;
    const py = (b + 0.42) * size;
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
  const side = [[0.3, 0.2], [0.47, 0.19], [0.6, 0.28], [0.67, 0.16], [0.8, 0.18], [0.88, 0.07]];
  const L = (th, len, u, v) => {
    const [dx, dy] = dir(th);
    const [qx, qy] = perp(th);
    return [(u * dx + v * qx) * len, (u * dy + v * qy) * len];
  };
  // Tips, teeth and sinuses as a closed list; only the sinuses and tooth notches get rounded.
  const pts = [[[0, 0.07], true]];
  const veins = [];
  lobes.forEach(([th, len], i) => {
    side.forEach(([u, v], k) => pts.push([L(th, len, u, -v), k % 2 === 0]));
    pts.push([L(th, len, 1, 0), false]);
    for (let k = side.length - 1; k >= 0; k--) pts.push([L(th, len, side[k][0], side[k][1]), k % 2 === 0]);
    if (i < lobes.length - 1) {
      const mid = (th + lobes[i + 1][0]) / 2;
      const [dx, dy] = dir(mid);
      const r = 0.26 + 0.05 * (1 - Math.abs(mid) / 1.4);
      pts.push([[dx * r, dy * r], true]);
    }
    veins.push({ main: true, pts: [[0, 0], L(th, len, 0.5, 0.02 * Math.sign(th)), L(th, len, 0.95, 0)] });
    for (const sg of [-1, 1]) {
      veins.push({ main: false, pts: [L(th, len, 0.3, 0), L(th, len, 0.54, sg * 0.21)] });
      veins.push({ main: false, pts: [L(th, len, 0.6, 0), L(th, len, 0.76, sg * 0.14)] });
    }
  });
  const stalk = [[0, 0.02], [0.04, 0.16], [0.1, 0.3]];
  return {
    outline: roundCorners(pts).map(T),
    veins: veins.map((v) => ({ main: v.main, pts: spline(v.pts.map(T), 4) })),
    stalk: spline(stalk.map(T), 5),
    size,
  };
}

// Replaces each flagged corner with a short quadratic curve so notches read as soft sinuses.
function roundCorners(list) {
  const out = [];
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const [p, soft] = list[i];
    if (!soft) {
      out.push(p);
      continue;
    }
    const a = list[(i - 1 + n) % n][0];
    const b = list[(i + 1) % n][0];
    const p0 = [p[0] + (a[0] - p[0]) * 0.35, p[1] + (a[1] - p[1]) * 0.35];
    const p1 = [p[0] + (b[0] - p[0]) * 0.35, p[1] + (b[1] - p[1]) * 0.35];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]]);
    }
  }
  return out;
}

// Carves a leaf out of the sand: pale gold blade, brighter veins, a fine stalk.
function leaf(l, { strength, duration, veins = false, quick = false }) {
  const w = clamp(l.size / 30, 2.5, 6.5);
  const acts = [
    K.reveal((st) => st.mask(l.outline, { feather: 0.7, rough: 0.08, roughScale: 0.25 }), { op: 'carve', strength, order: 'out', duration, jitter: 0.04, rest: 0.03 }),
    K.carve(l.stalk, { width: w * 1.6, strength: 0.9, speed: quick ? 700 : 400, rim: 0.2, taper: (u) => 1 - 0.5 * u, rest: 0.02 }),
  ];
  for (const v of l.veins) {
    if (!v.main && !veins) continue;
    acts.push(K.carve(v.pts, { width: v.main ? w * 1.4 : w * 0.8, strength: 0.95, speed: quick ? 1100 : v.main ? 800 : 700, rim: 0.4, taper: (u) => 1 - 0.7 * u, rest: 0.01 }));
  }
  return acts;
}

// A wild goose flying south-west, carved in light: a long slender neck and small head stretched
// forward, wings raised, beating down or gliding, the far wing fainter behind. `pose` picks the
// wingbeat as [near wing, far wing] angles from straight up, swept back.
const POSES = [
  [0.3, 0.55],
  [2.45, 0.4],
  [1.0, 0.75],
  [0.55, 2.7],
];
function goose(x, y, size, pose) {
  const u = size;
  const tilt = -0.36;
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
    const R = [0.04, -0.05];
    const at = (k, q) => [R[0] + d[0] * k * len + p[0] * q, R[1] + d[1] * k * len + p[1] * q];
    // Leading edge bowed forward, a fan of primaries at the tip, trailing edge swept back.
    return [at(0, 0.19), at(0.4, 0.15), at(0.78, 0.06), at(0.97, -0.05), at(1, -0.1), at(0.93, -0.13), at(0.96, -0.17), at(0.86, -0.18), at(0.55, -0.17), at(0.05, -0.17)];
  };
  const [gNear, gFar] = POSES[pose];
  const body = spline([[0.46, -0.02], [0.3, -0.1], [0, -0.12], [-0.3, -0.09], [-0.46, -0.03], [-0.3, 0.1], [0, 0.13], [0.3, 0.09]], 5, true);
  const neck = spline([[0.36, -0.03], [0.7, -0.08], [1.02, -0.12], [1.22, -0.13]], 6);
  const neckPoly = [...neck.map(([a, b], i) => [a, b - 0.075 + 0.035 * (i / (neck.length - 1))]), ...neck.slice().reverse().map(([a, b], i) => [a, b + 0.075 - 0.035 * (1 - i / (neck.length - 1))])];
  const head = ellipse(1.26, -0.13, 0.085, 0.058, -0.05, 12);
  const bill = [[1.31, -0.155], [1.45, -0.12], [1.31, -0.1]];
  const tail = [[-0.4, -0.07], [-0.66, -0.03], [-0.68, 0.04], [-0.4, 0.07]];
  const near = [body, neckPoly, head, bill, tail, wing(gNear, 1.05)].map((p) => ccw(p.map(T)));
  const far = ccw(wing(gFar, 0.82).map(([a, b]) => [a - 0.12, b - 0.02]).map(T));
  return [
    K.reveal((st) => st.mask(far, { feather: 0.5 }), { op: 'carve', strength: 0.7, order: 'right', duration: 0.35, rest: 0.02 }),
    K.reveal((st) => st.mask(near, { feather: 0.5 }), { op: 'carve', strength: 0.95, order: 'right', duration: 0.9, rest: 0.06 }),
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
