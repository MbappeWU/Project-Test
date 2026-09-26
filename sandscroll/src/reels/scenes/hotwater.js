import { spline, ellipse, measure, pointAt, clamp, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 多喝热水 · 龙马精神 — a glass of hot water with goji berries glows on the light table and its
// steam curls up; the palm sweeps the steam into a coil and it becomes a dragon rising from the
// glass, its tail still the steam. The eye is dotted last (画龙点睛). Portrait 1080x1920.
const GX = 540;
const RIM = 1010;
const BASE = 1282;
const WATER = 1072;

export default {
  id: 'hotwater',
  music: 'bamboo',
  title: { cn: '多喝热水', en: 'Hot Water Dragon' },
  theme: '松弛 · 养生（Chinamaxxing 热点）',
  hook: { en: 'In my very Chinese era', cn: '多喝热水' },
  payoff: { en: 'Stay hydrated. Stay legendary.', cn: '多喝热水，龙马精神' },
  inscription: { columns: ['龙马精神'], note: '成语' },
  seal: '如意',
  twist: '一杯热水升起的蒸汽盘旋成一条龙',
  build(stage, rng) {
    const acts = [];
    const dark = stage.mottle(1.8, 0.1, 0.01, 3);
    // Picture A: the steam first (the opening stroke), then the glass and the water in it.
    const wisps = [
      [[548, 1000], [560, 940], [528, 880], [516, 812], [548, 748], [556, 680], [526, 610]],
      [[470, 996], [452, 940], [476, 880], [448, 820], [418, 770], [434, 700]],
      [[616, 996], [634, 944], [612, 890], [640, 836], [676, 790], [664, 724]],
    ];
    acts.push(K.carve(spline(wisps[0], 10), { width: 30, strength: 0.95, speed: 520, rim: 0.2, hard: 0.35, taper: (u) => 1 - 0.75 * u, rest: 0.05 }));
    acts.push(...glass(stage, rng));
    for (const w of wisps.slice(1)) acts.push(K.carve(spline(w, 10), { width: 22, strength: 0.9, speed: 420, rim: 0.15, hard: 0.3, taper: (u) => 1 - 0.8 * u, rest: 0.05 }));
    // Soft glow around the steam, then finer curls: the glass steams while it holds.
    for (const w of wisps) acts.push(K.carve(spline(w, 10).slice(4), { width: 60, strength: 0.35, speed: 380, rim: 0, hard: 0.05, taper: (u) => 1 - 0.7 * u, rest: 0.05 }));
    for (const [x, y, dir] of [[500, 700, 1], [600, 640, -1], [470, 610, -1]]) {
      acts.push(K.carve(spline([[x, y], [x + dir * 20, y - 40], [x + dir * 6, y - 80], [x - dir * 18, y - 100]], 8), { width: 8, strength: 0.75, speed: 200, rim: 0.1, taper: K.taperBoth, rest: 0.08 }));
    }
    acts.push(K.wait(1.5));

    // The twist: the palm drags the steam round into a coil, then the dragon is drawn along it.
    const spine = track([[548, 1000], [552, 950], [590, 908], [690, 884], [790, 846], [842, 774], [808, 702], [700, 666], [560, 666], [420, 682], [290, 666], [200, 612], [178, 540], [222, 486], [306, 462]]);
    acts.push(...swirl(stage, spine, dark));
    acts.push(...dragon(stage, rng, spine));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 952, y: 468, size: 58, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 952, 790, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A measured centre line with unit tangent and the "back" normal (left of travel).
function track(ctrl, segs = 12) {
  const pts = spline(ctrl, segs);
  const m = measure(pts);
  const at = (u) => {
    const [x, y, tx, ty] = pointAt(m, clamp(u, 0, 1) * m.length);
    return { x, y, tx, ty, nx: ty, ny: -tx };
  };
  const off = (u, v, w = 0) => {
    const p = at(u);
    return [p.x + p.nx * v + p.tx * w, p.y + p.ny * v + p.ty * w];
  };
  return { pts, m, len: m.length, at, off };
}

// Reveal order following a centre line: pixels light up in the order the hand passes them.
function along(stage, T, n = 260) {
  const s = stage.s;
  const S = [];
  for (let i = 0; i <= n; i++) {
    const p = T.at(i / n);
    S.push(p.x * s, p.y * s);
  }
  return (X, Y) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= n; i++) {
      const dx = X - S[2 * i];
      const dy = Y - S[2 * i + 1];
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best / n;
  };
}

// Tapered ribbon around a polyline, width w0 at the start to w1 at the end.
function ribbon(pts, w0, w1) {
  const n = pts.length;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const hw = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push([pts[i][0] - ((y1 - y0) / len) * hw, pts[i][1] + ((x1 - x0) / len) * hw]);
    R.push([pts[i][0] + ((y1 - y0) / len) * hw, pts[i][1] - ((x1 - x0) / len) * hw]);
  }
  return [...L, ...R.reverse()];
}

// Thin arc (a scale's edge) around (cx, cy) from angle a0 to a1.
function arcPoly(cx, cy, r, a0, a1, w, n = 8) {
  const out = [];
  const inn = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const k = Math.sin((Math.PI * i) / n) * 0.7 + 0.3;
    out.push([cx + Math.cos(a) * (r + (w / 2) * k), cy + Math.sin(a) * (r + (w / 2) * k)]);
    inn.push([cx + Math.cos(a) * (r - (w / 2) * k), cy + Math.sin(a) * (r - (w / 2) * k)]);
  }
  return [...out, ...inn.reverse()];
}

// A tall tumbler of hot water: bright rim and walls, the water glowing as it fills from the
// bottom, a thick glass base, highlights, and goji berries (枸杞) floating in it.
function glass(stage, rng) {
  const acts = [];
  const rimRx = 150;
  const baseRx = 126;
  const wall = (sd) => [[GX + sd * rimRx, RIM], [GX + sd * (rimRx - 12), RIM + 130], [GX + sd * baseRx, BASE]];
  acts.push(K.carve(ellipse(GX, RIM, rimRx, 24, 0, 72), { width: 8, strength: 0.95, speed: 1400, rim: 0.25, taper: K.even, rest: 0.05 }));
  acts.push(K.carve(spline(wall(-1), 8), { width: 7, strength: 0.95, speed: 900, rim: 0.25, taper: K.even, rest: 0.03 }));
  acts.push(K.carve(spline(wall(1), 8), { width: 7, strength: 0.95, speed: 900, rim: 0.25, taper: K.even, rest: 0.03 }));
  // Water: fills up from the bottom, brighter toward the surface where the lamp shines through.
  const waterRx = rimRx - 7;
  const body = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI - (i / 20) * Math.PI;
    body.push([GX + Math.cos(a) * waterRx, WATER + Math.sin(a) * 20]);
  }
  body.push([GX + baseRx - 4, BASE - 26]);
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI;
    body.push([GX + Math.cos(a) * (baseRx - 4), BASE - 26 + Math.sin(a) * 16]);
  }
  body.push([GX - baseRx + 4, BASE - 26]);
  const s = stage.s;
  acts.push(
    K.reveal((st) => st.mask(body, { feather: 1.5 }).map((a, X, Y) => a * (0.82 + 0.16 * smoothstep(BASE, WATER, Y / s) - 0.12 * Math.pow(Math.abs(X / s - GX) / waterRx, 4))), {
      op: 'carve',
      strength: 0.9,
      order: 'up',
      duration: 2.2,
      jitter: 0.02,
    }),
  );
  acts.push(K.carve(ellipse(GX, WATER, waterRx, 20, 0, 72), { width: 6, strength: 0.95, speed: 1400, rim: 0.3, taper: K.even, rest: 0.05 }));
  // Thick glass base and its bottom edge.
  acts.push(K.carve(ellipse(GX, BASE, baseRx, 18, 0, 64).slice(0, 34), { width: 7, strength: 0.95, speed: 900, rim: 0.3, taper: K.even, rest: 0.03 }));
  acts.push(K.pour(spline([[GX - baseRx + 8, BASE - 22], [GX, BASE - 8], [GX + baseRx - 8, BASE - 22]], 8), { width: 5, amount: 1.1, speed: 700, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // Highlights down the glass: a broad one on the left, a thin one on the right.
  acts.push(K.pour(spline([[GX - 112, WATER + 30], [GX - 108, 1180], [GX - 100, BASE - 40]], 6), { width: 16, amount: 0.25, speed: 600, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  acts.push(K.carve(spline([[GX - 124, RIM + 22], [GX - 122, WATER - 10]], 4), { width: 9, strength: 0.9, speed: 500, rim: 0.2, taper: K.taperBoth, rest: 0.02 }));
  acts.push(K.carve(spline([[GX + 110, RIM + 30], [GX + 104, 1180], [GX + 98, BASE - 44]], 6), { width: 4, strength: 0.6, speed: 700, rim: 0.2, taper: K.taperBoth, rest: 0.02 }));
  // Goji berries: a few floating at the surface, a couple sunk to the bottom.
  const berries = [];
  for (const [x, y, a, r] of [[486, 1080, 0.4, 13], [566, 1086, -0.3, 12], [612, 1076, 0.9, 11], [520, 1160, 1.2, 12], [590, 1236, -0.6, 13], [470, 1244, 0.2, 12]]) {
    berries.push(ellipse(x, y, r * 1.5, r * 0.8, a, 20));
  }
  acts.push(K.reveal((st) => st.mask(berries, { feather: 1 }), { op: 'set', level: 2.2, order: 'down', duration: 1.2, jitter: 0.1 }));
  const glints = [];
  for (const [x, y, a] of [[480, 1075, 0.4], [561, 1081, -0.3], [514, 1154, 1.2], [584, 1231, -0.6], [465, 1239, 0.2]]) glints.push(ellipse(x, y, 4, 2.2, a, 10));
  acts.push(K.reveal((st) => st.mask(glints, { feather: 0.5 }), { op: 'carve', strength: 0.8, order: 'left', duration: 0.4 }));
  return acts;
}

// Palm passes that sweep the steam up and round into the dragon's coil, dissolving it.
function swirl(stage, spine, dark) {
  const acts = [];
  const sweep = (a, b, width) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(spine.off(a + ((b - a) * i) / 40, 0));
    return K.palm(pts, { width, speed: 1100, target: dark, rate: 0.75, streak: stage.streaks[1], hard: 0.3, rest: 0.05 });
  };
  acts.push(sweep(0.06, 0.5, 190));
  acts.push(sweep(0.4, 1.0, 190));
  return acts;
}

function dragon(stage, rng, T) {
  const acts = [];
  const Rmax = 40;
  const R = (u) => Rmax * (0.08 + 0.92 * smoothstep(0, 0.3, u)) * (1 - 0.22 * smoothstep(0.82, 1, u));
  const order = (st) => along(st, T);
  // The body in one long sweep of the finger, the tail still rising out of the steam.
  acts.push(K.carve(T.pts, { width: Rmax * 2, strength: 0.93, speed: 330, rim: 0.4, hard: 0.55, taper: (u) => R(u) / Rmax, rest: 0.1 }));
  // Dorsal fins: flame-shaped spikes along the back, leaning toward the tail.
  const fins = [];
  for (let d = 70; d < T.len - 30; d += 26) {
    const u = d / T.len;
    const r = R(u);
    const h = 10 + r * 0.6;
    fins.push([T.off(u - 11 / T.len, r * 0.8), T.off(u - 4 / T.len, r + h * 0.55), T.off(u - 16 / T.len, r + h), T.off(u + 3 / T.len, r + h * 0.35), T.off(u + 11 / T.len, r * 0.8)]);
  }
  acts.push(K.reveal((st) => st.mask(fins.map((f) => spline(f, 4, true)), { feather: 0.6 }), { op: 'carve', strength: 0.92, order: (X, Y) => order(stage)(X, Y), duration: 2.2, jitter: 0.01 }));
  // Scales on the flank, a line along the belly and its plates.
  const scales = [];
  const plates = [];
  let row = 0;
  for (let d = 90; d < T.len - 20; d += 17, row++) {
    const u = d / T.len;
    const r = R(u);
    const p = T.at(u);
    const back = Math.atan2(-p.ty, -p.tx);
    for (let k = 0; k < 5; k++) {
      const v = -0.25 * r + (k + (row % 2) * 0.5) * 0.24 * r;
      if (v > 0.84 * r) continue;
      const [cx, cy] = T.off(u, v);
      const rs = Math.max(4, r * 0.24);
      scales.push(arcPoly(cx, cy, rs, back - 1.2, back + 1.2, 2.6, 6));
    }
    plates.push(ribbon([T.off(u, -0.42 * r), T.off(u, -0.92 * r)], 2.6, 1.6));
  }
  const lineBelly = [];
  for (let d = 80; d < T.len - 10; d += 8) lineBelly.push(T.off(d / T.len, -0.4 * R(d / T.len)));
  acts.push(K.reveal((st) => st.mask(scales, { feather: 0.5 }), { op: 'add', amount: 0.55, order: (X, Y) => order(stage)(X, Y), duration: 2.4, jitter: 0.01 }));
  acts.push(K.pour(lineBelly, { width: 3.5, amount: 0.9, speed: 900, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(plates, { feather: 0.4 }), { op: 'add', amount: 0.5, order: (X, Y) => order(stage)(X, Y), duration: 1.2, jitter: 0.01 }));
  // Legs with flames at the elbows and four hooked talons.
  const legs = [
    { root: T.off(0.9, -20), elbow: [300, 560], wrist: [372, 548], dir: 0.2 },
    { root: T.off(0.87, 10), elbow: [118, 520], wrist: [110, 452], dir: -1.9 },
    { root: T.off(0.3, -20), elbow: [770, 948], wrist: [838, 944], dir: 0.4 },
  ];
  for (const leg of legs) acts.push(...limb(leg));
  acts.push(...head(stage, T));
  return acts;
}

function limb({ root, elbow, wrist, dir }) {
  const acts = [];
  const arm = spline([root, elbow, wrist], 10);
  acts.push(K.carve(arm, { width: 30, strength: 0.93, speed: 300, rim: 0.35, hard: 0.55, taper: (u) => 1 - 0.35 * u, rest: 0.04 }));
  // Flame tufts trailing from the elbow.
  const [ex, ey] = elbow;
  const back = Math.atan2(root[1] - elbow[1], root[0] - elbow[0]) + Math.PI * 0.55;
  const tufts = [];
  for (let k = 0; k < 3; k++) {
    const a = back + (k - 1) * 0.35;
    tufts.push(ribbon(spline([[ex, ey], [ex + Math.cos(a) * 20, ey + Math.sin(a) * 20], [ex + Math.cos(a + 0.4) * 36, ey + Math.sin(a + 0.4) * 36]], 4), 9, 1));
  }
  acts.push(K.reveal((st) => st.mask(tufts, { feather: 0.5 }), { op: 'carve', strength: 0.9, order: 'out', duration: 0.4, rest: 0.02 }));
  const [wx, wy] = wrist;
  const talons = [];
  for (let k = 0; k < 4; k++) {
    const a = dir + (k - 1.5) * 0.5;
    const l = k === 0 ? 26 : 36;
    const p1 = [wx + Math.cos(a) * l * 0.6, wy + Math.sin(a) * l * 0.6];
    const p2 = [wx + Math.cos(a) * l, wy + Math.sin(a) * l];
    const p3 = [p2[0] + Math.cos(a + 1.6) * 12, p2[1] + Math.sin(a + 1.6) * 12];
    talons.push(ribbon(spline([[wx, wy], p1, p2, p3], 4), 11, 1.2));
  }
  acts.push(K.reveal((st) => st.mask(talons, { feather: 0.5 }), { op: 'carve', strength: 0.94, order: 'out', duration: 0.5, rest: 0.03 }));
  return acts;
}

// The head in profile facing right, horns and mane swept back, whiskers streaming; the eye is
// dotted last.
function head(stage, T) {
  const acts = [];
  const p = T.at(1);
  const ang = Math.atan2(p.ty, p.tx) - 0.12;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const H = (pts) => pts.map(([a, b]) => [p.x + a * c - b * sn, p.y + a * sn + b * c]);
  const skull = spline(H([[-6, -26], [26, -40], [62, -44], [92, -34], [132, -30], [166, -38], [190, -24], [192, -6], [150, 0], [112, 6], [150, 18], [180, 24], [176, 38], [140, 44], [96, 48], [52, 46], [16, 38], [-6, 30]]), 6, true);
  acts.push(K.reveal((st) => st.mask(skull, { feather: 0.8 }), { op: 'carve', strength: 0.94, order: 'left', duration: 1.2 }));
  acts.push(K.carve(skull, { width: 3, strength: 0.0, speed: 2000, rim: 0, rest: 0 }));
  // Open mouth, fangs, nostril, brow and cheek lines.
  acts.push(K.reveal((st) => st.mask(spline(H([[108, 4], [150, 2], [192, -2], [182, 20], [150, 16]]), 6, true), { feather: 0.6 }), { op: 'set', level: 2.4, order: 'left', duration: 0.4, rest: 0.03 }));
  const fangs = [H([[150, 3], [156, 16], [161, 3]]), H([[170, 1], [175, 12], [179, 0]]), H([[140, 16], [146, 4], [151, 16]])];
  acts.push(K.reveal((st) => st.mask(fangs, { feather: 0.3 }), { op: 'carve', strength: 0.95, order: 'left', duration: 0.3, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(ellipse(...H([[178, -24]])[0], 5, 3.5, ang, 12), { feather: 0.5 }), { op: 'set', level: 2.2, order: 'out', duration: 0.2, rest: 0.02 }));
  acts.push(K.pour(spline(H([[48, -30], [76, -40], [104, -30]]), 6), { width: 4, amount: 1.2, speed: 300, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  acts.push(K.pour(spline(H([[30, 20], [60, 34], [98, 36]]), 6), { width: 3, amount: 0.8, speed: 300, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  // Antler horns sweeping back from the crown, with a tine each.
  for (const [dx, dy, k] of [[34, -38, 1], [18, -34, 0.8]]) {
    const main = spline(H([[dx, dy], [dx - 30, dy - 36], [dx - 80, dy - 58], [dx - 118, dy - 54], [dx - 128, dy - 70]]), 8);
    acts.push(K.carve(main, { width: 14 * k, strength: 0.94, speed: 260, rim: 0.3, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
    acts.push(K.carve(spline(H([[dx - 46, dy - 46], [dx - 50, dy - 76], [dx - 40, dy - 96]]), 6), { width: 9 * k, strength: 0.94, speed: 240, rim: 0.3, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
  }
  // Mane: flames streaming back from the jaw and nape.
  for (const [x0, y0, x1, y1, bend] of [[24, -20, -80, -30, -18], [20, 0, -96, 0, 16], [26, 22, -88, 36, -16], [40, 40, -60, 72, 14], [70, 46, -10, 92, -10]]) {
    const mid = [(x0 + x1) / 2, (y0 + y1) / 2 + bend];
    acts.push(K.carve(spline(H([[x0, y0], mid, [x1, y1], [x1 - 14, y1 - bend * 0.8]]), 8), { width: 12, strength: 0.9, speed: 380, rim: 0.3, taper: (u) => 1 - 0.85 * u, rest: 0.02 }));
  }
  // Whiskers: long tendrils from the upper lip, curling at the ends.
  acts.push(K.carve(spline(H([[184, -14], [230, -30], [280, -12], [300, 30], [276, 60], [252, 44]]), 10), { width: 6, strength: 0.95, speed: 330, rim: 0.25, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
  acts.push(K.carve(spline(H([[168, 8], [200, 50], [190, 100], [150, 126], [120, 112], [130, 92]]), 10), { width: 6, strength: 0.95, speed: 330, rim: 0.25, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
  // 画龙点睛: the eye socket, then the glint that brings it alive.
  const [ex, ey] = H([[98, -20]])[0];
  acts.push(K.reveal((st) => st.mask(ellipse(ex, ey, 13, 8, ang - 0.15, 20), { feather: 0.6 }), { op: 'set', level: 2.6, order: 'left', duration: 0.3, rest: 0.1 }));
  acts.push(K.reveal((st) => st.mask(ellipse(ex + 3, ey - 1, 5, 5, 0, 12), { feather: 0.4 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.25, rest: 0.2 }));
  return acts;
}
