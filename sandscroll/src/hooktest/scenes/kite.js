import { spline, ellipse, clamp, smoothstep, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 纸鸢化凤 — a guessing reel for the Double Ninth (重阳, 18 Oct 2026), the day people climb
// heights and fly kites. A Beijing swallow kite (沙燕) flies on its string high over a line of
// low hills. The palm brushes its wings and they feather, fanning open from the spar; then head
// and chest melt into a crested neck and a vermilion body, the forked tail streams out into long
// plumes and the string becomes the middle one: the Vermilion Bird (朱雀). Portrait 1080x1920.
const CX = 480;
const NIGHT = [2.6, 0.1, 0.01, 3];

export default {
  id: 'kite',
  variant: 'B',
  hookMark: 'feathers',
  hookOffset: 0.15,
  guess: true,
  cover: { mark: 'kite-half', offset: 0 },
  hook: { en: 'Guess what this kite becomes', lines: ['Guess what this', 'KITE BECOMES'], cn: '猜猜风筝变成什么' },
  trend: 'Double Ninth Festival (重阳节, 18 Oct 2026: kite flying and climbing heights are its customs) × TikTok’s “guess the drawing” format',
  accent: '朱雀 (the phoenix: body, head and crest, and the eyes of its tail plumes)',
  music: 'voyage',
  title: { cn: '纸鸢化凤', en: 'Kite to Phoenix' },
  theme: '节日 · 重阳（10 月 18 日）放风筝 × 猜画',
  description: '远山之上一只北京沙燕风筝迎风高飞，掌心一抹，燕翅展开成翎羽、剪尾化作长长的尾羽、风筝线变成中间那根尾翎，朱红的凤凰振翅而起。',
  payoff: { en: 'It was always meant to fly.', cn: '它本来就会飞' },
  inscription: { columns: ['凤鸣朝阳'], note: '典出《诗经·大雅·卷阿》“凤皇鸣矣，于彼高冈。梧桐生矣，于彼朝阳”' },
  seal: '朱雀',
  twist: '高飞的沙燕风筝被掌心一抹，燕翅生翎、剪尾化羽，变成朱红的凤凰',
  build(stage) {
    const acts = [];
    // ---- Picture A: the swallow kite, the hills and the string ----
    acts.push(...kite(stage));
    acts.push(...hills(stage));
    acts.push(...string());
    acts.push(K.wait(0.5));
    // ---- Twist: the wings feather, then the rest of the kite becomes the phoenix ----
    acts.push(...wingsSprout(stage));
    acts.push(...melt(stage));
    acts.push(...bodyAndHead(stage));
    acts.push(...wingsFinish(stage));
    acts.push(...tail(stage));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 640, size: 56, mode: 'carve', strength: 0.9, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 950, 936, { size: 58, seed: 17 }));
    return acts;
  },
};

// ---------------------------------------------------------------- helpers

const mirror = (pts) => pts.map(([x, y]) => [2 * CX - x, y]);
const same = (pts) => pts;

// Masks fill polygon lists with the nonzero rule, so overlapping shapes must turn the same way
// or their overlap cancels into a hole.
function orient(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a < 0 ? [...poly].reverse() : poly;
}
const union = (polys) => polys.map(orient);

// Band around a polyline, half-width hw(u, s) for u in 0..1 along it (s: arc length so far).
function band(pts, hw) {
  const n = pts.length;
  const L = [];
  const R = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const w = hw(i / (n - 1), s);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  return [...L, ...R.reverse()];
}

// A path that sets off from `base` at angle `a` and bends by `bend` radians toward its end.
function curved(base, a, len, bend, n = 14) {
  const pts = [[base[0], base[1]]];
  let [x, y] = base;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const ang = a + bend * u * u;
    x += (Math.cos(ang) * len) / n;
    y += (Math.sin(ang) * len) / n;
    pts.push([x, y]);
  }
  return pts;
}

// Spiral from radius r0 to r1 over `turns`, starting at angle a0 (a cloud scroll, 云纹).
function spiral(cx, cy, r0, r1, turns, a0 = 0, dir = 1, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + dir * t * turns * TAU;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Linear interpolation of y along a polyline, by x.
function yAt(pts, x) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  if (x <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (p[i][0] >= x) {
      const [x0, y0] = p[i - 1];
      const [x1, y1] = p[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return p[p.length - 1][1];
}

// Reveal order following a path: cells light up in the order a hand moving along it passes them.
function along(stage, pts) {
  const s = stage.s;
  const S = pts.map(([x, y]) => [x * s, y * s]);
  const n = S.length - 1;
  return (X, Y) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= n; i++) {
      const d = (X - S[i][0]) ** 2 + (Y - S[i][1]) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best / n;
  };
}

// A palm target: a dusky glow over `polys` (virtual), the night table everywhere else.
function glowTarget(stage, getPolys, level, seed) {
  const night = stage.mottle(...NIGHT);
  const dusk = stage.mottle(level, 0.12, 0.02, seed);
  let zone = null;
  const target = (X, Y) => {
    const m = zone ? zone.at(X, Y) : 0;
    return night(X, Y) + (dusk(X, Y) - night(X, Y)) * m;
  };
  const init = K.call((st) => {
    zone = st.mask(union(getPolys()), { feather: 16 });
  });
  return { target, init };
}

// ---------------------------------------------------------------- the swallow kite (沙燕)

const HEAD = { cx: CX, cy: 748, r: 60 };
const SPAR = 776; // top edge of the wings where they leave the head
const WING_END = CX - 338;
// Top edge of the left wing (the spar), dipping a little toward the tip.
const top = (x) => SPAR + 18 * Math.pow(clamp((CX - 53 - x) / (CX - 53 - WING_END), 0, 1), 1.6);
const LOW = [[CX - 364, 904], [CX - 322, 900], [CX - 262, 902], [CX - 205, 913], [CX - 152, 934], [CX - 108, 962], [CX - 74, 990], [CX - 50, 1008]];
const lowSpline = spline(LOW, 5);
const low = (x) => yAt(lowSpline, x);

// Left half of the kite's outline, from the top of the head round the wing and down the left
// tail blade to the notch between the blades.
function kiteHalf() {
  const pts = [];
  const a1 = Math.PI + Math.asin((SPAR - HEAD.cy) / HEAD.r);
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 - (i / 14) * (a1 - Math.PI / 2);
    pts.push([HEAD.cx + HEAD.r * Math.cos(a), HEAD.cy + HEAD.r * Math.sin(a)]);
  }
  const x0 = pts[pts.length - 1][0];
  for (let i = 1; i <= 12; i++) {
    const x = x0 - (i / 12) * (x0 - WING_END);
    pts.push([x, top(x)]);
  }
  const end = [[WING_END, top(WING_END)], [CX - 356, 800], [CX - 368, 814], [CX - 374, 838], [CX - 372, 866], [CX - 364, 904]];
  const tail = [[CX - 50, 1008], [CX - 66, 1060], [CX - 100, 1136], [CX - 146, 1212], [CX - 186, 1270], [CX - 210, 1302]];
  const inner = [[CX - 210, 1302], [CX - 178, 1288], [CX - 134, 1246], [CX - 88, 1192], [CX - 46, 1138], [CX - 16, 1100], [CX, 1090]];
  return [...pts, ...spline(end, 4).slice(1), ...lowSpline.slice(1), ...spline(tail, 5).slice(1), ...spline(inner, 5).slice(1)];
}

function kiteOutline() {
  const half = kiteHalf();
  return [...half, ...mirror(half).reverse().slice(1)];
}

// The wings' top edge (dy = 0) or a line below it, from the left wing end to the right.
function spar(dy = 9) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const x = WING_END + (i / 24) * 2 * (CX - WING_END);
    pts.push([x, top(x < CX ? x : 2 * CX - x) + dy]);
  }
  return pts;
}

// The black feather stripes (翎) across the lower half of the left wing.
function stripes() {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const x = CX - 84 - i * 37;
    const from = [x, top(x) + 54];
    const to = [x - 10 - 5 * i, low(x - 10 - 5 * i) - 18];
    const w = 8.5 - i * 0.3;
    return band(spline([from, [(from[0] + to[0]) / 2 - 3, (from[1] + to[1]) / 2], to], 6), (u) => w * (0.3 + 0.7 * smoothstep(0, 0.5, u)) * (1 - 0.25 * smoothstep(0.85, 1, u)));
  });
}

function kite(stage) {
  const s = stage.s;
  const acts = [];
  const outline = kiteOutline();
  const paper = stage.mottle(1, 0.12, 0.03, 51);
  // Paper lit from behind: bright in the middle, deeper toward the wing tips and tail points.
  const level = (X, Y) => {
    const dx = Math.abs(X / s - CX) / 370;
    const y = Y / s;
    return (0.14 + 0.2 * dx * dx + 0.18 * smoothstep(1040, 1300, y)) * paper(X, Y);
  };
  // The hook: one bright sweep along the wings, then the paper lights up from the middle.
  acts.push(K.carve(spar(30), { width: 38, strength: 0.96, speed: 1600, rim: 0.3, taper: K.taperBoth, hard: 0.5, rest: 0.03 }));
  acts.push(K.reveal((st) => st.mask(outline, { feather: 0.7 }), { op: 'set', level, order: 'out', duration: 1, jitter: 0.05, rest: 0.04 }));
  // Dark contour, then the spar showing through the backlit paper either side of the head.
  acts.push(K.pour(outline, { width: 6, amount: 1.6, speed: 3200, taper: K.even, scatter: 0, rest: 0.02 }));
  const sp = spar();
  acts.push(K.pour(sp.filter(([x]) => x < CX - 50), { width: 5, amount: 1.4, speed: 2000, taper: K.even, scatter: 0, rest: 0.01 }));
  acts.push(K.pour(sp.filter(([x]) => x > CX + 50), { width: 5, amount: 1.4, speed: 2000, taper: K.even, scatter: 0, rest: 0.01 }));
  // Wings: bold black feather stripes and a cloud scroll on each.
  for (const S of [same, mirror]) {
    acts.push(K.reveal((st) => st.mask(stripes().map(S), { feather: 0.6 }), { op: 'set', level: 2.3, order: S === same ? 'right' : 'left', duration: 0.35, jitter: 0.02, rest: 0.01 }));
    acts.push(K.pour(S(spiral(CX - 214, 822, 3, 25, 1.3, -Math.PI / 2, -1)), { width: 6, amount: 1.7, speed: 800, taper: K.even, scatter: 0, rest: 0.01 }));
  }
  // Head: a black cap over two big bright eyes and a small beak.
  const cap = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI;
    cap.push([HEAD.cx + (HEAD.r - 4) * Math.cos(a), HEAD.cy + (HEAD.r - 4) * Math.sin(a)]);
  }
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    cap.push([HEAD.cx + 56 - t * 112, HEAD.cy + 4 - 16 * Math.abs(Math.sin(Math.PI * 2 * t))]);
  }
  acts.push(K.reveal((st) => st.mask(cap, { feather: 0.6 }), { op: 'set', level: 2.3, order: 'down', duration: 0.25, jitter: 0.03, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask([-1, 1].map((sd) => ellipse(HEAD.cx + sd * 27, 744, 17, 17, 0, 24)), { feather: 0.5 }), { op: 'set', level: 0.08, order: 'out', duration: 0.15, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask([...[-1, 1].map((sd) => ellipse(HEAD.cx + sd * 25, 746, 8, 8, 0, 16)), [[HEAD.cx - 10, 772], [HEAD.cx + 10, 772], [HEAD.cx, 794]]], { feather: 0.4 }), { op: 'set', level: 2.5, order: 'out', duration: 0.12, rest: 0.01 }));
  // A breath with the face drawn and the chest still blank: the cover frame.
  const half = K.wait(0.3);
  half.mark = 'kite-half';
  acts.push(half);
  // Chest: a round medallion with a four-petal flower.
  acts.push(K.pour(ellipse(CX, 880, 44, 44, 0, 48), { width: 6, amount: 1.5, speed: 1100, taper: K.even, scatter: 0, rest: 0.01 }));
  const petals = [0, 1, 2, 3].map((k) => ellipse(CX + 18 * Math.cos((k * Math.PI) / 2 + Math.PI / 4), 880 + 18 * Math.sin((k * Math.PI) / 2 + Math.PI / 4), 13, 7, (k * Math.PI) / 2 + Math.PI / 4, 16));
  acts.push(K.reveal((st) => st.mask(petals, { feather: 0.4 }), { op: 'set', level: 2.2, order: 'out', duration: 0.2, rest: 0.01 }));
  // Tail: dark bands across both blades.
  const bands = [];
  for (const S of [same, mirror]) {
    for (const [y, x0, x1] of [[1128, CX - 104, CX - 40], [1190, CX - 142, CX - 86], [1246, CX - 180, CX - 132]]) bands.push(S(band([[x0, y - 10], [x1, y + 14]], () => 5.5)));
  }
  acts.push(K.reveal((st) => st.mask(bands, { feather: 0.5 }), { op: 'set', level: 2.2, order: 'down', duration: 0.3, jitter: 0.02, rest: 0.02 }));
  return acts;
}

// The string: dark where it crosses the kite, bright against the night below the tail notch,
// running down to someone out of sight behind the far hills.
const STRING = [[CX, 926], [CX + 2, 1010], [CX + 6, 1090], [CX + 16, 1200], [CX + 30, 1300], [CX + 42, 1400]];

function stringPath() {
  const pts = spline(STRING, 10);
  const end = pts.findIndex(([x, y]) => y > yAt(FAR, x) - 3);
  return end > 0 ? pts.slice(0, end) : pts;
}

function string() {
  const pts = stringPath();
  const i0 = pts.findIndex(([, y]) => y > 1092);
  return [
    K.pour(pts.slice(0, i0 + 1), { width: 3, amount: 1.3, speed: 900, taper: K.even, scatter: 0, rest: 0.01 }),
    K.carve(pts.slice(i0), { width: 5, strength: 0.92, speed: 1400, rim: 0.2, taper: (u) => 1 - 0.25 * u, rest: 0.03 }),
  ];
}

// Low rounded hills: a far range in the haze and a nearer, darker one in front of it.
function ridgeLine(y0, bumps, x0 = -30, x1 = 1110, step = 10) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) {
    let y = y0;
    for (const [bx, h, w] of bumps) y = Math.min(y, y0 - h * Math.pow(Math.max(0, 1 - ((x - bx) / w) ** 2), 0.6));
    y += 2.5 * Math.sin(x / 23) + 1.5 * Math.sin(x / 9 + 1);
    pts.push([x, y]);
  }
  return pts;
}

const FAR = ridgeLine(1470, [[40, 120, 190], [300, 76, 170], [600, 104, 200], [880, 124, 200], [1100, 70, 150]]);
const NEAR = ridgeLine(1530, [[160, 92, 230], [470, 44, 190], [760, 96, 230], [1060, 60, 160]]);

function hills(stage) {
  const s = stage.s;
  const far = stage.mottle(1.55, 0.14, 0.02, 61);
  const near = stage.mottle(2.35, 0.1, 0.02, 62);
  const farLevel = (X, Y) => far(X, Y) * (1 + 0.5 * smoothstep(1380, 1520, Y / s));
  return [
    K.reveal((st) => st.mask([...FAR, [1110, 1930], [-30, 1930]], { feather: 1, rough: 0.2, roughScale: 0.15 }), { op: 'set', level: farLevel, order: 'left', duration: 0.5, jitter: 0.05, rest: 0.01 }),
    K.carve(FAR, { width: 4, strength: 0.7, speed: 3000, rim: 0.2, taper: K.taperBoth, rest: 0.01 }),
    K.reveal((st) => st.mask([...NEAR, [1110, 1930], [-30, 1930]], { feather: 1, rough: 0.2, roughScale: 0.15 }), { op: 'set', level: near, order: 'right', duration: 0.4, jitter: 0.05, rest: 0.01 }),
    K.carve(NEAR, { width: 3, strength: 0.5, speed: 3000, rim: 0.2, taper: K.taperBoth, rest: 0.02 }),
  ];
}

// ---------------------------------------------------------------- the phoenix's wings

// The phoenix's arm (leading edge) arches up from the shoulder over the kite's spar to the wrist.
const ARM = spline([[CX - 44, 818], [CX - 120, 786], [CX - 196, 758], [CX - 248, 744]], 8);
const BOUND = { x: 84, y: 642 };

// Point on the arm at t (0 shoulder .. 1 wrist) and the normal toward the trailing edge.
function armAt(t) {
  const n = ARM.length - 1;
  const f = clamp(t, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = f - i;
  const [x0, y0] = ARM[i];
  const [x1, y1] = ARM[i + 1];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const tx = (x1 - x0) / len;
  const ty = (y1 - y0) / len;
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, nx: ty, ny: -tx };
}

// Flight feathers fanning from the arm: hanging beside the body, reaching out level, rising at
// the wrist; every tip curls outward like a flame. Tier 1 is a shorter row between them.
// Lengths are clipped so the tips stay inside the safe area (BOUND).
function fan(tier = 0) {
  const out = [];
  const n = tier ? 8 : 9;
  for (let i = 0; i < n; i++) {
    const t = tier ? (i + 0.5) / 8 : i / 8;
    const p = armAt(0.04 + 0.96 * t);
    const off = tier ? 10 : 16;
    const base = [p.x + p.nx * off, p.y + p.ny * off];
    const a = ((104 + 136 * Math.pow(t, 1.1)) * Math.PI) / 180;
    let len = (212 + 30 * Math.sin(Math.PI * Math.min(1, t * 1.7)) - 40 * t) * (tier ? 0.56 : 1);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    if (c < 0) len = Math.min(len, (base[0] - BOUND.x) / -c);
    if (sn < 0) len = Math.min(len, (base[1] - BOUND.y) / -sn);
    const bend = 0.6 * (1 - 2 * smoothstep(0.35, 0.8, t));
    out.push({ pts: curved(base, a, len, bend), w: (tier ? 30 : 40) - 8 * t });
  }
  return out;
}

const featherTaper = (u) => (0.55 + 0.45 * smoothstep(0, 0.3, u)) * (1 - 0.74 * smoothstep(0.6, 1, u));
const featherPoly = (f, grow = 0) => band(f.pts, (u) => (f.w / 2) * featherTaper(u) + grow);

// Coverts: a band of small feathers along the arm, rounded off at the wrist.
function covertsPoly() {
  const upper = [];
  const lower = [];
  for (let i = 0; i <= 20; i++) {
    const t = 0.08 + (0.92 * i) / 20;
    const p = armAt(t);
    upper.push([p.x - p.nx * 3, p.y - p.ny * 3]);
    const d = 54 - 16 * t;
    lower.push([p.x + p.nx * d, p.y + p.ny * d]);
  }
  // Rounded off past the wrist: a half circle from the leading side round to the trailing side.
  const w = armAt(1);
  const a0 = Math.atan2(-w.ny, -w.nx);
  const cap = [];
  for (let i = 1; i < 8; i++) {
    const a = a0 - (i / 8) * Math.PI;
    cap.push([w.x + w.nx * 18 + 20 * Math.cos(a), w.y + w.ny * 18 + 20 * Math.sin(a)]);
  }
  return [...upper, ...cap, ...lower.reverse()];
}

function covertScallops() {
  const out = [];
  for (const [row, d] of [[0, 17], [1, 36]]) {
    for (let t = 0.1 + row * 0.06; t < 0.95 - row * 0.1; t += 0.13) {
      const p = armAt(t);
      const cx = p.x + p.nx * d;
      const cy = p.y + p.ny * d;
      const ang = Math.atan2(p.ny, p.nx);
      const arcPts = [];
      for (let j = 0; j <= 6; j++) {
        const b = ang - 1.15 + (2.3 * j) / 6;
        arcPts.push([cx + 13 * Math.cos(b), cy + 13 * Math.sin(b)]);
      }
      out.push(band(arcPts, () => 1.6));
    }
  }
  return out;
}

function wingsSprout(stage) {
  const zone = () => {
    const polys = [...fan().map((f) => featherPoly(f, 4)), covertsPoly()];
    return [...polys, ...polys.map(mirror)];
  };
  const { target, init } = glowTarget(stage, zone, 2.0, 71);
  const acts = [init];
  // The palm brushes each wing outward and up round its end: the stripes smear into the dusk.
  const brush = spline([[CX - 46, 952], [CX - 150, 922], [CX - 250, 896], [CX - 332, 884], [CX - 380, 850], [CX - 388, 796], [CX - 362, 738]], 8);
  for (const [k, S] of [same, mirror].entries()) {
    const palm = K.palm(S(brush), { width: 160, speed: 740, target, rate: 0.97, streak: stage.streaks[0], hard: 0.45, rest: 0.02 });
    if (k === 0) palm.mark = 'twist';
    acts.push(palm);
    // Feathers fan open from the shoulder round to the wrist.
    for (const [i, f] of fan().entries()) {
      const a = K.carve(S(f.pts), { width: f.w, strength: 0.95, speed: 1500, rim: 0.4, taper: featherTaper, hard: 0.55, rest: 0.005 });
      if (k === 0 && i === 0) a.mark = 'feathers';
      acts.push(a);
    }
  }
  return acts;
}

// A shorter tier over the roots, each on its own dark bed, the shafts, then the coverts along
// the arm and the dark line of the leading edge.
function wingsFinish(stage) {
  const acts = [];
  const both = (list) => union([...list, ...list.map(mirror)]);
  const tier = fan(1);
  acts.push(K.reveal((st) => st.mask(both(tier.map((f) => featherPoly(f, 3.5))), { feather: 0.5 }), { op: 'set', level: 2.1, order: 'out', duration: 0.15, jitter: 0.02, rest: 0 }));
  acts.push(K.reveal((st) => st.mask(both(tier.map((f) => featherPoly(f))), { feather: 0.6 }), { op: 'set', level: stage.mottle(0.14, 0.15, 0.03, 83), order: 'out', duration: 0.3, jitter: 0.02, rest: 0.01 }));
  const shafts = both([...fan(), ...tier].map((f) => band(f.pts.slice(2, -4), () => 1.2)));
  acts.push(K.reveal((st) => st.mask(shafts, { feather: 0.4 }), { op: 'add', amount: 0.8, order: 'out', duration: 0.2, jitter: 0.02, rest: 0 }));
  acts.push(K.reveal((st) => st.mask(both([covertsPoly()]), { feather: 0.8 }), { op: 'set', level: stage.mottle(0.15, 0.15, 0.03, 81), order: 'out', duration: 0.3, jitter: 0.04, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(both(covertScallops()), { feather: 0.4 }), { op: 'add', amount: 0.95, order: 'out', duration: 0.25, jitter: 0.02, rest: 0.01 }));
  const edge = ARM.map(([x, y], i) => {
    const p = armAt(i / (ARM.length - 1));
    return [x - p.nx * 6, y - p.ny * 6];
  });
  acts.push(K.reveal((st) => st.mask(both([band(edge.slice(2), (u) => 2.6 * (1 - 0.5 * u))]), { feather: 0.4 }), { op: 'set', level: 2.3, order: 'out', duration: 0.15, rest: 0.01 }));
  return acts;
}

// ---------------------------------------------------------------- the phoenix (朱雀)

const BODY = spline([[CX, 832], [CX + 30, 838], [CX + 48, 864], [CX + 54, 906], [CX + 46, 950], [CX + 28, 990], [CX + 12, 1014], [CX - 12, 1014], [CX - 28, 990], [CX - 46, 950], [CX - 54, 906], [CX - 48, 864], [CX - 30, 838]], 6, true);
const NECK = spline([[CX - 2, 862], [CX - 20, 820], [CX - 16, 782], [CX + 4, 752], [CX + 26, 738]], 8);
const HEADC = [CX + 42, 728];

function headParts() {
  const [hx, hy] = HEADC;
  const P = (pts) => pts.map(([x, y]) => [hx + x, hy + y]);
  return {
    head: spline(P([[-40, 16], [-34, -18], [-8, -34], [22, -30], [42, -14], [46, 8], [28, 28], [-10, 32]]), 6, true),
    upper: spline(P([[40, -14], [66, -12], [90, -2], [96, 10], [84, 6], [62, 5], [44, 7]]), 5, true),
    lower: spline(P([[44, 11], [64, 10], [80, 13], [64, 20], [44, 19]]), 5, true),
    wattle: spline(P([[36, 18], [52, 26], [52, 46], [40, 50], [32, 32]]), 5, true),
    eye: ellipse(hx + 20, hy - 10, 9, 6, -0.12, 18),
    line: band(spline(P([[12, -8], [-6, -6], [-28, 0]]), 5), (u) => 2.6 * (1 - 0.7 * u)),
    mouth: band(spline(P([[44, 9], [66, 8], [86, 8]]), 5), () => 1.5),
  };
}

// Crest: three plumes rising from the crown and curling back over like waves (卷).
function crestPaths() {
  const [hx, hy] = HEADC;
  const P = (pts) => spline(pts.map(([x, y]) => [hx + x, hy + y]), 8);
  return [
    { pts: P([[-6, -32], [-20, -60], [-44, -82], [-74, -90], [-96, -82], [-100, -64]]), w: 12 },
    { pts: P([[-16, -24], [-40, -48], [-74, -58], [-108, -54], [-126, -38], [-120, -22]]), w: 11 },
    { pts: P([[-24, -12], [-56, -18], [-92, -12], [-118, 4], [-122, 22], [-110, 28]]), w: 10 },
  ];
}

function crestPolys() {
  return crestPaths().map((c) => band(c.pts, (u) => c.w * (1 - 0.72 * u) * smoothstep(0, 0.08, u + 0.05)));
}

// Tail plumes: the kite's blades stream out and curl up, two more fall between them, and the
// string becomes the middle one.
const PLUMES = [
  { ctrl: [[CX - 12, 996], [CX - 62, 1088], [CX - 132, 1174], [CX - 222, 1232], [CX - 300, 1242], [CX - 352, 1206], [CX - 366, 1148], [CX - 350, 1100]], w: 26 },
  { ctrl: [[CX - 8, 1000], [CX - 36, 1098], [CX - 84, 1188], [CX - 126, 1254], [CX - 144, 1300]], w: 20 },
  { ctrl: [[CX, 1004], [CX + 8, 1100], [CX + 2, 1190], [CX + 18, 1262], [CX + 22, 1306]], w: 20 },
];
PLUMES.push({ ...PLUMES[1], ctrl: mirror(PLUMES[1].ctrl) }, { ...PLUMES[0], ctrl: mirror(PLUMES[0].ctrl) });
const EYE_U = 0.84;

const plumePath = (p) => spline(p.ctrl, 12);

// A plume's outline: narrow at the root, swelling round its eye, serrated edges like barbs.
function plumePoly(p) {
  const pts = plumePath(p);
  const W = p.w;
  const prof = (u) => {
    const body = (0.3 + 0.7 * smoothstep(0, 0.3, u)) * (1 - 0.18 * smoothstep(0.35, 0.7, u));
    const eye = 0.6 * Math.exp(-(((u - EYE_U) / 0.075) ** 2));
    return (body + eye) * smoothstep(1, 0.93, u);
  };
  return band(pts, (u, s) => W * prof(u) * (0.74 + 0.26 * ((s / 19) % 1)));
}

function plumeEye(p) {
  const pts = plumePath(p);
  const i = Math.round((pts.length - 1) * EYE_U);
  const [x0, y0] = pts[i - 2];
  const [x1, y1] = pts[i + 2];
  const [x, y] = pts[i];
  return { x, y, a: Math.atan2(y1 - y0, x1 - x0), w: p.w };
}

// Ring between two ellipses (nonzero rule: the inner one runs backwards).
const ring = (e, r0, r1) => [ellipse(e.x, e.y, e.w * r1 * 1.25, e.w * r1, e.a, 32), ellipse(e.x, e.y, e.w * r0 * 1.25, e.w * r0, e.a, 32).reverse()];

// Scale edges across the breast (dy shifts them down, for the shadow under each edge).
function breastScales(dy) {
  const out = [];
  for (let r = 0; r < 4; r++) {
    const y = 884 + r * 30 + dy;
    const n = [3, 4, 3, 2][r];
    const hw = [28, 40, 32, 16][r];
    for (let i = 0; i < n; i++) {
      const x = CX + (n === 1 ? 0 : -hw + (2 * hw * i) / (n - 1));
      const arcPts = [];
      for (let j = 0; j <= 8; j++) {
        const b = Math.PI * 0.1 + (Math.PI * 0.8 * j) / 8;
        arcPts.push([x + 15 * Math.cos(b), y + 12 * Math.sin(b)]);
      }
      out.push(band(arcPts, () => 2.2));
    }
  }
  return out;
}

const phoenixZone = () => [BODY, band(NECK, () => 34), ...PLUMES.map((p) => band(plumePath(p), (u) => p.w * (1 - 0.3 * u)))];

// Head and chest melt upward under the palm (a wide pass, then one round the crown), leaving a
// dusky glow where the neck and body will be.
function melt(stage) {
  const { target, init } = glowTarget(stage, phoenixZone, 2.25, 73);
  const up = K.palm(spline([[CX, 1070], [CX - 2, 960], [CX + 6, 850], [CX + 12, 740], [CX + 14, 650]], 8), { width: 200, speed: 760, target, rate: 0.96, streak: stage.streaks[2], streakMode: 'target', hard: 0.5, rest: 0.01 });
  up.mark = 'melt';
  const crown = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (1.08 - (i / 24) * 1.16);
    crown.push([HEAD.cx + 50 * Math.cos(a), HEAD.cy - 50 * Math.sin(a)]);
  }
  const shoulders = [[CX - 130, 786], [CX + 130, 786]];
  return [
    init,
    up,
    K.palm(crown, { width: 70, speed: 900, target, rate: 0.96, streak: stage.streaks[2], streakMode: 'target', hard: 0.6, rest: 0.01 }),
    K.palm(shoulders, { width: 46, speed: 1200, target, rate: 0.96, streak: stage.streaks[2], streakMode: 'target', hard: 0.6, rest: 0.02 }),
  ];
}

// The vermilion body, neck and head (the beak stays gold), the dark phoenix eye and the crest.
function bodyAndHead(stage) {
  const s = stage.s;
  const acts = [];
  const neckBand = band(NECK, (u) => 22 - 8 * u);
  const hp = headParts();
  acts.push(K.tint(stage, [...union([BODY, neckBand, hp.head, hp.wattle]), ...breastScales(0).map((p) => orient(p).reverse())], { fadeIn: 0.4 }));
  const bodyLevel = (X, Y) => {
    const x = X / s - CX;
    const y = Y / s;
    return 0.07 + 0.28 * smoothstep(0, 54, x) + 0.1 * smoothstep(930, 1014, y);
  };
  // Body, neck and head rise in one sweep from the tail up to the crown, the gold beak last.
  const body = K.reveal((st) => st.mask(union([BODY, neckBand, hp.head, hp.wattle]), { feather: 0.8 }), { op: 'set', level: bodyLevel, order: 'up', duration: 0.55, jitter: 0.03, rest: 0.01 });
  body.mark = 'body';
  acts.push(body);
  acts.push(K.reveal((st) => st.mask(union([hp.upper, hp.lower]), { feather: 0.6 }), { op: 'set', level: stage.mottle(0.08, 0.1, 0.03, 85), order: 'right', duration: 0.12, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask([hp.eye, hp.line, hp.mouth], { feather: 0.4 }), { op: 'set', level: 2.6, order: 'right', duration: 0.12, rest: 0.01 }));
  // Breast feathers: staggered rows of scales edged in gold thread (left out of the vermilion).
  acts.push(K.reveal((st) => st.mask(breastScales(3), { feather: 0.4 }), { op: 'add', amount: 0.55, order: 'down', duration: 0.2, rest: 0 }));
  acts.push(K.reveal((st) => st.mask(breastScales(0), { feather: 0.4 }), { op: 'set', level: 0.05, order: 'down', duration: 0.2, rest: 0.01 }));
  // The body's outline round the sides and belly, left open under the neck (BODY starts at the
  // top centre, so dropping the points there leaves one open path).
  acts.push(K.pour(BODY.filter(([x, y]) => y > 850 || Math.abs(x - CX) > 34), { width: 4, amount: 1.1, speed: 2000, taper: K.even, scatter: 0, rest: 0.01 }));
  // Crest.
  const crest = union(crestPolys());
  acts.push(K.tint(stage, crest, { fadeIn: 0.4, feather: 2 }));
  acts.push(K.reveal((st) => st.mask(crest, { feather: 0.6 }), { op: 'set', level: stage.mottle(0.1, 0.12, 0.03, 87), order: 'right', duration: 0.5, jitter: 0.02, rest: 0.01 }));
  return acts;
}

// The palm streams the kite's tail blades and its string out, and the plumes are drawn along them.
function tail(stage) {
  const acts = [];
  const { target, init } = glowTarget(stage, phoenixZone, 2.0, 73);
  acts.push(init);
  for (const S of [same, mirror]) {
    const palm = K.palm(S(spline([[CX - 58, 1060], [CX - 118, 1146], [CX - 190, 1260], [CX - 280, 1310]], 8)), { width: 116, speed: 1100, target, rate: 0.95, streak: stage.streaks[1], streakMode: 'target', hard: 0.4, rest: 0.01 });
    if (S === same) palm.mark = 'tail';
    acts.push(palm);
  }
  acts.push(K.palm(stringPath().filter(([, y]) => y > 1080 && y < yAt(FAR, CX + 40) - 26), { width: 56, speed: 1800, target, rate: 0.95, streak: stage.streaks[0], streakMode: 'target', hard: 0.4, rest: 0.02 }));
  // The tail plumes stream out, each with a dark shaft.
  for (const p of PLUMES) {
    const pts = plumePath(p);
    acts.push(K.reveal((st) => st.mask(plumePoly(p), { feather: 0.6 }), { op: 'set', level: stage.mottle(0.12, 0.15, 0.03, 91), order: along(stage, pts), duration: 0.3, jitter: 0.01, rest: 0.01 }));
  }
  const shafts = PLUMES.map((p) => band(plumePath(p).filter((_, i, a) => i > 2 && i < a.length * (EYE_U - 0.09)), () => 1.4));
  acts.push(K.reveal((st) => st.mask(shafts, { feather: 0.4 }), { op: 'add', amount: 0.9, order: 'down', duration: 0.25, rest: 0.01 }));
  // Eyes of the plumes: a vermilion ring, a dark ring, a gold heart with a dark pupil.
  const eyes = PLUMES.map(plumeEye);
  acts.push(K.tint(stage, eyes.flatMap((e) => ring(e, 0.62, 1.12)), { fadeIn: 0.4 }));
  acts.push(K.reveal((st) => st.mask(eyes.flatMap((e) => ring(e, 0.44, 0.62)), { feather: 0.4 }), { op: 'set', level: 2.3, order: 'out', duration: 0.2, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(eyes.map((e) => ellipse(e.x, e.y, e.w * 0.2, e.w * 0.16, e.a, 16)), { feather: 0.4 }), { op: 'set', level: 2.4, order: 'out', duration: 0.1, rest: 0.01 }));
  // Last, the glint that brings the phoenix's eye alive, and a soft aura lifting the night.
  const [hx, hy] = HEADC;
  acts.push(K.reveal((st) => st.mask(ellipse(hx + 22, hy - 12, 2.6, 2.6, 0, 8), { feather: 0.3 }), { op: 'carve', strength: 0.95, order: 'out', duration: 0.1, rest: 0.05 }));
  acts.push(
    K.reveal((st) => K.radialMask(st, CX, 930, 240, 560, 1.6).map((a, X, Y) => a * smoothstep(1.6, 2.3, st.field.d[Y * st.field.w + X])), { op: 'carve', strength: 0.22, order: 'out', duration: 0.6, jitter: 0.06, rest: 0.2 }),
  );
  return acts;
}
