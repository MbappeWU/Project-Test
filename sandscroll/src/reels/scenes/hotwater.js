import { spline, ellipse, measure, pointAt, clamp, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 多喝热水 · 龙马精神 — a glass of hot water with goji berries glows on the light table and its
// steam curls up; the palm sweeps the steam into a coil and it becomes a dragon rising from the
// glass, its tail still the steam. The eye is dotted last (画龙点睛). Portrait 1080x1920.
const GX = 540;
const RIM = 975;
const BASE = 1296;
const WATER = 1046;
const RIM_RX = 172;
const BASE_RX = 144;

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
      [[544, 990], [560, 930], [526, 862], [512, 790], [548, 718], [560, 640], [526, 560]],
      [[462, 986], [440, 930], [470, 866], [436, 800], [402, 744], [420, 668]],
      [[626, 986], [648, 930], [620, 872], [652, 812], [694, 760], [680, 684]],
    ];
    acts.push(K.carve(spline(wisps[0], 10), { width: 44, strength: 0.96, speed: 560, rim: 0.25, hard: 0.35, taper: (u) => 1 - 0.72 * u, rest: 0.05 }));
    acts.push(...glass(stage, rng));
    for (const w of wisps.slice(1)) acts.push(K.carve(spline(w, 10), { width: 32, strength: 0.93, speed: 460, rim: 0.2, hard: 0.3, taper: (u) => 1 - 0.78 * u, rest: 0.05 }));
    // Soft glow around the steam, then finer curls: the glass steams while it holds.
    for (const w of wisps) acts.push(K.carve(spline(w, 10).slice(4), { width: 80, strength: 0.32, speed: 420, rim: 0, hard: 0.05, taper: (u) => 1 - 0.7 * u, rest: 0.05 }));
    const curls = [[488, 690, 1], [604, 616, -1], [456, 590, -1], [640, 700, 1]].map(([x, y, dir]) => spline([[x, y], [x + dir * 24, y - 48], [x + dir * 8, y - 96], [x - dir * 22, y - 120]], 8));
    for (const curl of curls) {
      acts.push(K.carve(curl, { width: 10, strength: 0.8, speed: 220, rim: 0.12, taper: K.taperBoth, rest: 0.08 }));
    }
    acts.push(K.wait(3.2));

    // The twist: the palm drags the steam round into a coil, then the dragon is drawn along it.
    const spine = track([[542, 992], [548, 950], [600, 915], [710, 896], [792, 862], [822, 792], [784, 716], [672, 688], [520, 698], [370, 710], [232, 690], [122, 632], [98, 560], [146, 500], [256, 478]]);
    acts.push(...swirl(stage, spine, [...wisps.map((w) => spline(w, 10)), ...curls], dark));
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
  const rimRx = RIM_RX;
  const baseRx = BASE_RX;
  const wall = (sd) => [[GX + sd * rimRx, RIM], [GX + sd * (rimRx - 14), RIM + 150], [GX + sd * baseRx, BASE]];
  acts.push(K.carve(ellipse(GX, RIM, rimRx, 28, 0, 72), { width: 10, strength: 0.95, speed: 1400, rim: 0.25, taper: K.even, rest: 0.05 }));
  acts.push(K.carve(spline(wall(-1), 8), { width: 9, strength: 0.95, speed: 900, rim: 0.25, taper: K.even, rest: 0.03 }));
  acts.push(K.carve(spline(wall(1), 8), { width: 9, strength: 0.95, speed: 900, rim: 0.25, taper: K.even, rest: 0.03 }));
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

// Palm passes smear the steam upward, then the hand draws it round into a glowing coil of
// vapour along the path the dragon will take.
function swirl(stage, spine, wisps, dark) {
  const acts = [];
  for (const w of wisps) {
    const pts = w.filter(([, y]) => y < 945);
    acts.push(K.palm(pts, { width: 110, speed: 1100, target: dark, rate: 0.8, streak: stage.streaks[0], hard: 0.35, rest: 0.02 }));
  }
  acts.push(K.carve(spine.pts, { width: 170, strength: 0.42, speed: 900, rim: 0, hard: 0.05, taper: (u) => 0.3 + 0.7 * smoothstep(0, 0.3, u), rest: 0.05 }));
  return acts;
}

// Nearest point on the centre line: (u, v) with v measured toward the back.
function coords(stage, T, n = 300) {
  const s = stage.s;
  const S = [];
  for (let i = 0; i <= n; i++) {
    const p = T.at(i / n);
    S.push([p.x * s, p.y * s, p.nx, p.ny]);
  }
  return (X, Y) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= n; i++) {
      const dx = X - S[i][0];
      const dy = Y - S[i][1];
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const [x, y, nx, ny] = S[best];
    return [best / n, ((X - x) * nx + (Y - y) * ny) / s];
  };
}

function dragon(stage, rng, T) {
  const acts = [];
  const Rmax = 52;
  const R = (u) => Rmax * (0.08 + 0.92 * smoothstep(0, 0.3, u)) * (1 - 0.2 * smoothstep(0.82, 1, u));
  const ord = along(stage, T);
  const uv = coords(stage, T);
  // The body in one long sweep of the finger, the tail still rising out of the steam.
  acts.push(K.carve(T.pts, { width: Rmax * 2, strength: 0.94, speed: 330, rim: 0.4, hard: 0.55, taper: (u) => R(u) / Rmax, rest: 0.1 }));
  // Dorsal fins: flames along the back, tall and short in turn, their tips curling tailward.
  const fins = [];
  let i = 0;
  for (let d = 150; d < T.len - 50; d += 30, i++) {
    const u = d / T.len;
    const r = R(u);
    const h = (10 + r * 0.5) * (i % 2 ? 0.72 : 1);
    const L = T.len;
    fins.push(spline([T.off(u - 15 / L, r * 0.75), T.off(u - 12 / L, r + h * 0.5), T.off(u - 22 / L, r + h), T.off(u - 2 / L, r + h * 0.55), T.off(u + 15 / L, r * 0.75)], 5, true));
  }
  acts.push(K.reveal((st) => st.mask(fins, { feather: 0.6 }), { op: 'carve', strength: 0.93, order: ord, duration: 2, jitter: 0.01 }));
  // Round the body: shade toward the belly and the far edge, so it reads as a tube in the light.
  const outline = [];
  for (let k = 0; k <= 120; k++) outline.push(T.off(k / 120, R(k / 120) * 1.02));
  for (let k = 120; k >= 0; k--) outline.push(T.off(k / 120, -R(k / 120) * 1.02));
  acts.push(
    K.reveal((st) => st.mask(outline, { feather: 1 }), {
      op: 'add',
      amount: (X, Y) => {
        const [u, v] = uv(X, Y);
        const t = v / Math.max(1, R(u));
        return 0.32 * smoothstep(0.1, -1, t) + 0.2 * smoothstep(0.6, 1, Math.abs(t));
      },
      order: ord,
      duration: 1.2,
      jitter: 0.01,
    }),
  );
  // Scales on the flank, a line along the belly and its plates.
  const scales = [];
  const plates = [];
  let row = 0;
  for (let d = 190; d < T.len - 20; d += 24, row++) {
    const u = d / T.len;
    const r = R(u);
    const p = T.at(u);
    const back = Math.atan2(-p.ty, -p.tx);
    for (let k = 0; k < 4; k++) {
      const v = -0.22 * r + (k + (row % 2) * 0.5) * 0.3 * r;
      if (v > 0.8 * r) continue;
      const [cx, cy] = T.off(u, v);
      scales.push(arcPoly(cx, cy, Math.max(5, r * 0.3), back - 1.2, back + 1.2, 4, 8));
    }
    plates.push(ribbon([T.off(u, -0.44 * r), T.off(u, -0.9 * r)], 3.6, 2));
  }
  const lineBelly = [];
  for (let d = 180; d < T.len - 10; d += 8) lineBelly.push(T.off(d / T.len, -0.4 * R(d / T.len)));
  acts.push(K.reveal((st) => st.mask(scales, { feather: 0.5 }), { op: 'add', amount: 0.85, order: ord, duration: 2.2, jitter: 0.01 }));
  acts.push(K.pour(lineBelly, { width: 4, amount: 1, speed: 900, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(plates, { feather: 0.4 }), { op: 'add', amount: 0.7, order: ord, duration: 1, jitter: 0.01 }));
  // Hind legs: one grips the air beside the glass, one reaches up for the pearl.
  acts.push(...limb({ root: T.off(0.18, -30), elbow: [806, 952], wrist: [862, 962], dir: 0.35 }));
  acts.push(...limb({ root: T.off(0.47, -28), elbow: [598, 592], wrist: [622, 540], dir: -1.2 }));
  // 龙珠: the flaming pearl the dragon chases, glowing between its jaws and its claw.
  acts.push(...pearl(stage, PEARL[0], PEARL[1], PEARL[2]));
  acts.push(...limb({ root: T.off(0.95, -30), elbow: [262, 580], wrist: [350, 580], dir: 0.05 }));
  acts.push(...head(stage, T));
  return acts;
}

const PEARL = [646, 452, 40];

function pearl(stage, x, y, r) {
  return [
    K.reveal((st) => st.mask(ellipse(x, y, r, r, 0, 48), { feather: 1 }), { op: 'carve', strength: 0.97, order: 'spiral', duration: 0.8, jitter: 0.03 }),
    K.reveal((st) => K.radialMask(st, x, y, r, r * 2.8, 2.2), { op: 'carve', strength: 0.45, order: 'out', duration: 0.6, jitter: 0.05 }),
  ];
}

function limb({ root, elbow, wrist, dir }) {
  const acts = [];
  const arm = spline([root, elbow, wrist], 10);
  acts.push(K.carve(arm, { width: 48, strength: 0.94, speed: 300, rim: 0.35, hard: 0.55, taper: (u) => 1 - 0.4 * u, rest: 0.04 }));
  // Flame tufts trailing from the elbow.
  const [ex, ey] = elbow;
  const back = Math.atan2(root[1] - elbow[1], root[0] - elbow[0]) + Math.PI * 0.55;
  const tufts = [];
  for (let k = 0; k < 3; k++) {
    const a = back + (k - 1) * 0.35;
    tufts.push(ribbon(spline([[ex, ey], [ex + Math.cos(a) * 24, ey + Math.sin(a) * 24], [ex + Math.cos(a + 0.4) * 44, ey + Math.sin(a + 0.4) * 44]], 4), 11, 1));
  }
  acts.push(K.reveal((st) => st.mask(tufts, { feather: 0.5 }), { op: 'carve', strength: 0.9, order: 'out', duration: 0.4, rest: 0.02 }));
  const [wx, wy] = wrist;
  const talons = [];
  for (let k = 0; k < 4; k++) {
    const a = dir + (k - 1.5) * 0.5;
    const l = k === 0 ? 34 : 46;
    const p1 = [wx + Math.cos(a) * l * 0.6, wy + Math.sin(a) * l * 0.6];
    const p2 = [wx + Math.cos(a) * l, wy + Math.sin(a) * l];
    const p3 = [p2[0] + Math.cos(a + 1.6) * 14, p2[1] + Math.sin(a + 1.6) * 14];
    talons.push(ribbon(spline([[wx, wy], p1, p2, p3], 4), 14, 1.5));
  }
  acts.push(K.reveal((st) => st.mask(talons, { feather: 0.5 }), { op: 'carve', strength: 0.95, order: 'out', duration: 0.5, rest: 0.03 }));
  return acts;
}

// The head in profile facing the pearl: short deep muzzle with an upturned 如意 nose, heavy
// brow over a big eye, open jaws with fangs and a curling tongue, antler horns and a flaming mane
// swept back, whiskers streaming. The eye's glint is dotted last (画龙点睛).
function head(stage, T) {
  const acts = [];
  const p = T.at(1);
  const ang = Math.atan2(p.ty, p.tx) + 0.02;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const HS = 1.5;
  const H = (pts) => pts.map(([a, b]) => [p.x + (a * c - b * sn) * HS, p.y + (a * sn + b * c) * HS]);
  const local = (X, Y) => {
    const dx = X / stage.s - p.x;
    const dy = Y / stage.s - p.y;
    return [(dx * c + dy * sn) / HS, (-dx * sn + dy * c) / HS];
  };
  const line = (pts, width, amount = 1.1, speed = 300) => K.pour(spline(H(pts), 6), { width, amount, speed, taper: K.taperBoth, scatter: 0, rest: 0.02 });
  const flame = (pts, width, speed = 360) => K.carve(spline(H(pts), 8), { width, strength: 0.94, speed, rim: 0.3, taper: (u) => 1 - 0.85 * u, rest: 0.02 });
  const skull = spline(H([[-16, -20], [0, -40], [18, -50], [50, -58], [76, -52], [90, -38], [112, -36], [134, -48], [154, -52], [168, -40], [170, -24], [160, -12], [130, -8], [92, 2], [124, 14], [150, 18], [164, 24], [158, 40], [120, 46], [76, 54], [36, 54], [2, 44], [-16, 20]]), 6, true);
  acts.push(
    K.reveal((st) => st.mask(skull, { feather: 0.8 }), {
      op: 'set',
      level: (X, Y) => {
        const [a, b] = local(X, Y);
        return 0.06 + 0.4 * smoothstep(8, 52, b) + 0.25 * smoothstep(30, -10, a);
      },
      order: 'left',
      duration: 1.1,
    }),
  );
  acts.push(K.pour(skull, { width: 3.5, amount: 1, speed: 1600, taper: K.even, scatter: 0, rest: 0.02 }));
  // The mane flames back from the cheeks and nape, over the join of head and neck.
  for (const [x0, y0, x1, y1, bend] of [[22, -38, -56, -72, -12], [18, -18, -84, -34, 14], [16, 4, -96, 2, -14], [22, 24, -86, 42, 14], [36, 40, -58, 78, -12], [58, 48, -12, 100, 12]]) {
    const mid = [(x0 + x1) / 2, (y0 + y1) / 2 + bend];
    acts.push(flame([[x0, y0], mid, [x1, y1], [x1 - 16, y1 - bend * 0.9]], 26));
  }
  // Open mouth, fangs and tongue; nostril, nose scroll, brow, cheek.
  acts.push(K.reveal((st) => st.mask(spline(H([[92, 2], [130, -7], [162, -11], [160, 22], [124, 13]]), 6, true), { feather: 0.6 }), { op: 'set', level: 2.6, order: 'left', duration: 0.4, rest: 0.03 }));
  const fangs = [H([[138, -8], [143, 7], [149, -9]]), H([[150, 19], [154, 5], [158, 21]])];
  acts.push(K.reveal((st) => st.mask(fangs, { feather: 0.3 }), { op: 'carve', strength: 0.97, order: 'left', duration: 0.3, rest: 0.02 }));
  acts.push(flame([[116, 8], [158, 6], [188, -2], [198, -18], [188, -30]], 13, 260));
  acts.push(K.reveal((st) => st.mask(ellipse(...H([[154, -34]])[0], 8, 5.5, ang, 12), { feather: 0.5 }), { op: 'set', level: 2.5, order: 'out', duration: 0.2, rest: 0.02 }));
  acts.push(line([[124, -40], [142, -54], [162, -46]], 4));
  acts.push(line([[40, -48], [64, -60], [92, -46]], 6, 1.5));
  acts.push(line([[96, -30], [128, -26]], 3, 0.8));
  // Eye socket (dark) with a heavy lid.
  const [ex, ey] = H([[64, -36]])[0];
  acts.push(K.reveal((st) => st.mask(ellipse(ex, ey, 22, 14, ang - 0.15, 24), { feather: 0.6 }), { op: 'set', level: 2.7, order: 'left', duration: 0.3, rest: 0.03 }));
  // Bristling brow flames above the eye.
  acts.push(flame([[56, -56], [34, -76], [2, -80], [-18, -70]], 18));
  // Antler horns sweeping back from the crown, each with a tine.
  for (const [dx, dy, k] of [[30, -50, 1], [12, -46, 0.8]]) {
    acts.push(K.carve(spline(H([[dx, dy], [dx - 28, dy - 38], [dx - 78, dy - 60], [dx - 116, dy - 56], [dx - 128, dy - 74]]), 8), { width: 22 * k, strength: 0.95, speed: 260, rim: 0.3, taper: (u) => 1 - 0.78 * u, rest: 0.03 }));
    acts.push(K.carve(spline(H([[dx - 46, dy - 50], [dx - 52, dy - 80], [dx - 40, dy - 100]]), 6), { width: 15 * k, strength: 0.95, speed: 240, rim: 0.3, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
  }
  // Beard under the chin, then the whiskers: long tendrils from the upper lip, curling.
  for (const [x0, y0, x1, y1] of [[150, 42, 132, 78], [128, 46, 104, 82], [104, 50, 80, 84]]) acts.push(flame([[x0, y0], [(x0 + x1) / 2 + 6, (y0 + y1) / 2], [x1, y1], [x1 - 10, y1 - 6]], 14));
  acts.push(K.carve(spline(H([[164, -30], [192, -62], [172, -98], [122, -106], [90, -88], [100, -72]]), 10), { width: 10, strength: 0.96, speed: 330, rim: 0.25, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
  acts.push(K.carve(spline(H([[160, -16], [206, -10], [236, 18], [228, 52], [200, 58], [198, 40]]), 10), { width: 10, strength: 0.96, speed: 330, rim: 0.25, taper: (u) => 1 - 0.8 * u, rest: 0.03 }));
  // 画龙点睛: the eyeball lit, then the pupil and the glint that bring it alive.
  acts.push(K.reveal((st) => st.mask(ellipse(ex + 2, ey, 13, 10, 0, 20), { feather: 0.4 }), { op: 'carve', strength: 0.9, order: 'out', duration: 0.25, rest: 0.1 }));
  acts.push(K.reveal((st) => st.mask(ellipse(ex + 5, ey, 5.5, 7.5, 0, 14), { feather: 0.4 }), { op: 'set', level: 2.8, order: 'out', duration: 0.2, rest: 0.25 }));
  return acts;
}
