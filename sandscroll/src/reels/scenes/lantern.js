import { spline, ellipse, clamp, smoothstep, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 灯火可亲 — a jack-o'-lantern grins out of the dark under a bat-crossed moon; a palm smears it
// and the same ribbed globe comes back as a round red lantern with gold caps and a long tassel.
// The pumpkin's grooves and the lantern's ribs share the same meridians. Portrait 1080x1920.
export default {
  id: 'lantern',
  music: 'garden',
  title: { cn: '灯火可亲', en: 'Jack-o’-Lantern to Chinese Lantern' },
  theme: '节日 · 万圣节 × 中国风',
  hook: { en: 'Halloween, but make it Chinese', cn: '万圣节，中国风' },
  payoff: { en: 'Same glow. Different story.', cn: '同一盏灯火，不同的故事' },
  inscription: { columns: ['灯火可亲'], note: '化用唐 · 韩愈《符读书城南》“灯火稍可亲”' },
  seal: '灯',
  twist: '发光的南瓜灯被掌心一抹，变成挂着流苏的红灯笼',
  opening(stage) {
    return stage.mottle(2.3, 0.1, 0.01, 3);
  },
  build(stage, rng) {
    const acts = [];
    // ---- Picture A: the jack-o'-lantern ----
    acts.push(...grin(stage));
    acts.push(...eyesAndNose());
    acts.push(...pumpkin(stage));
    acts.push(...moonAndBats(stage, rng));
    // ---- Twist: palm smears the pumpkin, the globe returns as a lantern ----
    acts.push(...smear(stage));
    acts.push(...lantern(stage, rng));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 952, y: 470, size: 56, mode: 'carve', strength: 0.9, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 952, 790, { size: 60, seed: 11 }));
    return acts;
  },
};

// Shared globe: the pumpkin and the lantern sit on the same centre and meridians.
const CX = 540;
const CY = 885;
const P = { rx: 300, ry: 228 };
const L = { rx: 290, ry: 230, cy: 864 };
// Six grooves divide the visible face into seven lobes.
const MERIDIANS = [-5, -3, -1, 1, 3, 5].map((k) => Math.sin((k * Math.PI) / 14));

// Pumpkin silhouette: squat, slightly lobed, with the top pressed in around the stalk.
function pumpkinOutline(n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const lobe = 1 + 0.018 * Math.cos(7 * Math.asin(clamp(c, -1, 1)));
    let y = CY + P.ry * s * (s > 0 ? 0.97 : 1);
    if (s < 0) y += 34 * Math.exp(-((c / 0.22) ** 2));
    pts.push([CX + P.rx * c * lobe, y]);
  }
  return pts;
}

// Groove k of the pumpkin from the stalk dimple to the bottom.
function groove(a, rx, ry, cy, dimple = 34) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const v = -1 + (2 * i) / 24;
    const hw = rx * Math.pow(Math.max(0, 1 - v * v), 0.5);
    let y = cy + v * ry;
    if (v < 0) y += dimple * Math.exp(-(((1 + v) / 0.3) ** 2));
    pts.push([CX + a * hw, y]);
  }
  return pts;
}

// The jagged grin: a smile with triangular teeth, top teeth pointing down, bottom teeth up.
function grinPoly() {
  const top = (x) => 948 + 58 * (1 - ((x - CX) / 182) ** 2);
  const bot = (x) => 948 + 142 * (1 - ((x - CX) / 182) ** 2);
  const pts = [[352, 928]];
  const upper = [[392, 0], [440, 0], [470, 40], [500, 0], [580, 0], [610, 40], [640, 0], [688, 0]];
  for (const [x, dy] of upper) pts.push([x, top(x) + dy]);
  pts.push([728, 928]);
  const lower = [[690, 0], [662, -24], [634, 0], [566, 0], [540, -40], [514, 0], [446, 0], [418, -24], [390, 0]];
  for (const [x, dy] of lower) pts.push([x, bot(x) + dy]);
  return pts;
}

const EYES = [
  [[372, 862], [492, 872], [446, 772]],
  [[588, 872], [708, 862], [634, 772]],
];
const NOSE = [[512, 940], [568, 940], [540, 896]];

function grin() {
  const g = grinPoly();
  // The opening hook: one fast glowing stroke around the grin, then the mouth fills with light.
  return [
    K.carve([...g, g[0], g[1]], { width: 16, strength: 0.96, speed: 1300, rim: 0.35, taper: K.even, rest: 0.05 }),
    K.reveal((st) => st.mask(g, { feather: 0.7 }), { op: 'carve', strength: 0.97, order: 'left', duration: 0.9, jitter: 0.06, rest: 0.1 }),
  ];
}

function eyesAndNose() {
  const acts = [];
  for (const e of EYES) {
    acts.push(K.carve([...e, e[0], e[1]], { width: 12, strength: 0.95, speed: 900, rim: 0.3, taper: K.even, rest: 0.02 }));
    acts.push(K.reveal((st) => st.mask(e, { feather: 0.7 }), { op: 'carve', strength: 0.97, order: 'up', duration: 0.45, jitter: 0.05, rest: 0.05 }));
  }
  acts.push(K.reveal((st) => st.mask(NOSE, { feather: 0.7 }), { op: 'carve', strength: 0.95, order: 'up', duration: 0.4, jitter: 0.05, rest: 0.1 }));
  return acts;
}

// Lobe shading of a ribbed globe at virtual (x, y): 0 in the middle of a lobe, 1 at a groove.
function lobeShade(x, y, rx, ry, cy) {
  const v = clamp((y - cy) / ry, -0.999, 0.999);
  const hw = rx * Math.sqrt(1 - v * v);
  const th = Math.asin(clamp((x - CX) / hw, -1, 1));
  const s = (((th + Math.PI / 2) / (Math.PI / 7)) % 1 + 1) % 1;
  const r = Math.min(1, Math.hypot((x - CX) / rx, (y - cy) / ry));
  return { groove: Math.pow(1 - Math.sin(Math.PI * s), 2.2), rim: r * r * r, v };
}

function pumpkin(stage) {
  const s = stage.s;
  const outline = pumpkinOutline();
  const off = 11;
  const tex = stage.mottle(1, 0.08, 0.03, off);
  let face = null;
  // Body: warm orange lobes, darker grooves and rim, lit from inside around the face. The face
  // holes keep whatever the grin and eyes left there.
  const level = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const { groove, rim, v } = lobeShade(x, y, P.rx, P.ry, CY);
    const glow = Math.exp(-(((x - CX) / 230) ** 2) - (((y - 930) / 170) ** 2));
    const t = (0.86 + 0.8 * groove + 0.7 * rim + 0.2 * v) * (1 - 0.38 * glow) * tex(X, Y);
    const f = face.at(X, Y);
    const d = stage.field.d[Y * stage.field.w + X];
    return t + (d - t) * f;
  };
  const acts = [
    K.reveal(
      (st) => {
        face = st.mask([grinPoly(), ...EYES, NOSE], { feather: 0.9 });
        return st.mask(outline, { feather: 0.7, rough: 0.05, roughScale: 0.2 });
      },
      { op: 'set', level, order: 'out', duration: 2.6, jitter: 0.05, rest: 0.1 },
    ),
    // Dark contour and the six grooves, drawn in sand.
    K.pour(outline, { width: 9, amount: 1.6, speed: 1500, taper: K.even, scatter: 0.1, rest: 0.05 }),
  ];
  for (const a of MERIDIANS) {
    const g = groove(a, P.rx, P.ry, CY);
    acts.push(K.pour(g, { width: 7, amount: 1.2, speed: 1100, taper: K.taperBoth, scatter: 0.05, rest: 0.03 }));
  }
  // Rim light along the upper left and glossy highlights down the lobes.
  const rimPts = outline.slice(Math.round(outline.length * 0.52), Math.round(outline.length * 0.7));
  acts.push(K.carve(rimPts.map(([x, y]) => [x + (CX - x) * 0.025, y + (CY - y) * 0.03]), { width: 5, strength: 0.6, speed: 900, rim: 0.2, rest: 0.03 }));
  for (const a of [-0.45, -0.78, 0.04]) {
    const g = groove(a, P.rx * 0.97, P.ry * 0.92, CY);
    acts.push(K.carve(g.slice(4, 12), { width: 4, strength: 0.45, speed: 900, rim: 0.15, rest: 0.02 }));
  }
  // Curved stalk with a carved highlight.
  const stalk = spline([[522, 704], [526, 660], [540, 626], [566, 600], [592, 592]], 8);
  acts.push(K.pour(stalk, { width: 34, amount: 1.4, speed: 500, taper: (u) => 1 - 0.45 * u, scatter: 0.1, hard: 0.5, rest: 0.03 }));
  acts.push(K.carve(stalk.slice(2, -8).map(([x, y]) => [x - 7, y - 2]), { width: 4, strength: 0.55, speed: 500, rim: 0.1, rest: 0.05 }));
  return acts;
}

// A bat: body with ears and scalloped wings, span 2 * w, wings raised by `lift`.
function bat(x, y, w, lift = 0, tilt = 0) {
  const half = [
    [0.0, -0.1], [0.05, -0.3], [0.1, -0.12], [0.2, -0.14], [0.42, -0.3 - lift], [0.72, -0.42 - lift * 1.4], [1.0, -0.34 - lift * 1.8],
    [0.86, -0.14 - lift], [0.7, -0.1 - lift * 0.6], [0.6, 0.04 - lift * 0.4], [0.46, -0.02 - lift * 0.2], [0.34, 0.1], [0.2, 0.06], [0.1, 0.22], [0.0, 0.3],
  ];
  const pts = [...half, ...half.slice(1, -1).reverse().map(([u, v]) => [-u, v])];
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  return pts.map(([u, v]) => [x + (u * c - v * sn) * w, y + (u * sn + v * c) * w]);
}

const MOON = [206, 520, 104];
const BATS = [
  [226, 516, 84, 0.05, -0.12],
  [352, 452, 48, 0.3, 0.22],
  [104, 654, 38, -0.12, -0.3],
];

function moonAndBats(stage) {
  const [mx, my, mr] = MOON;
  const s = stage.s;
  const acts = [K.moon(stage, mx, my, mr, { duration: 1.4, halo: 1, glow: 0, strength: 0.94 })[0]];
  // Moonlit haze, kept off the pumpkin so its silhouette stays crisp.
  const haze = (st) =>
    K.radialMask(st, mx, my, mr * 0.98, mr * 2.7, 1.5).map((a, X, Y) => {
      const e = Math.hypot((X / s - CX) / P.rx, (Y / s - CY) / P.ry);
      return a * smoothstep(1.02, 1.14, e);
    });
  acts.push(K.reveal(haze, { op: 'carve', strength: 0.55, order: 'out', duration: 1, jitter: 0.08, rest: 0.1 }));
  for (const [x, y, w, lift, tilt] of BATS) {
    acts.push(K.reveal((st) => st.mask(bat(x, y, w, lift, tilt), { feather: 0.5 }), { op: 'set', level: 2.7, order: 'left', duration: 0.45, jitter: 0.03, rest: 0.25 }));
  }
  acts.push(K.wait(1.2));
  return acts;
}

// The palm smears the pumpkin in round strokes that follow the globe: the face goes first.
function smear(stage) {
  const s = stage.s;
  const inner = stage.mottle(1.7, 0.12, 0.02, 21);
  const night = stage.mottle(2.3, 0.1, 0.01, 3);
  const target = (X, Y) => {
    const e = Math.hypot((X / s - CX) / P.rx, (Y / s - CY) / P.ry);
    const k = smoothstep(0.92, 1.06, e);
    return inner(X, Y) * (1 - k) + night(X, Y) * k;
  };
  const acts = [];
  const strokes = [
    [[300, 960], [420, 1010], [540, 1030], [660, 1010], [790, 950]],
    [[800, 850], [680, 830], [540, 850], [400, 830], [280, 860]],
    [[290, 1060], [420, 1110], [560, 1110], [700, 1080], [800, 1020]],
    [[780, 760], [660, 720], [520, 730], [380, 750], [300, 790]],
  ];
  for (const [i, pts] of strokes.entries()) {
    acts.push(K.palm(spline(pts, 8), { width: 200, speed: 900, target, rate: 0.85, streak: stage.streaks[i % 3], hard: 0.35, rest: 0.05 }));
  }
  // One round pass wipes the old contour back into the night.
  const ring = [];
  for (let i = 0; i <= 60; i++) {
    const t = -Math.PI / 2 + (i / 60) * TAU * 1.04;
    ring.push([CX + (P.rx + 8) * Math.cos(t), CY + (P.ry + 8) * Math.sin(t)]);
  }
  acts.push(K.palm(ring, { width: 70, speed: 1500, target: stage.mottle(2.3, 0.1, 0.01, 3), rate: 0.9, hard: 0.4, rest: 0.05 }));
  // The stalk is swept off the top.
  acts.push(K.palm([[500, 720], [540, 640], [600, 580], [640, 560]], { width: 110, speed: 700, target: stage.mottle(2.3, 0.1, 0.01, 3), rate: 0.9, rest: 0.1 }));
  return acts;
}

function lanternOutline(n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    pts.push([CX + L.rx * Math.cos(t), L.cy + L.ry * Math.sin(t)]);
  }
  return pts;
}

function lantern(stage, rng) {
  const s = stage.s;
  const acts = [];
  const top = L.cy - L.ry;
  const bottom = L.cy + L.ry;
  const tex = stage.mottle(1, 0.06, 0.03, 31);
  // The lamp lights from the middle outward: bright core, warm body, deeper rim.
  const level = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const { groove, rim } = lobeShade(x, y, L.rx, L.ry, L.cy);
    const core = Math.exp(-(((x - CX) / 170) ** 2) - (((y - L.cy) / 150) ** 2));
    return (0.5 + 0.95 * rim + 0.25 * groove - 0.36 * core) * tex(X, Y);
  };
  acts.push(K.reveal((st) => st.mask(lanternOutline(), { feather: 0.9 }), { op: 'set', level, order: 'out', duration: 2.6, jitter: 0.04, rest: 0.1 }));
  // Ribs where the grooves were, and the frame's contour.
  for (const a of MERIDIANS) {
    acts.push(K.pour(groove(a, L.rx, L.ry, L.cy, 0), { width: 5, amount: 1.1, speed: 1300, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  }
  acts.push(K.pour(lanternOutline(), { width: 8, amount: 1.5, speed: 1600, taper: K.even, scatter: 0, rest: 0.05 }));
  // Gold caps top and bottom: dark lacquer bands with bright rims.
  for (const dir of [-1, 1]) {
    const edge = dir < 0 ? top + 12 : bottom - 12;
    const outer = edge + dir * 40;
    const cap = [[CX - 132, edge], [CX - 118, edge + dir * 22], [CX - 104, outer], [CX + 104, outer], [CX + 118, edge + dir * 22], [CX + 132, edge]];
    acts.push(K.reveal((st) => st.mask(cap, { feather: 0.6 }), { op: 'set', level: 2.6, order: 'left', duration: 0.5, jitter: 0.02, rest: 0.03 }));
    acts.push(K.carve([[CX - 124, edge + dir * 20], [CX + 124, edge + dir * 20]], { width: 5, strength: 0.88, speed: 900, rim: 0.2, taper: K.even, rest: 0.02 }));
    acts.push(K.carve([[CX + 100, outer - dir * 6], [CX - 100, outer - dir * 6]], { width: 4, strength: 0.8, speed: 900, rim: 0.2, taper: K.even, rest: 0.02 }));
  }
  const capTop = top + 12 - 40;
  const capBottom = bottom - 12 + 40;
  // Hanging cord from the top of the frame, with a small ring.
  acts.push(K.carve([[CX, -10], [CX, capTop - 32]], { width: 5, strength: 0.8, speed: 1400, rim: 0.2, taper: K.even, rest: 0.02 }));
  acts.push(K.carve(ellipse(CX, capTop - 18, 13, 15, 0, 20), { width: 5, strength: 0.85, speed: 500, rim: 0.2, taper: K.even, rest: 0.02 }));
  acts.push(K.carve([[CX, capTop - 3], [CX, capTop]], { width: 5, strength: 0.8, speed: 200, taper: K.even, rest: 0.02 }));
  // Tassel: a knot bead, a wrapped band and a fall of fine threads.
  const t0 = capBottom;
  acts.push(K.carve([[CX, t0], [CX, t0 + 14]], { width: 5, strength: 0.85, speed: 400, taper: K.even, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(ellipse(CX, t0 + 26, 14, 14, 0, 20), { feather: 0.5 }), { op: 'carve', strength: 0.9, order: 'down', duration: 0.25, rest: 0.02 }));
  const tb = t0 + 42;
  acts.push(K.reveal((st) => st.mask([[CX - 18, tb], [CX + 18, tb], [CX + 20, tb + 22], [CX - 20, tb + 22]], { feather: 0.5 }), { op: 'carve', strength: 0.88, order: 'down', duration: 0.25, rest: 0.02 }));
  acts.push(K.pour([[CX - 22, tb + 11], [CX + 22, tb + 11]], { width: 3, amount: 1.4, speed: 400, taper: K.even, rest: 0.01 }));
  const threads = 19;
  for (let i = 0; i < threads; i++) {
    const u = (i / (threads - 1)) * 2 - 1;
    const x0 = CX + u * 18;
    const len = 128 + rng.float(-8, 8) - 16 * u * u;
    const sway = rng.float(-4, 4);
    acts.push(K.carve([[x0, tb + 22], [x0 + u * 8 + sway * 0.5, tb + 22 + len * 0.5], [x0 + u * 16 + sway, tb + 22 + len]], { width: 3.4, strength: 0.84, speed: 900, rim: 0.1, taper: K.taperEnd, rest: 0.01 }));
  }
  // Warm light spilling from the lantern onto the night around it.
  const halo = (st) =>
    K.radialMask(st, CX, L.cy, L.rx * 0.9, L.rx * 1.5, 2.4).map((a, X, Y) => {
      const e = Math.hypot((X / s - CX) / L.rx, (Y / s - L.cy) / L.ry);
      return a * smoothstep(1.02, 1.12, e) * (Math.abs(X / s - CX) < 130 ? 0.3 : 1);
    });
  acts.push(K.reveal(halo, { op: 'carve', strength: 0.22, order: 'out', duration: 1.2, jitter: 0.08, rest: 0.4 }));
  return acts;
}
