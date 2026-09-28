import { spline, ellipse, measure, pointAt, clamp, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 松鹤延年 — a pair of chopsticks on a little rest and a steaming bowl of rice, drawn in light on
// the dark table. The chopsticks tilt up on their rest and stand as a pair of long legs under the
// bowl; the palm melts the bowl into a soft mist and it comes back as the body of a red-crowned
// crane, the curl of steam as its neck. The red crown (丹顶) is the last touch. Portrait
// 1080x1920, hook-test variant A (the finished crane flashes first, below the hook caption).

// ---- Picture A: a bowl of rice, chopsticks on a rest ----
const BX = 578;
const RIM = 912;
const RIM_RX = 226;
const RIM_RY = 44;
const FOOT = 1150;
// The chopsticks turn on their rest: the tips stay put and become the crane's feet.
const PIVOT = [598, 1370];
const STICK_L = 500;
const LYING = (176 * Math.PI) / 180;
const STANDING = (268 * Math.PI) / 180;
// Steam curling up from the rice: the left wisp is where the crane's neck will rise.
const WISPS = [
  [[432, 838], [398, 790], [368, 738], [374, 690], [356, 640]],
  [[584, 812], [610, 760], [578, 708], [600, 656]],
  [[716, 838], [746, 788], [720, 740], [744, 694]],
];

// ---- Picture B: the crane, facing left ----
const BODY = [[438, 900], [520, 887], [620, 893], [705, 912], [768, 942], [790, 990], [760, 1030], [690, 1058], [610, 1074], [530, 1072], [464, 1052], [414, 1014], [392, 966], [404, 926]];
// The folded wing: along the back above, the wing line below.
const WING = [[442, 904], [520, 891], [620, 897], [705, 916], [768, 946], [790, 992], [740, 1028], [650, 1036], [566, 1022], [500, 994], [462, 958], [448, 928]];
const NECK = [[424, 936], [396, 886], [368, 830], [356, 776], [366, 734], [382, 704]];
const HEAD = { x: 350, y: 688, ang: Math.PI - 0.14, k: 1.3 };
// The black tertials: a soft bundle of long plumes over the tail, ending in a fringe of tips.
const BUSTLE = [[610, 906], [680, 902], [748, 916], [800, 944], [836, 984], [852, 1030], [856, 1074], [842, 1084], [846, 1118], [822, 1112], [818, 1146], [796, 1128], [786, 1160], [766, 1134], [752, 1156], [738, 1122], [720, 1136], [716, 1100], [704, 1052], [690, 1004], [668, 958], [640, 924]];
const PLUMES = [
  [[690, 918], [770, 950], [822, 1010], [842, 1084]],
  [[680, 934], [756, 975], [800, 1040], [822, 1112]],
  [[672, 952], [738, 1000], [776, 1066], [796, 1128]],
  [[668, 972], [720, 1030], [750, 1090], [766, 1134]],
  [[670, 996], [706, 1056], [738, 1122]],
];

export default {
  id: 'chopsticks',
  variant: 'A',
  hook: { en: 'Chopsticks → CRANE', lines: ['Chopsticks →', 'CRANE'], cn: '一双筷子，一只仙鹤' },
  trend: 'Chinamaxxing (chopsticks and Chinese dining)',
  accent: '丹顶 (the crane’s red crown)',
  music: 'pine',
  title: { cn: '筷子变鹤', en: 'Chopsticks to Crane' },
  theme: '中式餐桌 · Chinamaxxing 热点',
  description: '光台上先画出一碗冒着热气的米饭和搁在筷架上的一双筷子，筷子在筷架上立起来成了鹤腿，掌心一抹，碗化作鹤身，热气化作鹤颈，一只丹顶鹤亭亭而立。',
  payoff: { en: 'Eat well. Live long.', cn: '好好吃饭，松鹤延年' },
  inscription: { columns: ['松鹤延年'], note: '吉语：松与鹤皆寓长寿' },
  seal: '鹤',
  twist: '搁在筷架上的一双筷子立了起来，成了丹顶鹤的两条长腿，一碗米饭被掌心一抹，成了鹤身',
  build(stage, rng) {
    const acts = [];
    const night = stage.mottle(2.6, 0.1, 0.01, 3);
    const mist = mistLevel(stage, night);
    // Picture A: the chopsticks first (the opening stroke), then the bowl, the rice and its steam.
    acts.push(...chopsticks(stage));
    acts.push(...bowl(stage));
    acts.push(...rice(stage, rng));
    acts.push(...bowlLines());
    acts.push(...steam());
    const seen = K.wait(0.5);
    seen.mark = 'A';
    acts.push(seen);
    // The twist: the chopsticks tilt up on their rest and stand under the bowl as two legs...
    acts.push(...tilt(stage, night));
    // ...the palm melts the bowl and its steam into mist, and the crane rises out of it.
    acts.push(...smear(stage, mist));
    acts.push(...crane(stage, night));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 624, size: 56, mode: 'carve', strength: 0.9, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 950, 946, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// ---------- helpers ----------

// A measured centre line with unit tangent and normal (left of travel).
function track(ctrl, segs = 10) {
  const pts = spline(ctrl, segs);
  const m = measure(pts);
  const at = (u) => {
    const [x, y, tx, ty] = pointAt(m, clamp(u, 0, 1) * m.length);
    return { x, y, tx, ty, nx: ty, ny: -tx };
  };
  const off = (u, v) => {
    const p = at(u);
    return [p.x + p.nx * v, p.y + p.ny * v];
  };
  return { pts, len: m.length, at, off };
}

// Tapered ribbon around a polyline, width w(u) along it.
function ribbon(pts, w) {
  const n = pts.length;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const hw = w(i / (n - 1)) / 2;
    L.push([pts[i][0] - ((y1 - y0) / len) * hw, pts[i][1] + ((x1 - x0) / len) * hw]);
    R.push([pts[i][0] + ((y1 - y0) / len) * hw, pts[i][1] - ((x1 - x0) / len) * hw]);
  }
  return [...L, ...R.reverse()];
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Polygons in one mask fill by the nonzero rule, so overlapping parts must turn the same way.
function solid(polys) {
  return polys.map((poly) => {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      a += x0 * y1 - x1 * y0;
    }
    return a < 0 ? poly.slice().reverse() : poly;
  });
}

// ---------- picture A ----------

// The pair of chopsticks turned to angle `th` (from the tips toward the handles) on the rest.
function pair(th, { L = STICK_L, sep = 22 } = {}) {
  const [px, py] = PIVOT;
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  return [-1, 1].map((k) => {
    const ox = -uy * k * (sep / 2);
    const oy = ux * k * (sep / 2);
    return { tip: [px - ux * 26 + ox, py - uy * 26 + oy], end: [px + ux * L + ox, py + uy * L + oy], w: 21 - k * 0.5 };
  });
}

// Chopstick profile: square handle for the first third, then tapering to a slim round tip.
const stickTaper = (u) => (u < 0.34 ? 1 : 1 - 0.55 * smoothstep(0.34, 1, u));
const stickPoly = (c, grow = 1) => ribbon([c.end, lerp(c.end, c.tip, 0.34), lerp(c.end, c.tip, 0.67), c.tip], (u) => c.w * grow * stickTaper(u));
const stickStroke = (c, rest = 0.03, speed = 1500) => K.carve([c.end, c.tip], { width: c.w, strength: 0.97, speed, rim: 0.35, hard: 0.6, taper: stickTaper, rest });

function chopsticks(stage) {
  const acts = [];
  const sticks = pair(LYING);
  // The opening hook: two fast glowing strokes, handle to tip.
  for (const [i, c] of sticks.entries()) acts.push(stickStroke(c, i ? 0.06 : 0.03));
  acts[0].mark = 'open';
  // Lacquered handles: a warm band between dark rings, and a ring near the end.
  const across = (c, t, h, w) => {
    const [x, y] = lerp(c.end, c.tip, t);
    const dx = c.tip[0] - c.end[0];
    const dy = c.tip[1] - c.end[1];
    const l = Math.hypot(dx, dy);
    const [ux, uy] = [dx / l, dy / l];
    const [nx, ny] = [-uy, ux];
    return [[x - nx * h - ux * w, y - ny * h - uy * w], [x - nx * h + ux * w, y - ny * h + uy * w], [x + nx * h + ux * w, y + ny * h + uy * w], [x + nx * h - ux * w, y + ny * h - uy * w]];
  };
  const lacquer = sticks.map((c) => across(c, 0.17, c.w * 0.45, 58));
  const rings = sticks.flatMap((c) => [across(c, 0.035, c.w * 0.55, 3), across(c, 0.064, c.w * 0.55, 2), across(c, 0.27, c.w * 0.55, 3)]);
  acts.push(K.reveal((st) => st.mask(lacquer, { feather: 0.8 }), { op: 'set', level: 0.62, order: 'left', duration: 0.3, jitter: 0.02, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(rings, { feather: 0.5 }), { op: 'add', amount: 1.3, order: 'left', duration: 0.2, jitter: 0.02, rest: 0.02 }));
  // The little porcelain rest under the tips, lit, with a dark shadow beneath.
  acts.push(
    K.reveal(
      (st) => {
        const over = st.mask(sticks.map((c) => stickPoly(c, 1.25)), { feather: 0.8 });
        return st.mask(restPoly(), { feather: 0.8 }).map((a, X, Y) => a * (1 - over.at(X, Y)));
      },
      { op: 'set', level: 0.45, order: 'left', duration: 0.3, jitter: 0.02, rest: 0.01 },
    ),
  );
  const [rx, ry] = PIVOT;
  acts.push(K.pour(spline([[rx - 52, ry + 20], [rx, ry + 28], [rx + 52, ry + 20]], 6), { width: 7, amount: 1.4, speed: 900, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  return acts;
}

function restPoly() {
  const [rx, ry] = PIVOT;
  const y = ry + 4;
  return spline([[rx - 50, y + 12], [rx - 54, y - 4], [rx - 40, y - 18], [rx - 18, y - 12], [rx, y - 9], [rx + 18, y - 12], [rx + 40, y - 18], [rx + 54, y - 4], [rx + 50, y + 12], [rx + 28, y + 20], [rx - 28, y + 20]], 5, true);
}

// The bowl's belly, from the right end of the rim round the bottom to the left end.
function bellyCurve() {
  return spline([[BX + RIM_RX, RIM], [BX + RIM_RX - 12, RIM + 70], [BX + 170, RIM + 150], [BX + 96, RIM + 198], [BX, RIM + 212], [BX - 96, RIM + 198], [BX - 170, RIM + 150], [BX - RIM_RX + 12, RIM + 70], [BX - RIM_RX, RIM]], 8);
}

// Front half of the rim ellipse, left end to right end, `dy` lower.
function frontRim(dy = 0, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([BX + RIM_RX * Math.cos(a), RIM + dy + RIM_RY * Math.sin(a)]);
  }
  return pts;
}

function bowl(stage) {
  const s = stage.s;
  const tex = stage.mottle(1, 0.07, 0.03, 41);
  // Porcelain glowing through, brightest on the left, rounded toward the edges.
  const level = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const u = (x - BX) / RIM_RX;
    const v = (y - RIM) / 212;
    const round = Math.pow(Math.abs(u), 3) * 0.55 + 0.3 * smoothstep(0.55, 1, v);
    const hi = Math.exp(-(((x - (BX - 118)) / 40) ** 2) - (((y - RIM - 92) / 70) ** 2));
    return (0.2 + round + 0.12 * (u > 0 ? u : 0) - 0.16 * hi) * tex(X, Y);
  };
  const poly = [...frontRim(), ...bellyCurve().slice(1, -1)];
  return [K.reveal((st) => st.mask(poly, { feather: 0.8 }), { op: 'set', level, order: 'down', duration: 0.8, jitter: 0.03, rest: 0.02 })];
}

// Lip, outline, foot and the blue-and-white band, drawn over the belly and the rice.
function bowlLines() {
  const acts = [];
  acts.push(K.carve(frontRim(), { width: 10, strength: 0.96, speed: 1800, rim: 0.3, taper: K.even, rest: 0.02 }));
  acts.push(K.pour(bellyCurve(), { width: 5, amount: 1.1, speed: 2000, taper: K.even, scatter: 0, rest: 0.02 }));
  const foot = [[BX - 92, RIM + 204], [BX + 92, RIM + 204], [BX + 100, FOOT], [BX - 100, FOOT]];
  acts.push(K.reveal((st) => st.mask(foot, { feather: 0.6 }), { op: 'set', level: 0.5, order: 'left', duration: 0.2, rest: 0.01 }));
  // The band under the rim: two rules with a running wave between them, and the foot's shadow.
  const along = (dy, amp = 0) => frontRim(dy, 60).map(([x, y], i) => [BX + (x - BX) * (1 - dy / 900), y + amp * Math.sin(i * 0.57)]);
  const lines = [ribbon(along(22), () => 3.5), ribbon(along(40, 5), () => 3), ribbon(along(58), () => 3.5), ribbon([[BX - 100, FOOT], [BX + 100, FOOT]], () => 6)];
  acts.push(K.reveal((st) => st.mask(lines, { feather: 0.5 }), { op: 'add', amount: 1.2, order: 'left', duration: 0.4, jitter: 0.02, rest: 0.02 }));
  return acts;
}

// A heaped mound of rice above the rim, grain by grain.
function ricePoly() {
  return spline([[BX - RIM_RX + 8, RIM + 4], [BX - 196, RIM - 36], [BX - 130, RIM - 78], [BX - 50, RIM - 98], [BX + 40, RIM - 100], [BX + 124, RIM - 80], [BX + 190, RIM - 40], [BX + RIM_RX - 8, RIM + 4], [BX, RIM + RIM_RY - 6]], 8, true);
}

function rice(stage, rng) {
  const s = stage.s;
  const poly = ricePoly();
  const level = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const v = clamp((y - (RIM - 100)) / 140, 0, 1);
    return 0.08 + 0.26 * v * v + 0.1 * Math.pow(Math.abs(x - BX) / RIM_RX, 3);
  };
  // Grains: a small shaded crescent under each grain, packed over the mound.
  const grains = [];
  for (let i = 0; i < 150; i++) {
    const x = rng.float(BX - 205, BX + 205);
    const top = RIM - 96 * Math.sqrt(Math.max(0, 1 - ((x - BX) / 215) ** 2));
    const y = rng.float(top + 8, RIM + 30);
    const a = rng.float(-0.9, 0.9);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const g = [];
    for (let k = 0; k <= 8; k++) {
      const t = Math.PI * (k / 8);
      g.push([x + 9 * Math.cos(t) * c - 4.5 * Math.sin(t) * sn, y + 9 * Math.cos(t) * sn + 4.5 * Math.sin(t) * c]);
    }
    for (let k = 8; k >= 0; k--) {
      const t = Math.PI * (k / 8);
      g.push([x + 8 * Math.cos(t) * c - 2.5 * Math.sin(t) * sn, y + 8 * Math.cos(t) * sn + 2.5 * Math.sin(t) * c]);
    }
    grains.push(g);
  }
  return [
    K.reveal((st) => st.mask(poly, { feather: 1 }), { op: 'set', level, order: 'up', duration: 0.7, jitter: 0.05, rest: 0.02 }),
    K.reveal(
      (st) => {
        const inside = st.mask(poly);
        return st.mask(solid(grains), { feather: 0.4 }).map((a, X, Y) => a * inside.at(X, Y));
      },
      { op: 'add', amount: 0.55, order: 'up', duration: 0.5, jitter: 0.1, rest: 0.02 },
    ),
  ];
}

function steam() {
  return WISPS.map((w, i) => K.carve(spline(w, 10), { width: i ? 26 : 32, strength: 0.86, speed: 560, rim: 0.08, hard: 0.2, taper: (u) => 1 - 0.72 * u, rest: 0.03 }));
}

// ---------- twist ----------

// The chopsticks tilt up on their rest in three quick redraws, each old pose wiped by the palm,
// and stand as a pair of legs under the bowl.
function tilt(stage, night) {
  const acts = [];
  // The palm wipes a pose back to the table, leaving the rest as it was.
  const restM = stage.mask(restPoly(), { feather: 0.8 });
  const table = (X, Y) => {
    const a = restM.at(X, Y);
    return night(X, Y) * (1 - a) + 0.45 * a;
  };
  const wipe = (th, sep, speed = 2200) => {
    const [a, b] = pair(th, { sep });
    const mid = [lerp(a.end, b.end, 0.5), lerp(a.tip, b.tip, 0.5)];
    return K.palm(mid, { width: 74, speed, target: table, rate: 0.98, hard: 0.55, rest: 0.01 });
  };
  const first = wipe(LYING, 22);
  first.mark = 'twist';
  acts.push(first);
  const steps = [[205, 24], [230, 28]];
  for (const [deg, sep] of steps) {
    const th = (deg * Math.PI) / 180;
    for (const c of pair(th, { sep })) acts.push(stickStroke(c, 0.01, 2600));
    acts.push(K.wait(0.2));
    acts.push(wipe(th, sep, 2600));
  }
  // Standing: drawn up from the rest, tip first, until they meet the bottom of the bowl.
  for (const c of pair(STANDING, { sep: 40, L: 236 })) {
    const a = K.carve([c.tip, c.end], { width: 17, strength: 0.96, speed: 900, rim: 0.3, hard: 0.6, taper: (u) => 0.55 + 0.45 * u, rest: 0.02 });
    acts.push(a);
  }
  acts[acts.length - 2].mark = 'legs';
  acts.push(K.wait(0.4));
  return acts;
}

// Where the mist glows after the smear: close round the body, and faintly up the neck.
function mistLevel(stage, night) {
  const s = stage.s;
  const neck = track(NECK);
  const samples = [];
  for (let i = 0; i <= 30; i++) samples.push(neck.at(i / 30));
  samples.push({ x: HEAD.x, y: HEAD.y });
  return (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const e = Math.hypot((x - 596) / 290, (y - 985) / 200);
    let g = 1 - smoothstep(0.5, 1.1, e);
    let dn = Infinity;
    for (const p of samples) dn = Math.min(dn, Math.hypot(x - p.x, y - p.y));
    g = Math.max(g, 0.7 * (1 - smoothstep(24, 120, dn)));
    return night(X, Y) * (1 - 0.4 * g);
  };
}

function smear(stage, mist) {
  const acts = [];
  // Round passes over the bowl and the rice, following their curve; the legs are left standing.
  const strokes = [
    [[320, 1000], [440, 1070], [580, 1090], [720, 1070], [840, 996]],
    [[840, 890], [720, 840], [580, 824], [440, 846], [320, 906]],
    [[330, 960], [460, 990], [590, 1000], [720, 985], [850, 940]],
  ];
  for (const [i, pts] of strokes.entries()) {
    acts.push(K.palm(spline(pts, 8), { width: 200, speed: 1300, target: mist, rate: 0.9, streak: stage.streaks[i % 3], hard: 0.35, rest: 0.03 }));
  }
  acts[0].mark = 'melt';
  // The foot of the bowl.
  acts.push(K.palm([[460, 1134], [700, 1134]], { width: 60, speed: 1300, target: mist, rate: 0.9, hard: 0.4, rest: 0.02 }));
  // The steam is drawn up into one soft column of mist along the neck.
  for (const w of WISPS) acts.push(K.palm(spline(w, 8), { width: 110, speed: 1300, target: mist, rate: 0.97, hard: 0.35, rest: 0.02 }));
  return acts;
}

// ---------- the crane ----------

function crane(stage, night) {
  const s = stage.s;
  const acts = [];
  const neck = track(NECK);
  // The body where the bowl was: a white breast and back, the flank shaded toward the belly,
  // and the folded wing a shade warmer so its feathers can be carved into it.
  const body = spline(BODY, 8, true);
  const tex = stage.mottle(1, 0.06, 0.03, 53);
  let wingMask = null;
  const bodyLevel = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const v = (y - 888) / 186;
    const u = (x - 590) / 200;
    const flank = 0.07 + 0.42 * smoothstep(0.45, 1.05, v) + 0.12 * Math.pow(Math.abs(u), 4);
    const w = wingMask.at(X, Y);
    return (flank * (1 - w) + (0.2 + 0.06 * u) * w) * tex(X, Y);
  };
  const b = K.reveal(
    (st) => {
      wingMask = st.mask(spline(WING, 6, true), { feather: 1.2 });
      return st.mask(body, { feather: 1.2, rough: 0.2, roughScale: 0.25 });
    },
    { op: 'set', level: bodyLevel, order: 'out', duration: 0.9, jitter: 0.04, rest: 0.02 },
  );
  b.mark = 'crane';
  acts.push(b);
  // The legs run on up into the body.
  for (const c of pair(STANDING, { sep: 40, L: 390 })) {
    const from = lerp(c.tip, c.end, 0.42);
    acts.push(K.carve([from, lerp(c.tip, c.end, 0.8)], { width: 17, strength: 0.96, speed: 1200, rim: 0.3, hard: 0.6, taper: (u) => 0.8 + 0.2 * u, rest: 0.01 }));
  }
  // Neck: rises out of the body along the curl of steam, white, into the head.
  const R = (u) => 25 - 11 * smoothstep(0, 1, u);
  const neckPoly = [];
  for (let i = 0; i <= 40; i++) neckPoly.push(neck.off(i / 40, R(i / 40)));
  for (let i = 40; i >= 0; i--) neckPoly.push(neck.off(i / 40, -R(i / 40)));
  acts.push(K.reveal((st) => st.mask(neckPoly, { feather: 0.8 }), { op: 'set', level: 0.07, order: (X, Y) => -Y, duration: 0.5, jitter: 0.02, rest: 0.02 }));
  const { x: hx, y: hy, ang, k } = HEAD;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const H = (pts) => pts.map(([a, bb]) => [hx + (a * c + bb * sn) * k, hy + (a * sn - bb * c) * k]);
  const skull = spline([[-34, 2], [-30, -14], [-12, -22], [10, -22], [26, -14], [36, -4], [38, 6], [26, 16], [6, 21], [-16, 20], [-30, 12]], 6, true);
  acts.push(K.reveal((st) => st.mask(H(skull), { feather: 0.6 }), { op: 'set', level: 0.07, order: 'right', duration: 0.25, rest: 0.02 }));
  // Bill: long, straight and pointed, with the line of the gape.
  const bill = [[34, -8], [80, -5], [128, 0], [166, 5], [128, 7], [80, 9], [36, 10]];
  acts.push(K.reveal((st) => st.mask(H(bill), { feather: 0.5 }), { op: 'set', level: 0.24, order: 'right', duration: 0.25, rest: 0.01 }));
  // The wing line, then feathers carved into the wing: rows of coverts at the shoulder, long
  // secondaries sweeping back under the tertials. Each edge is lit, with a shadow under it.
  acts.push(K.pour(spline([[450, 940], [484, 982], [550, 1016], [640, 1036], [730, 1030], [790, 996]], 8), { width: 6, amount: 1.1, speed: 1500, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  const edges = [];
  for (const [y0, x0, x1, r] of [[920, 486, 630, 15], [946, 500, 660, 17], [974, 522, 690, 19]]) {
    for (let x = x0; x <= x1; x += r * 2.1) {
      const y = y0 + (x - x0) * 0.08;
      const pts = [];
      for (let q = 0; q <= 8; q++) {
        const t = -0.35 + 1.9 * (q / 8);
        pts.push([x + r * Math.cos(t), y + r * 0.62 * Math.sin(t)]);
      }
      edges.push(pts);
    }
  }
  for (let q = 0; q < 4; q++) {
    const x = 556 + q * 40;
    const y = 1000 + q * 2;
    edges.push(spline([[x, y], [x + 60, y + 11], [x + 120, y + 8 - q * 3]], 6));
  }
  // Fainter contour feathers round the breast and flank.
  const soft = [];
  for (const [x, y, r] of [[418, 972, 13], [432, 1004, 14], [462, 1030, 15], [500, 1048, 15], [446, 944, 12], [540, 1058, 14], [584, 1062, 13]]) {
    const pts = [];
    for (let q = 0; q <= 8; q++) {
      const t = 0.2 + 1.5 * (q / 8);
      pts.push([x + r * Math.cos(t), y + r * 0.6 * Math.sin(t)]);
    }
    soft.push(pts);
  }
  const lit = edges.map((e) => ribbon(e, (u) => 1 + 2.6 * Math.sin(Math.PI * u)));
  const shade = edges.map((e) => ribbon(e.map(([x, y]) => [x + 1, y + 3.2]), (u) => 1 + 2.4 * Math.sin(Math.PI * u)));
  acts.push(K.reveal((st) => st.mask(solid(shade), { feather: 0.5 }), { op: 'add', amount: 0.3, order: 'left', duration: 0.3, jitter: 0.02, rest: 0 }));
  acts.push(K.reveal((st) => st.mask(solid(lit), { feather: 0.4 }), { op: 'carve', strength: 0.9, order: 'left', duration: 0.45, jitter: 0.02, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(solid(soft.map((e) => ribbon(e.map(([x, y]) => [x + 1, y + 3]), (u) => 0.8 + 2 * Math.sin(Math.PI * u)))), { feather: 0.6 }), { op: 'add', amount: 0.3, order: 'left', duration: 0.25, jitter: 0.02, rest: 0.02 }));
  // The black tertials fall over the tail like a bustle, soft and ragged, with pale strands.
  acts.push(K.reveal((st) => st.mask(spline(BUSTLE, 5, true), { feather: 1, rough: 0.35, roughScale: 0.5 }), { op: 'set', level: stage.mottle(2.9, 0.08, 0.03, 7), order: 'down', duration: 0.7, jitter: 0.04, rest: 0.02 }));
  const strands = PLUMES.map((p) => ribbon(spline(p, 8), (u) => 1 + 2.4 * Math.sin(Math.PI * Math.min(1, u * 1.15))));
  acts.push(K.reveal((st) => st.mask(solid(strands), { feather: 0.5 }), { op: 'carve', strength: 0.45, order: 'down', duration: 0.3, jitter: 0.02, rest: 0.02 }));
  // The black throat and fore-neck, leaving the white nape; the black face and chin.
  const front = [];
  const back = [];
  for (let i = 0; i <= 40; i++) front.push(neck.off(0.26 + (0.74 * i) / 40, R(0.26 + (0.74 * i) / 40) + 1.5));
  for (let i = 40; i >= 0; i--) {
    const u = 0.42 + (0.58 * i) / 40;
    back.push(neck.off(u, R(u) * (-0.5 + 0.55 * smoothstep(0.72, 1, u))));
  }
  const face = spline([[2, -12], [24, -13], [37, -4], [39, 7], [26, 17], [6, 24], [-10, 28], [-22, 30], [-28, 22], [-22, 12], [-12, 6], [-2, 0]], 6, true);
  acts.push(K.reveal((st) => st.mask(solid([[...front, ...back], H(face)]), { feather: 0.7 }), { op: 'set', level: 2.9, order: (X, Y) => -Y, duration: 0.45, jitter: 0.02, rest: 0.02 }));
  acts.push(K.pour(H([[38, 3], [150, 5]]), { width: 2, amount: 0.9, speed: 800, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
  // Eye: a small glint in the black face.
  acts.push(K.reveal((st) => st.mask(H(ellipse(8, -5, 4.5, 4.5, 0, 12)), { feather: 0.4 }), { op: 'set', level: 0.3, order: 'out', duration: 0.15, rest: 0.03 }));
  // The rest is smoothed away into the shallows: toes and ripples round the feet.
  acts.push(K.palm([[520, 1378], [690, 1378]], { width: 64, speed: 1200, target: night, rate: 0.95, hard: 0.5, rest: 0.01 }));
  const toes = [];
  for (const cst of pair(STANDING, { sep: 40 })) {
    const [fx, fy] = [cst.tip[0], cst.tip[1] + 4];
    for (const [dx, dy] of [[-50, 6], [-38, 12], [-20, 14], [16, 2]]) toes.push(ribbon([[fx, fy], [fx + dx * 0.6, fy + dy * 0.5], [fx + dx, fy + dy]], (u) => 6.5 - 4 * u));
  }
  const ripples = [[420, 530, 1402], [660, 790, 1400], [476, 566, 1415], [626, 724, 1413]].map(([x0, x1, y]) => ribbon(spline([[x0, y], [(x0 + x1) / 2, y + 2], [x1, y]], 6), (u) => 1 + 3 * Math.sin(Math.PI * u)));
  // One even pass down both legs, slim at the feet, with the joint halfway.
  const legs = pair(STANDING, { sep: 40, L: 390 }).map((cst) => ribbon([cst.tip, lerp(cst.tip, cst.end, 0.4), lerp(cst.tip, cst.end, 0.8)], (u) => 9.5 + 5 * u + 3.5 * Math.exp(-(((u - 0.52) / 0.05) ** 2))));
  acts.push(K.reveal((st) => st.mask(legs, { feather: 0.7 }), { op: 'set', level: 0.05, order: 'up', duration: 0.3, jitter: 0.01, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(solid(toes), { feather: 0.5 }), { op: 'carve', strength: 0.93, order: 'out', duration: 0.2, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(ripples, { feather: 0.6 }), { op: 'carve', strength: 0.55, order: 'out', duration: 0.25, rest: 0.02 }));
  // 丹顶: the red crown on top of the head, the last touch.
  const crown = spline([[-16, -19], [-8, -30], [8, -34], [24, -29], [30, -18], [16, -14], [0, -15]], 5, true);
  acts.push(K.tint(stage, [H(crown)], { fadeIn: 0.6, feather: 1 }));
  const cr = K.reveal((st) => st.mask(H(crown), { feather: 0.6 }), { op: 'set', level: 0.1, order: 'out', duration: 0.35, rest: 0.05 });
  cr.mark = 'crown';
  acts.push(cr);
  return acts;
}
