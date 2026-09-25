import { spline, ellipse, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 熊猫 · 咬定青山不放松 — a giant panda sits by a broken rock, gripping a living bamboo stalk and
// chewing a leaf, while bamboo rooted in the rock rises through the mist. Portrait 1080x1920.
export default {
  id: 'panda',
  music: 'panda',
  title: { cn: '熊猫', en: 'Panda' },
  hook: { cn: '熊猫教会我的事：咬定青山不放松', en: 'Life advice from a panda: hold on and never let go' },
  theme: '坚持 · 恒心',
  poem: {
    columns: ['咬定青山不放松', '立根原在破岩中'],
    cn: '咬定青山不放松，立根原在破岩中',
    en: 'Biting firm into the green mountain, never letting go; its roots hold fast in the broken rock.',
    by: '清 · 郑燮《竹石》  ·  Zheng Xie, Qing dynasty',
  },
  seal: '恒心',
  build(stage, rng) {
    const acts = [];
    const off = rng.float(0, 100);
    const ground = 1262;
    acts.push(...K.cover(stage, stage.vgrad(0.5, 0.95, 0, ground, 0.1, off), { y0: -60, y1: 1980 }));
    // Misty far bamboo for depth.
    for (const [x, w, lean] of [[40, 16, 0.01], [262, 12, -0.02], [640, 14, 0.015], [1010, 18, -0.01]]) {
      acts.push(K.reveal((st) => st.mask(stalkPoly(x, ground - 40, x + lean * 1300, -40, w), { feather: 5 }), { op: 'add', amount: 0.32, order: 'up', duration: 1.2, rest: 0.05 }));
    }
    // Ground bank and the broken rock the bamboo roots in.
    const bank = [[-20, ground + 10]];
    for (let x = 0; x <= 1100; x += 30) bank.push([x, ground + 8 * Math.sin(x / 150 + off) + 5 * Math.sin(x / 47)]);
    bank.push([1100, 1940], [-20, 1940]);
    acts.push(K.reveal((st) => st.mask(bank, { feather: 2, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: stage.streaky(1.35, 0.25, 0.003, 0.05, off), order: 'left', duration: 4 }));
    acts.push(...rock(stage, rng, ground));
    // Near bamboo rooted in the rock, framing the left side.
    acts.push(...stalk(stage, { x0: 122, y0: 1010, x1: 196, y1: -60, w: 38, level: 2.45, nodes: [880, 700, 505, 300, 90] }));
    acts.push(...stalk(stage, { x0: 52, y0: 1060, x1: 20, y1: -60, w: 26, level: 2.1, nodes: [930, 760, 560, 330, 120] }));
    // The panda, the held stalk and its leaves; the eyes are dotted last (画龙点睛).
    const pd = panda(stage, rng, { x: 440, y: ground - 4, u: 100 });
    acts.push(...pd.body);
    acts.push(...pd.grip);
    acts.push(...pd.face);
    // Leaves on the near bamboo.
    for (const [x, y, a, n, len] of [[185, 250, -0.2, 4, 150], [200, 110, 0.35, 3, 130], [140, 520, 2.75, 3, 125], [70, 360, 3.4, 3, 120], [170, 660, 0.55, 3, 110]]) {
      acts.push(...leafSpray(x, y, a, n, len, rng));
    }
    // Grass and a young shoot at the bank.
    for (let i = 0; i < 18; i++) {
      const x = rng.float(20, 1060);
      if (x > 170 && x < 720) continue;
      const y = ground + rng.float(-2, 22);
      const h = rng.float(16, 40);
      acts.push(K.pour(spline([[x, y], [x + rng.float(-6, 6), y - h * 0.5], [x + rng.float(-14, 14), y - h]], 5), { width: 3, amount: 1.5, speed: 260, rest: 0.02, taper: K.taperEnd }));
    }
    acts.push(...shoot(stage, 870, ground + 6, 92));
    acts.push(...pd.eyes);
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 962, y: 486, size: 60, mode: 'pour', amount: 1.5, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 884, 990, { size: 60, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Tapered quadrilateral for a straight stalk from (x0, y0) up to (x1, y1).
function stalkPoly(x0, y0, x1, y1, w) {
  return [[x0 - w / 2, y0], [x1 - w * 0.42, y1], [x1 + w * 0.42, y1], [x0 + w / 2, y0]];
}

// A bamboo stalk as separate segments: carved gaps and a dark ring at each node.
function stalk(stage, { x0, y0, x1, y1, w, level, nodes }) {
  const acts = [];
  const xAt = (y) => x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  const wAt = (y) => w * (1 - 0.18 * (y0 - y) / (y0 - y1));
  const ys = [y0, ...nodes, y1];
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i];
    const b = ys[i + 1];
    const wa = wAt(a);
    const wb = wAt(b);
    const poly = [[xAt(a) - wa / 2, a - 3], [xAt(b) - wb / 2, b + 3], [xAt(b) + wb / 2, b + 3], [xAt(a) + wa / 2, a - 3]];
    acts.push(K.reveal((st) => st.mask(poly, { feather: 0.8, rough: 0.12, roughScale: 0.3 }), { op: 'set', level: stage.mottle(level, 0.1, 0.02), order: 'up', duration: 0.35 + (a - b) / 900, rest: 0.03 }));
  }
  for (const y of nodes) {
    const x = xAt(y);
    const hw = wAt(y) / 2;
    acts.push(K.carve([[x - hw - 2, y + 4], [x + hw + 2, y + 4]], { width: 3.2, strength: 0.8, speed: 140, taper: K.even, rest: 0.02 }));
    acts.push(K.pour(spline([[x - hw - 5, y - 2], [x, y + 3], [x + hw + 5, y - 2]], 4), { width: 4.5, amount: 2.4, speed: 140, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
    // A soft highlight down the lit side of each segment.
    acts.push(K.carve([[x - hw * 0.45, y - 14], [x - hw * 0.45, y - 60]], { width: 3, strength: 0.28, speed: 200, rim: 0, rest: 0.01 }));
  }
  return acts;
}

// A slender bamboo leaf (竹叶): widest near the base, sharp tip, gently curving.
function bladePoly(x, y, angle, len, width, bend = 0.25) {
  const left = [];
  const right = [];
  const n = 18;
  let px = x;
  let py = y;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = angle + bend * t * t;
    if (i > 0) {
      px += Math.cos(a) * (len / n);
      py += Math.sin(a) * (len / n);
    }
    const hw = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02)), 0.8) * (1 - 0.55 * t) * (t < 0.08 ? t / 0.08 : 1);
    left.push([px - Math.sin(a) * hw, py + Math.cos(a) * hw]);
    right.push([px + Math.sin(a) * hw, py - Math.cos(a) * hw]);
  }
  return [...left, ...right.reverse()];
}

function blade(x, y, angle, len, width, { level = 2.35, bend = 0.25 } = {}) {
  return K.reveal((st) => st.mask(bladePoly(x, y, angle, len, width, bend), { feather: 0.6 }), { op: 'set', level, order: (X, Y) => 0, duration: 0.3, rest: 0.03 });
}

// 个 / 介 arrangements: n blades fanning from one point, drooping with gravity.
function leafSpray(x, y, angle, n, len, rng, level = 2.35) {
  const acts = [];
  const bend = Math.cos(angle) >= 0 ? 0.3 : -0.3;
  for (let i = 0; i < n; i++) {
    const a = angle + (i - (n - 1) / 2) * 0.42 + rng.float(-0.08, 0.08);
    const L = len * (i === Math.floor(n / 2) ? 1.1 : rng.float(0.78, 0.95));
    acts.push(blade(x, y, a, L, L * 0.1, { level, bend }));
  }
  acts.push(K.pour([[x, y], [x - Math.cos(angle) * 16, y - Math.sin(angle) * 16]], { width: 3, amount: 2, speed: 120, rest: 0.02 }));
  return acts;
}

// 破岩: a broken rock behind the panda's left side, faceted with carved cracks.
function rock(stage, rng, ground) {
  const acts = [];
  const outline = spline([[-40, ground + 40], [-40, 1030], [30, 985], [118, 1002], [170, 968], [255, 990], [318, 1060], [352, 1150], [380, ground + 40]], 8, true);
  acts.push(K.reveal((st) => st.mask(outline, { feather: 1.2, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: stage.mottle(1.95, 0.14, 0.02), order: 'up', duration: 3 }));
  for (const pts of [
    [[30, 995], [60, 1060], [48, 1140], [80, ground]],
    [[170, 975], [160, 1040], [205, 1100], [196, ground - 20]],
    [[255, 995], [262, 1060], [300, 1140]],
    [[70, 1060], [120, 1090], [160, 1080]],
  ]) {
    acts.push(K.carve(spline(pts, 8), { width: 4, strength: 0.55, speed: 260, rim: 0.3, rest: 0.05 }));
  }
  // Lit top planes.
  acts.push(K.carve(spline([[10, 1000], [70, 992], [118, 1010]], 6), { width: 9, strength: 0.4, speed: 260, rim: 0, rest: 0.03 }));
  acts.push(K.carve(spline([[180, 978], [240, 994], [300, 1050]], 6), { width: 9, strength: 0.4, speed: 260, rim: 0, rest: 0.03 }));
  return acts;
}

// A young bamboo shoot (笋) at the bank.
function shoot(stage, x, y, h) {
  const shape = spline([[x - h * 0.24, y], [x - h * 0.2, y - h * 0.45], [x - h * 0.06, y - h * 0.85], [x + h * 0.02, y - h], [x + h * 0.12, y - h * 0.7], [x + h * 0.22, y - h * 0.3], [x + h * 0.24, y]], 8, true);
  const acts = [K.reveal((st) => st.mask(shape, { feather: 0.8 }), { op: 'set', level: stage.mottle(2.2, 0.1), order: 'up', duration: 0.9, rest: 0.05 })];
  for (const t of [0.25, 0.5, 0.72]) {
    const yy = y - h * t;
    const hw = h * 0.22 * (1 - t * 0.6);
    acts.push(K.carve(spline([[x - hw, yy + 6], [x, yy - 4], [x + hw, yy - 12]], 4), { width: 2.4, strength: 0.6, speed: 160, rest: 0.02 }));
  }
  return acts;
}

// Giant panda sitting upright, front view: white fur modelled with soft shading, black limbs,
// ears and 八-shaped eye patches. Returns phases so the scene can interleave them.
function panda(stage, rng, { x, y, u }) {
  const s = stage.s;
  const P = (dx, dy) => [x + dx * u, y + dy * u];
  const C = (pts, segs = 8, closed = true) => spline(pts.map(([a, b]) => P(a, b)), segs, closed);
  const mirror = (pts) => pts.map(([a, b]) => [-a, b]);
  const shade = (cx, cy, rx, ry, lo, hi, k0 = 0.45) => (X, Y) => {
    const dx = (X / s - x - cx * u) / (rx * u);
    const dy = (Y / s - y - cy * u) / (ry * u);
    return lo + (hi - lo) * smoothstep(k0, 1.08, Math.sqrt(dx * dx + dy * dy));
  };
  const black = stage.mottle(2.7, 0.08, 0.03);
  const fill = (poly, level, order = 'down', duration = 1.2, fr = 1, rough = 0.12) =>
    K.reveal((st) => st.mask(poly, { feather: fr, rough, roughScale: 0.3 }), { op: 'set', level, order, duration, rest: 0.05 });
  const body = [];
  const grip = [];
  const face = [];
  const eyes = [];

  // Pear-shaped seated body in white fur.
  const half = [[0, -4.7], [1.2, -4.55], [1.95, -4.05], [2.4, -3.1], [2.62, -2.0], [2.72, -1.05], [2.55, -0.3], [1.6, 0.05], [0, 0.1]];
  const bodyPoly = C([...half, ...mirror(half).reverse().slice(1, -1)]);
  body.push(fill(bodyPoly, shade(0, -2.3, 2.7, 2.6, 0.03, 0.5), 'down', 2.6, 1.2, 0.18));
  // Hind legs: thighs round at the sides, soles turned toward us.
  for (const sd of [-1, 1]) {
    body.push(fill(ellipse(...P(sd * 1.95, -0.95), 0.95 * u, 0.9 * u, 0, 48), black, 'up', 1.2, 1, 0.15));
    body.push(fill(ellipse(...P(sd * 1.5, -0.08), 0.78 * u, 0.5 * u, sd * 0.35, 48), black, 'up', 0.9, 1, 0.12));
    body.push(K.carve(spline([P(sd * 0.95, -0.2), P(sd * 1.4, 0.2), P(sd * 2.0, 0.08)], 8), { width: 3, strength: 0.35, speed: 200, rest: 0.03 }));
  }
  // Resting arm (viewer's left): down the side, paw curled on the belly.
  const restArm = [[-0.9, -4.62], [-1.75, -4.5], [-2.35, -3.9], [-2.62, -2.9], [-2.45, -2.05], [-1.9, -1.62], [-1.1, -1.55], [-0.62, -1.82], [-0.7, -2.2], [-1.2, -2.42], [-1.55, -2.85], [-1.55, -3.6], [-1.2, -4.15]];
  body.push(fill(C(restArm), black, 'down', 1.6, 1, 0.12));
  // Ears behind the head.
  for (const sd of [-1, 1]) body.push(fill(ellipse(...P(sd * 1.28, -6.72), 0.5 * u, 0.46 * u, sd * 0.3, 40), black, 'out', 0.9, 1, 0.18));
  // Gripping arm (viewer's right) reaching out to the stalk.
  const sx = 3.2;
  grip.push(K.reveal((st) => st.mask(stalkPoly(...P(sx, 0.15), ...P(sx - 0.18, -11.2), 0.36 * u), { feather: 0.8, rough: 0.1, roughScale: 0.3 }), { op: 'set', level: stage.mottle(2.4, 0.1), order: 'up', duration: 2 }));
  for (const ny of [-1.6, -5.2, -7.3, -9.4]) {
    const [nx, nyy] = P(sx - 0.18 * (-ny / 11.2), ny);
    grip.push(K.carve([[nx - 0.21 * u, nyy], [nx + 0.21 * u, nyy]], { width: 3.2, strength: 0.85, speed: 120, taper: K.even, rest: 0.02 }));
    grip.push(K.pour(spline([[nx - 0.25 * u, nyy - 5], [nx, nyy], [nx + 0.25 * u, nyy - 5]], 4), { width: 4, amount: 2.4, speed: 140, scatter: 0, rest: 0.02 }));
  }
  const gripArm = [[0.9, -4.62], [1.75, -4.52], [2.35, -4.2], [2.9, -3.95], [3.45, -3.9], [3.62, -3.55], [3.45, -3.12], [2.95, -3.0], [2.45, -2.75], [1.95, -2.6], [1.55, -2.9], [1.45, -3.55], [1.15, -4.15]];
  grip.push(fill(C(gripArm), black, 'right', 1.6, 1, 0.12));
  // Curled fingers around the stalk.
  for (const k of [0, 1, 2]) {
    const yy = -3.78 + k * 0.24;
    grip.push(K.carve(spline([P(3.02, yy), P(3.28, yy - 0.06), P(3.5, yy + 0.02)], 4), { width: 3, strength: 0.45, speed: 120, rest: 0.02 }));
  }
  // Leafy crown at the top of the held stalk, above the inscription.
  const [tx, ty] = P(sx - 0.18, -8.6);
  for (const [a, len] of [[-0.35, 150], [0.15, 165], [0.62, 140]]) grip.push(blade(tx, ty, a, len, len * 0.1, { bend: 0.3 }));
  const [t2x, t2y] = P(sx - 0.17, -6.6);
  for (const [a, len] of [[2.55, 130], [2.95, 140], [3.35, 118]]) grip.push(blade(t2x, t2y, a, len, len * 0.1, { bend: -0.3 }));

  // Head: broad and round with full cheeks, tilted slightly toward the stalk.
  const hx = 0.05;
  const hy = -5.55;
  const tilt = 0.06;
  const R = (dx, dy) => {
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    return [hx + dx * c - dy * sn, hy + dx * sn + dy * c];
  };
  const headHalf = [[0, -1.5], [0.9, -1.4], [1.5, -0.95], [1.78, -0.15], [1.7, 0.55], [1.3, 1.08], [0.6, 1.38], [0, 1.45]];
  const headPts = [...headHalf, ...mirror(headHalf).reverse().slice(1, -1)].map(([a, b]) => R(a, b));
  face.push(fill(C(headPts), shade(hx, hy + 0.15, 1.8, 1.55, 0.02, 0.42, 0.55), 'out', 2, 1, 0.14));
  // Soft shadow under the chin.
  face.push(K.pour(C([R(-1.2, 1.12), R(-0.55, 1.5), R(0.55, 1.5), R(1.2, 1.12)], 8, false), { width: 0.2 * u, amount: 0.35, speed: 260, taper: K.taperBoth, scatter: 0, rest: 0.05 }));
  // 八-shaped eye patches: narrow at the top inner corner, drooping outward.
  for (const sd of [-1, 1]) {
    const patch = [[0.34, -0.42], [0.62, -0.48], [0.9, -0.22], [1.05, 0.2], [0.98, 0.52], [0.72, 0.6], [0.48, 0.38], [0.32, 0.02]].map(([a, b]) => R(sd * a, b));
    face.push(fill(C(patch), black, 'down', 0.8, 0.8, 0.1));
  }
  // Nose, mouth.
  face.push(fill(C([R(-0.26, 0.5), R(0.26, 0.5), R(0.14, 0.72), R(0, 0.78), R(-0.14, 0.72)]), 2.8, 'down', 0.5, 0.6, 0));
  face.push(K.pour(C([R(0, 0.76), R(0, 0.92)], 4, false), { width: 0.045 * u, amount: 1.8, speed: 80, taper: K.even, scatter: 0, rest: 0.02 }));
  face.push(K.pour(C([R(-0.3, 0.95), R(-0.14, 1.02), R(0, 0.92), R(0.14, 1.02), R(0.3, 0.95)], 6, false), { width: 0.045 * u, amount: 1.8, speed: 100, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // A leafy twig in the mouth, trailing toward the viewer's left.
  const [mx, my] = P(...R(-0.12, 0.98));
  face.push(K.pour(spline([[mx + 10, my - 2], [mx - 60, my + 12], [mx - 150, my + 40]], 6), { width: 5, amount: 2.3, speed: 160, taper: K.taperEnd, scatter: 0, rest: 0.03 }));
  for (const [t, a, len] of [[0.35, 2.3, 120], [0.75, 2.75, 135], [1, 1.95, 110]]) {
    const bx = mx + 10 - 160 * t;
    const by = my - 2 + 42 * t;
    face.push(blade(bx, by, a, len, len * 0.1, { bend: -0.35 }));
  }
  // Eyes: dark and glossy inside the patches, with a bright catchlight dotted last.
  for (const sd of [-1, 1]) {
    const [ex, ey] = P(...R(sd * 0.58, -0.08));
    eyes.push(K.reveal((st) => st.mask(ellipse(ex, ey, 0.16 * u, 0.17 * u, 0, 24), { feather: 0.6 }), { op: 'carve', strength: 0.55, order: 'out', duration: 0.4, rest: 0.05 }));
    eyes.push(K.reveal((st) => st.mask(ellipse(ex - 0.04 * u, ey - 0.05 * u, 0.055 * u, 0.055 * u, 0, 16), { feather: 0.5 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.3, rest: 0.15 }));
  }
  return { body, grip, face, eyes };
}
