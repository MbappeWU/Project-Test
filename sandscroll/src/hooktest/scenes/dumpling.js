import { spline, ellipse, clamp, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 金玉满堂 — a plump pleated jiaozi steams on a little plate. A palm smears it into a soft glowing
// egg, a veil tail and fins unfurl out of it, the body blushes vermilion and the eye is dotted
// last: the dumpling swims off as a goldfish. (金鱼饺, the goldfish dumpling, is a real dim-sum
// shape, and 金鱼 sounds like 金玉.) Portrait 1080x1920, hook-test variant A: the finished
// goldfish flashes first, so it keeps clear of the caption (y < 600).
const NIGHT = 2.6;

export default {
  id: 'dumpling',
  variant: 'A',
  hook: { en: 'Dumpling → GOLDFISH', lines: ['Dumpling →', 'GOLDFISH'], cn: '一只饺子，一条金鱼' },
  trend: 'Chinamaxxing (Chinese food; dumplings are a staple of the trend); 金鱼饺, the goldfish dumpling, is a real dim-sum shape',
  accent: '金鱼 (the goldfish body and head)',
  music: 'garden',
  title: { cn: '金鱼饺', en: 'Goldfish Dumpling' },
  theme: '美食 · 饺子（Chinamaxxing 热点）',
  description: '盘里一只捏满褶子的饺子冒着热气，掌心一抹，褶子散开成飘逸的尾鳍，饺子变成一条红金鱼游走了。',
  payoff: { en: 'Dinner just swam away.', cn: '煮熟的饺子，游走了' },
  inscription: { columns: ['金玉满堂'], note: '成语，语出《老子》第九章“金玉满堂，莫之能守”；“金鱼”谐音“金玉”，金鱼满塘是传统吉祥图案' },
  seal: '金鱼',
  twist: '饺子的褶子散开成尾鳍，一只饺子变成一条红金鱼',
  build(stage, rng) {
    const acts = [];
    // ---- Picture A: the dumpling, its plate and a curl of steam ----
    acts.push(...dumpling(stage));
    acts.push(...plate(stage));
    acts.push(...steam());
    acts.push(K.wait(0.45));
    // ---- Twist: the palm smears it into the fish's glowing shape, fins unfurl out of it ----
    acts.push(...smear(stage));
    acts.push(...goldfish(stage, rng));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 640, size: 56, mode: 'carve', strength: 0.9, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 950, 930, { size: 58, seed: 17 }));
    return acts;
  },
};

// ---------------------------------------------------------------------------------------------
// Picture A: a jiaozi seen from the side: a plump dome on a flat belly, pinched to a point at
// both ends, its crimped seam running over the top and the pleats folding down the front.
const D = { cx: 530, tipY: 1050, w: 300, top: 190, belly: 58 };
const PLEATS = 7;
const PU = Array.from({ length: PLEATS }, (_, i) => -0.69 + (1.38 * i) / (PLEATS - 1));
const SLANT = 0.3; // pleat folds lean right: u shift per unit depth
const BOW = 1.3; // and bow a little

const dx = (u) => D.cx + D.w * u;
const lift = (u) => -30 * Math.abs(u) ** 5;
const seamBase = (u) => D.tipY - D.top * Math.pow(Math.max(0, 1 - Math.abs(u) ** 2.2), 0.55) + lift(u);
const bellyY = (u) => D.tipY + D.belly * Math.pow(Math.max(0, 1 - u * u), 1.2) + lift(u);
// The crimped edge: a scallop between neighbouring pleats.
function crimp(u) {
  const edge = 0.9;
  if (Math.abs(u) > edge) return 0;
  const k = (u - PU[0]) / (PU[1] - PU[0]);
  return 22 * (1 - (u / edge) ** 6) * Math.abs(Math.sin(Math.PI * k)) ** 0.6;
}
const seamY = (u) => seamBase(u) - crimp(u);
// A point on the dumpling's front at across-position u and depth v (0 seam .. 1 belly).
const onFront = (u, v) => [dx(u), seamY(u) + v * (bellyY(u) - seamY(u))];

function seamLine(n = 160) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([dx(-1 + (2 * i) / n), seamY(-1 + (2 * i) / n)]);
  return pts;
}

function bellyLine(n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([dx(1 - (2 * i) / n), bellyY(1 - (2 * i) / n)]);
  return pts;
}

const dumplingOutline = () => [...seamLine(), ...bellyLine()];

// A pleat fold: from its notch in the seam, a crease leaning right down the front.
function fold(u, depth = 0.34, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const v = (depth * i) / n;
    pts.push(onFront(u + SLANT * v - BOW * v * (depth - v), v));
  }
  return pts;
}

function dumpling(stage) {
  const s = stage.s;
  const acts = [];
  const tex = stage.mottle(1, 0.07, 0.03, 13);
  // The hook: one fast glowing stroke round the dumpling, seam first.
  const outline = dumplingOutline();
  acts.push(K.carve([...outline, outline[1], outline[2]], { width: 14, strength: 0.96, speed: 1700, rim: 0.3, taper: K.even, rest: 0.03 }));
  acts[0].mark = 'open';
  // Steamed wrapper: translucent and glowing, deeper toward the tips and the belly; each pleat
  // a soft fold, shaded at its crease and lit along its ridge; a sheen on the plump front.
  const wrapper = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const u = clamp((x - D.cx) / D.w, -1, 1);
    const top = seamY(u);
    const v = clamp((y - top) / Math.max(1, bellyY(u) - top), 0, 1);
    const tip = smoothstep(0.66, 1, Math.abs(u));
    const q = (u - SLANT * v + BOW * v * Math.max(0, 0.34 - v) - PU[0]) / (PU[1] - PU[0]);
    const f = q - Math.floor(q);
    const zone = q > -0.6 && q < PLEATS - 0.4 ? smoothstep(0.4, 0.06, v) : 0;
    const pleat = zone * (0.4 * Math.exp(-((f / 0.14) ** 2)) + 0.4 * Math.exp(-(((1 - f) / 0.14) ** 2)) - 0.08 * Math.exp(-(((f - 0.55) / 0.2) ** 2)));
    // The pressed seam is thin dough: a bright frill along the top.
    const frill = smoothstep(20, 8, y - seamY(u)) * (1 - tip);
    const sheen = Math.exp(-(((u + 0.12) / 0.42) ** 2) - (((v - 0.62) / 0.18) ** 2));
    return (0.3 + 0.85 * tip ** 1.5 + 0.8 * smoothstep(0.7, 1.05, v) ** 1.5 + pleat - 0.16 * frill - 0.12 * sheen) * tex(X, Y);
  };
  acts.push(K.reveal((st) => st.mask(outline, { feather: 0.8 }), { op: 'set', level: wrapper, order: 'down', duration: 1.1, jitter: 0.05, rest: 0.02 }));
  acts.push(K.pour([...outline, outline[1]], { width: 6, amount: 1.3, speed: 2600, taper: K.even, scatter: 0, rest: 0.02 }));
  // The pleats pressed in: a crease down from every notch, then the crimped seam lit.
  for (const u of PU) acts.push(K.pour(fold(u), { width: 6, amount: 0.9, speed: 700, taper: K.taperEnd, scatter: 0, hard: 0.4, rest: 0.01 }));
  acts.push(K.carve(seamLine().slice(14, -14), { width: 5, strength: 0.7, speed: 1800, rim: 0.2, taper: K.taperBoth, rest: 0.02 }));
  return acts;
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
    const hw = (w0 + (w1 - w0) * (i / Math.max(1, n - 1))) / 2;
    L.push([pts[i][0] - ((y1 - y0) / len) * hw, pts[i][1] + ((x1 - x0) / len) * hw]);
    R.push([pts[i][0] + ((y1 - y0) / len) * hw, pts[i][1] - ((x1 - x0) / len) * hw]);
  }
  return [...L, ...R.reverse()];
}

const PLATE = { cx: 540, cy: 1110, rx: 390, ry: 84 };

// A ring along an ellipse, as one polygon (outer one way, inner the other).
function ring(cx, cy, rx, ry, w, n = 96) {
  return [...ellipse(cx, cy, rx + w / 2, ry + w / 2, 0, n), ...ellipse(cx, cy, rx - w / 2, ry - w / 2, 0, n).reverse()];
}

// The plate under the dumpling: a dim glazed oval with a lit rim, the dumpling's shadow on it.
function plate(stage) {
  const s = stage.s;
  let cut = null;
  const behind = (st, polys, feather = 0.8) => {
    cut ??= st.mask(dumplingOutline(), { feather: 1.5 });
    return st.mask(polys, { feather }).map((a, X, Y) => a * (1 - cut.at(X, Y)));
  };
  const tex = stage.mottle(1, 0.08, 0.02, 17);
  const glaze = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const u = clamp((x - D.cx) / D.w, -1, 1);
    const shadow = Math.abs((x - D.cx) / D.w) < 1.05 ? Math.exp(-(((y - bellyY(u) - 6) / 24) ** 2)) : 0;
    const e = Math.hypot((x - PLATE.cx) / PLATE.rx, (y - PLATE.cy) / PLATE.ry);
    const well = Math.abs(e - 0.8) < 0.03 ? 0.35 : 0;
    return (1.2 + 0.35 * smoothstep(0.55, 1, e) + well + 0.9 * shadow) * tex(X, Y);
  };
  return [
    K.reveal((st) => behind(st, ellipse(PLATE.cx, PLATE.cy, PLATE.rx, PLATE.ry, 0, 96)), { op: 'set', level: glaze, order: 'out', duration: 0.8, jitter: 0.05, rest: 0.02 }),
    K.reveal((st) => behind(st, ring(PLATE.cx, PLATE.cy, PLATE.rx - 4, PLATE.ry - 2, 8), 0.5), { op: 'carve', strength: 0.85, order: 'left', duration: 0.4, jitter: 0.02, rest: 0.02 }),
  ];
}

// A curl of steam rising off the top of the dumpling.
function steam() {
  const acts = [];
  for (const [x, y, h, ph] of [
    [476, 836, 170, 0.4],
    [566, 826, 200, 2.0],
    [646, 846, 140, 3.3],
  ]) {
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      pts.push([x + 16 * Math.sin(ph + t * 5.4) * (0.4 + t), y - t * h]);
    }
    acts.push(K.carve(pts, { width: 12, strength: 0.55, speed: 700, rim: 0, hard: 0.1, taper: (u) => 0.4 + 0.6 * Math.sin(Math.PI * u), rest: 0.02 }));
  }
  return acts;
}

// ---------------------------------------------------------------------------------------------
// Picture B: a fancy goldfish in profile, swimming left and a little upward, its double veil
// tail streaming to the lower right. Authored in the fish's own frame (x toward the tail,
// y toward the belly), then placed and tilted.
const FISH = { x: 372, y: 973, rot: 0.24, k: 1.06 };
const FC = Math.cos(FISH.rot) * FISH.k;
const FS = Math.sin(FISH.rot) * FISH.k;
const G = ([x, y]) => [FISH.x + x * FC - y * FS, FISH.y + x * FS + y * FC];
const GP = (pts) => pts.map(G);
function toLocal(x, y) {
  const a = (x - FISH.x) / FISH.k ** 2;
  const b = (y - FISH.y) / FISH.k ** 2;
  return [a * FC + b * FS, -a * FS + b * FC];
}

const BODY = [
  [-238, 14], [-234, -22], [-216, -64], [-182, -106], [-128, -144], [-56, -168], [22, -166], [96, -138], [156, -94], [204, -54], [236, -28],
  [248, -2], [236, 24], [200, 50], [140, 104], [60, 150], [-30, 168], [-116, 156], [-180, 122], [-220, 76],
];
const BODY_LOCAL = spline(BODY, 4, true);
const bodyOutline = () => GP(spline(BODY, 6, true));
const EYE = { x: -168, y: -42, r: 30 };

// One fin ray: from p0, heading `dir`, bending by k0 (radians per px) easing to k1 at the tip.
function ray(p0, dir, len, k0, k1, n = 18) {
  const pts = [[p0[0], p0[1]]];
  let [x, y] = p0;
  let a = dir;
  const ds = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    a += (k0 + (k1 - k0) * t) * ds;
    x += Math.cos(a) * ds;
    y += Math.sin(a) * ds;
    pts.push([x, y]);
  }
  return pts;
}

// A fin: rays fanning from the hinge A-B on the body; the outer two rays are its leading edges
// and the free edge runs through the tips of the others. spec(t) -> { dir, len, k0, k1 }.
function fin(A, B, count, spec, scallop = 0.035) {
  const rays = [];
  const base = (t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const { dir, len, k0 = 0, k1 = k0 } = spec(t);
    rays.push(ray(base(t), dir, len, k0, k1));
  }
  // The free edge runs through the ray tips and dips a little toward the body between them.
  const ctrl = [];
  for (let i = 0; i < count; i++) {
    const [x, y] = rays[i][rays[i].length - 1];
    ctrl.push([x, y]);
    if (i === count - 1) break;
    const [x2, y2] = rays[i + 1][rays[i + 1].length - 1];
    const [bx, by] = base((i + 0.5) / (count - 1));
    const mx = (x + x2) / 2;
    const my = (y + y2) / 2;
    ctrl.push([mx + (bx - mx) * scallop, my + (by - my) * scallop]);
  }
  const edge = spline(ctrl, 4);
  const poly = [A, ...rays[0], ...edge.slice(1, -1), ...rays[count - 1].slice().reverse(), B];
  return { poly: GP(poly), rays: rays.map(GP), edge: GP(edge) };
}

const lobes = (t, a, b, c) => a * Math.exp(-(((t - 0.15) / 0.18) ** 2)) + b * Math.exp(-(((t - 0.46) / 0.12) ** 2)) + c * Math.exp(-(((t - 0.8) / 0.2) ** 2));
// Near half of the double tail: an upper lobe arching over and drooping, a deep notch, a
// longer lower lobe streaming back with its tip curling up.
const TAIL = fin(
  [232, -20],
  [232, 20],
  17,
  (t) => ({
    dir: -0.85 + 2.15 * t,
    len: 170 + lobes(t, 110, -60, 180),
    k0: 0.002 - 0.0035 * t,
    k1: 0.007 - 0.016 * t,
  }),
  0.025,
);
// Far half: a wider, dimmer fan behind the near one.
const TAIL2 = fin(
  [228, -20],
  [228, 18],
  13,
  (t) => ({
    dir: -1.15 + 2.6 * t,
    len: 150 + lobes(t, 100, -50, 140),
    k0: 0.0025 - 0.0045 * t,
    k1: 0.008 - 0.012 * t,
  }),
  0.025,
);
// Dorsal sail: tall at the front, sloping back to a trailing point over the tail.
const DORSAL = fin(
  [-104, -156],
  [160, -90],
  12,
  (t) => ({
    dir: -1.7 + 1.4 * t,
    len: 175 - 120 * t + 90 * smoothstep(0.75, 1, t),
    k0: 0.003,
    k1: 0.004,
  }),
  0.03,
);
const PELVIC = fin([-40, 158], [4, 160], 6, (t) => ({ dir: 1.1 - 0.4 * t, len: 120 + 20 * Math.sin(Math.PI * t), k0: -0.003, k1: -0.007 }));
const ANAL = fin([118, 110], [168, 76], 5, (t) => ({ dir: 0.8 - 0.3 * t, len: 110, k0: -0.002, k1: -0.006 }));
// The pectoral fin lies over the flank behind the gill cover, reaching past the belly.
const PECTORAL = fin([-80, 58], [-70, 80], 6, (t) => ({ dir: 1.6 - 0.95 * t, len: 72 + 22 * Math.sin(Math.PI * t), k0: -0.003, k1: -0.006 }));

// The palm smears the dumpling into the soft glowing shape of the fish and wipes plate and
// steam away.
function smear(stage) {
  const night = stage.mottle(NIGHT, 0.1, 0.01, 3);
  const ghost = stage.mottle(1.3, 0.12, 0.02, 21);
  let body = null;
  const target = (X, Y) => {
    body ??= stage.mask(bodyOutline(), { feather: 16 });
    const k = body.at(X, Y);
    return night(X, Y) + (ghost(X, Y) - night(X, Y)) * k;
  };
  const acts = [];
  // Round strokes over the dumpling that carry on to where the fish's head will be.
  const strokes = [
    [[850, 1010], [720, 890], [540, 836], [370, 836], [210, 876], [100, 940]],
    [[90, 990], [240, 980], [400, 990], [560, 1000], [720, 1030], [870, 1070]],
    [[960, 1140], [760, 1170], [540, 1180], [340, 1160], [150, 1110]],
  ];
  for (const [i, pts] of strokes.entries()) {
    acts.push(K.palm(spline(pts, 8), { width: i === 2 ? 230 : 200, speed: 1450, target, rate: 0.9, streak: stage.streaks[i % 3], streakMode: 'target', hard: 0.35, rest: 0.03 }));
  }
  acts[0].mark = 'twist';
  // Plate and steam are wiped back into the night.
  acts.push(K.palm(spline([[980, 1060], [760, 1030], [540, 1030], [300, 1040], [100, 1080]], 8), { width: 200, speed: 1500, target, rate: 0.95, streak: stage.streaks[1], streakMode: 'target', hard: 0.4, rest: 0.03 }));
  acts.push(K.palm(spline([[440, 880], [470, 740], [520, 660], [580, 640], [640, 700], [680, 830]], 8), { width: 240, speed: 1400, target, rate: 0.95, streak: stage.streaks[2], streakMode: 'target', hard: 0.55, rest: 0.03 }));
  return acts;
}

function goldfish(stage, rng) {
  const s = stage.s;
  const acts = [];
  const outline = bodyOutline();
  const eye = G([EYE.x, EYE.y]);
  // Fins first, unfurling out of the smeared dough from their roots: a translucent veil, lighter
  // toward the free edge and streaked along the rays, then the rays and a lit edge. The body
  // covers their roots.
  const finTex = stage.mottle(1, 0.12, 0.03, 37);
  const veil = (base, root, reach) => (X, Y) => {
    const [lx, ly] = toLocal(X / s, Y / s);
    const r = Math.hypot(lx - root[0], ly - root[1]);
    const a = Math.atan2(ly - root[1], lx - root[0]);
    const streak = stage.noise.n2(a * 16, r * 0.006);
    return base * (1.1 - 0.55 * smoothstep(0, reach, r)) * (1 + 0.22 * streak) * finTex(X, Y);
  };
  const rays = (f, w = 3) => f.rays.map((r) => ribbon(r, w, 1));
  const fromRoot = (p) => {
    const [rx, ry] = G(p);
    return (X, Y) => Math.hypot(X / s - rx, Y / s - ry) / 400;
  };
  const tailRoot = fromRoot([228, 0]);
  acts.push(K.reveal((st) => st.mask(TAIL2.poly, { feather: 1 }), { op: 'set', level: veil(1.4, [228, 0], 300), order: tailRoot, duration: 0.6, jitter: 0.03, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(TAIL.poly, { feather: 1 }), { op: 'set', level: veil(1.0, [230, 0], 330), order: tailRoot, duration: 0.9, jitter: 0.03, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask([...rays(TAIL, 4), ...rays(TAIL2, 3)], { feather: 0.5 }), { op: 'carve', strength: 0.75, order: tailRoot, duration: 0.5, jitter: 0.02, rest: 0.02 }));
  acts.push(K.carve(TAIL.edge, { width: 4, strength: 0.6, speed: 2200, rim: 0.1, taper: K.taperBoth, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(DORSAL.poly, { feather: 1 }), { op: 'set', level: veil(1.0, [40, -120], 200), order: fromRoot([30, -120]), duration: 0.6, jitter: 0.03, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask([PELVIC.poly, ANAL.poly], { feather: 1 }), { op: 'set', level: veil(1.0, [40, 120], 200), order: fromRoot([60, 130]), duration: 0.5, jitter: 0.03, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask([DORSAL, PELVIC, ANAL].flatMap((f) => rays(f, 3.4)), { feather: 0.5 }), { op: 'carve', strength: 0.7, order: fromRoot([40, 0]), duration: 0.5, jitter: 0.02, rest: 0.02 }));
  // The body and head are glazed vermilion; the eye and the pectoral fin lying over the flank
  // stay gold.
  acts.push(
    K.tint(
      stage,
      (st) => {
        const cut = st.mask(ellipse(eye[0], eye[1], EYE.r * FISH.k + 2, EYE.r * FISH.k + 2, 0, 32), { feather: 1 });
        const pec = st.mask(PECTORAL.poly, { feather: 0.6 });
        return st.mask(outline, { feather: 1.2 }).map((a, X, Y) => a * (1 - cut.at(X, Y)) * (1 - pec.at(X, Y)));
      },
      { fadeIn: 1.0, strength: 0.9 },
    ),
  );
  // Body in light-table shading: thin, bright sand along the back, denser toward the belly and
  // the rim, so the vermilion runs from bright red to deep red and the grain shows through.
  const tex = stage.mottle(1, 0.16, 0.025, 31);
  let soft = null;
  const flesh = (X, Y) => {
    const a = soft.at(X, Y);
    const rim = clamp(2 - 2 * a, 0, 1);
    const [lx, ly] = toLocal(X / s, Y / s);
    const belly = smoothstep(-80, 170, ly);
    const lit = Math.exp(-(((ly + 64) / 64) ** 2) - (((lx + 10) / 180) ** 2));
    return (0.36 + 1.2 * rim ** 1.5 + 0.8 * belly ** 1.5 - 0.26 * lit) * tex(X, Y);
  };
  const body = K.reveal(
    (st) => {
      soft = st.mask(outline, { feather: 30 });
      return st.mask(outline, { feather: 0.8 });
    },
    { op: 'set', level: flesh, order: 'out', duration: 1.4, jitter: 0.04, rest: 0.02 },
  );
  body.mark = 'goldfish';
  acts.push(body);
  acts.push(K.pour(outline, { width: 6, amount: 1.3, speed: 2400, taper: K.even, scatter: 0, rest: 0.02 }));
  // The pectoral fin over the flank.
  acts.push(K.reveal((st) => st.mask(PECTORAL.poly, { feather: 1 }), { op: 'set', level: veil(0.95, [-74, 70], 100), order: 'down', duration: 0.3, jitter: 0.05, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(rays(PECTORAL, 3), { feather: 0.5 }), { op: 'carve', strength: 0.6, order: 'out', duration: 0.25, jitter: 0.02, rest: 0.02 }));
  // Warm light spilling from the fish onto the dark water around it.
  const [hx, hy] = G([60, 10]);
  acts.push(
    K.reveal(
      (st) => {
        const fish = st.mask([outline, TAIL.poly, TAIL2.poly, DORSAL.poly, PELVIC.poly, ANAL.poly], { feather: 6 });
        return K.radialMask(st, hx, hy, 230, 560, 1.7).map((a, X, Y) => a * (1 - fish.at(X, Y)));
      },
      { op: 'carve', strength: 0.16, order: 'out', duration: 0.6, jitter: 0.08, rest: 0.02 },
    ),
  );
  // Scales: overlapping arcs opening toward the head, carved in staggered columns.
  const scales = [];
  const R = 17;
  for (let col = 0; col < 12; col++) {
    const lx = -66 + col * 22;
    for (let row = -6; row <= 6; row++) {
      const ly = row * 30 + (col % 2 ? 15 : 0);
      if (!insideBody(lx, ly, 20)) continue;
      const j = () => rng.float(-2.5, 2.5);
      scales.push(GP(crescent(lx + j(), ly + j(), R - col * 0.5 + j() * 0.4, -1.25 + j() * 0.04, 1.25 + j() * 0.04, 3)));
    }
  }
  acts.push(K.reveal((st) => st.mask(scales, { feather: 0.4 }), { op: 'carve', strength: 0.5, order: 'left', duration: 0.5, jitter: 0.03, rest: 0.02 }));
  // Gill cover: a carved arc with its shadow behind; thin lit lines along the back and over the
  // brow; the mouth.
  const gill = spline([[-104, -128], [-86, -66], [-82, -4], [-92, 58], [-116, 104]], 8);
  acts.push(K.pour(GP(gill.map(([x, y]) => [x + 7, y])), { width: 6, amount: 0.7, speed: 1400, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
  acts.push(K.carve(GP(gill), { width: 4, strength: 0.6, speed: 1400, rim: 0.1, taper: K.taperBoth, rest: 0.01 }));
  acts.push(K.carve(GP(spline([[-150, -110], [-70, -144], [30, -144], [110, -112], [176, -66]], 8)), { width: 7, strength: 0.5, speed: 1600, rim: 0.1, taper: K.taperBoth, rest: 0.01 }));
  acts.push(K.carve(GP(spline([[-200, -40], [-190, -70], [-164, -96], [-132, -110]], 6)), { width: 6, strength: 0.55, speed: 700, rim: 0.1, taper: K.taperBoth, rest: 0.01 }));
  acts.push(K.pour(GP([[-238, 14], [-222, 20], [-212, 18]]), { width: 5, amount: 1.2, speed: 400, taper: K.taperEnd, scatter: 0, rest: 0.01 }));
  // The eye, dotted last: a dark socket, a gold ring, the pupil, a glint.
  const er = EYE.r * FISH.k;
  acts.push(K.pour(ellipse(eye[0], eye[1], er + 4, er + 4, 0, 48), { width: 5, amount: 0.9, speed: 900, taper: K.even, scatter: 0, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(ellipse(eye[0], eye[1], er, er, 0, 40), { feather: 0.6 }), { op: 'carve', strength: 0.95, order: 'out', duration: 0.25, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(ellipse(eye[0] - 3, eye[1], er * 0.57, er * 0.57, 0, 32), { feather: 0.5 }), { op: 'set', level: 2.9, order: 'out', duration: 0.2, rest: 0.04 }));
  acts.push(K.reveal((st) => st.mask(ellipse(eye[0] - 9, eye[1] - 7, 5, 5, 0, 16), { feather: 0.4 }), { op: 'carve', strength: 0.95, order: 'out', duration: 0.12, rest: 0.08 }));
  // Bubbles rising from the mouth.
  for (const [x, y, r] of [
    [112, 861, 12],
    [134, 795, 8],
    [104, 733, 15],
    [130, 675, 7],
  ]) {
    acts.push(K.carve(ellipse(x, y, r, r, -1.2, 24), { width: 4, strength: 0.85, speed: 500, rim: 0.15, taper: K.even, rest: 0.01 }));
  }
  acts.push(K.reveal((st) => st.mask([ellipse(98, 725, 4, 3, -0.7, 12), ellipse(106, 855, 3, 2.4, -0.7, 12)], { feather: 0.3 }), { op: 'carve', strength: 0.9, order: 'left', duration: 0.1, rest: 0.05 }));
  return acts;
}

function insideBody(lx, ly, margin) {
  for (const [ox, oy] of [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]]) {
    if (!pointIn(lx + ox, ly + oy, BODY_LOCAL)) return false;
  }
  return true;
}

function pointIn(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Thin crescent band (a scale's free edge) along a circle arc, bulging toward the tail (+x).
function crescent(cx, cy, r, a0, a1, w) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= 10; i++) {
    const a = a0 + ((a1 - a0) * i) / 10;
    const k = 0.35 + 0.65 * Math.sin((Math.PI * i) / 10);
    outer.push([cx + Math.cos(a) * (r + (w / 2) * k), cy + Math.sin(a) * (r + (w / 2) * k)]);
    inner.push([cx + Math.cos(a) * (r - (w / 2) * k), cy + Math.sin(a) * (r - (w / 2) * k)]);
  }
  return [...outer, ...inner.reverse()];
}
