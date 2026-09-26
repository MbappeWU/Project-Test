import { spline, ellipse, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 我与狸奴不出门 — a guessing game. A few bright arcs and a crescent could be a bridge over a river
// under the moon; the palm smears the "river" into a tiled roof, the arcs turn out to be a cat's
// back and tail, and the cat curled asleep on the ridge only shows its ears and face at the very
// end. Portrait 1080x1920.
const RIDGE = 1112;
const EAVE = 1292;
const MOON = [262, 566, 98];
// The cat is drawn at 1.14x around the middle of the ridge.
const SC = 1.14;
const Z = (p) => (typeof p[0] === 'number' ? [540 + (p[0] - 540) * SC, RIDGE + (p[1] - RIDGE) * SC] : p.map(Z));
const eaveY = (x) => EAVE - 118 * Math.pow(smoothstep(300, 560, Math.abs(x - 540)), 1.6);
const RIDGE_X = [150, 930];
// Inside the roof face: below the ridge beam, above the eave, within the hips.
const hipX = (y, sd) => {
  const x0 = sd < 0 ? RIDGE_X[0] : RIDGE_X[1];
  const x1 = sd < 0 ? 30 : 1050;
  const t = (y - RIDGE - 34) / (eaveY(x1) - RIDGE - 34);
  return x0 + (x1 - x0) * t;
};
const inRoof = (x, y) => y > RIDGE + 20 && y < eaveY(x) && x > hipX(y, -1) && x < hipX(y, 1);

export default {
  id: 'cat',
  music: 'panda',
  title: { cn: '狸奴', en: 'Guess the Cat' },
  theme: '互动 · 猜画',
  hook: { en: 'Guess what this becomes', cn: '猜猜我在画什么' },
  payoff: { en: 'Did you guess the cat?', cn: '你猜对了吗？' },
  inscription: { columns: ['我与狸奴不出门'], note: '宋 · 陆游《十一月四日风雨大作》' },
  seal: '狸奴',
  twist: '看似抽象的几道弧线，最后变成屋脊上蜷着睡觉的猫',
  build(stage, rng) {
    const acts = [];
    const s = stage.s;
    const sky = stage.mottle(1.8, 0.1, 0.01, 3);
    const roofTone = stage.streaky(2.35, 0.14, 0.004, 0.03, 11);
    const below = (X, Y) => {
      const x = X / s;
      const y = Y / s;
      if (inRoof(x, y)) return roofTone(X, Y);
      if (y < eaveY(x) - 4) return sky(X, Y);
      const t = smoothstep(eaveY(x) + 30, eaveY(x) + 170, y);
      return roofTone(X, Y) * 1.12 * (1 - t) + sky(X, Y) * t;
    };

    // Picture A, abstract: a great arc (the cat's back), a long curl under it (the tail), a
    // crescent, and three ripples below that make it look like a bridge over a river at night.
    acts.push(K.carve(spline(Z(BACK), 10), { width: 34, strength: 0.97, speed: 760, rim: 0.3, hard: 0.45, taper: (u) => 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1)), rest: 0.05 }));
    acts.push(K.carve(spline(Z(TAIL.slice(0, 5)), 10), { width: 24, strength: 0.95, speed: 700, rim: 0.3, taper: (u) => 0.5 + 0.5 * smoothstep(0, 0.4, u), rest: 0.05 }));
    acts.push(crescent(stage, 0.97, 1.3));
    const ripples = [
      [1186, 130, 950, 0],
      [1236, 200, 900, 2],
      [1290, 90, 1000, 4],
    ];
    for (const [y, x0, x1, ph] of ripples) {
      const pts = [];
      for (let x = x0; x <= x1; x += 12) pts.push([x, y + 9 * Math.sin(x / 70 + ph) * Math.sin((Math.PI * (x - x0)) / (x1 - x0))]);
      acts.push(K.carve(pts, { width: 9, strength: 0.85, speed: 1100, rim: 0.25, taper: K.taperBoth, rest: 0.04 }));
    }
    // It holds while the moon's glow and a few stars come up.
    acts.push(K.reveal((st) => K.radialMask(st, MOON[0], MOON[1], MOON[2] * 0.9, MOON[2] * 2.6, 2.2), { op: 'carve', strength: 0.3, order: 'out', duration: 1.4, jitter: 0.05 }));
    const stars = [[110, 420, 4], [520, 470, 3.5], [700, 560, 4.5], [640, 760, 3], [150, 800, 3.5], [820, 900, 3], [420, 700, 3]];
    acts.push(K.reveal((st) => st.mask(stars.map(([x, y, r]) => ellipse(x, y, r, r, 0, 10)), { feather: 0.6 }), { op: 'carve', strength: 0.95, order: 'left', duration: 1.2, jitter: 0.2 }));
    acts.push(K.wait(3.4));

    // The twist: the palm smears the river into a dark tiled roof...
    for (const [y, dir] of [[1188, 1], [1256, -1], [1330, 1], [1400, -1]]) {
      const pts = [];
      for (let x = -80; x <= 1160; x += 40) pts.push([x, y + 10 * Math.sin(x / 200 + y)]);
      if (dir < 0) pts.reverse();
      acts.push(K.palm(pts, { width: 130, speed: 1500, target: below, rate: 0.9, streak: stage.streaks[1], streakMode: 'target', hard: 0.4, rest: 0.03 }));
    }
    acts.push(...roof(stage, roofTone));
    // ...and the arcs become a cat curled asleep on the ridge.
    acts.push(...cat(stage, rng));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 952, y: 452, size: 48, mode: 'carve', strength: 0.9, perChar: 1.1 }));
    acts.push(...K.seal(stage, this.seal, 952, 862, { size: 50, seed: rng.int(1, 999) }));
    return acts;
  },
};

// The cat's back from the nape over the shoulders and rump down to the ridge, and its tail
// wrapped round the front with the tip curled up by the paws.
const BACK = [[420, 940], [496, 894], [596, 876], [690, 890], [762, 934], [802, 1000], [806, 1060], [790, 1104]];
const TAIL = [[792, 1100], [710, 1122], [600, 1126], [520, 1118], [482, 1100], [482, 1074], [506, 1064]];
const HEAD = [368, 1000];

function crescent(stage, strength, duration) {
  const [x, y, r] = MOON;
  return K.reveal(
    (st) => {
      const inner = st.mask(ellipse(x + r * 0.42, y - r * 0.24, r * 0.86, r * 0.86, 0, 72), { feather: 0.8 });
      return st.mask(ellipse(x, y, r, r, 0, 96), { feather: 1 }).map((a, X, Y) => a * (1 - inner.at(X, Y)));
    },
    { op: 'carve', strength, order: (X, Y) => Math.atan2(Y - y * stage.s, X - x * stage.s), duration, jitter: 0.02 },
  );
}

// The ridge (正脊) with its upturned end ornaments (鸱吻), the roof face with tile rows fanning
// down to eaves that fly up at the corners (飞檐), hip ridges and tile ends, faintly moonlit.
function roof(stage, tone) {
  const acts = [];
  const face = [[RIDGE_X[0], RIDGE + 30], [RIDGE_X[1], RIDGE + 30]];
  for (let x = 1050; x >= 30; x -= 20) face.push([x, eaveY(x)]);
  acts.push(K.reveal((st) => st.mask(face, { feather: 1.2 }), { op: 'set', level: tone, order: 'down', duration: 1.2 }));
  // Tile rows fanning out from the ridge, lit along their rounded tops.
  const rows = [];
  const ends = [];
  for (let x = RIDGE_X[0] + 22; x <= RIDGE_X[1] - 20; x += 34) {
    const xe = 540 + (x - 540) * 1.32;
    const ye = eaveY(xe) - 10;
    rows.push(ribbon([[x, RIDGE + 40], [xe, ye]], 5, 8));
    ends.push(ellipse(xe, ye + 2, 8, 7, 0, 14));
  }
  acts.push(K.reveal((st) => st.mask(rows, { feather: 1.5 }), { op: 'carve', strength: 0.42, order: 'left', duration: 1.4, jitter: 0.03 }));
  acts.push(K.reveal((st) => st.mask(ends, { feather: 0.8 }), { op: 'carve', strength: 0.55, order: 'left', duration: 0.6, jitter: 0.03 }));
  // Eave: a bright lip and its dark shadow, curling up into pointed corners.
  const lip = [];
  for (let x = 30; x <= 1050; x += 15) lip.push([x, eaveY(x)]);
  acts.push(K.pour(lip.map(([x, y]) => [x, y + 12]), { width: 20, amount: 1.4, speed: 1500, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  acts.push(K.carve(lip, { width: 7, strength: 0.72, speed: 1500, rim: 0.2, taper: K.even, rest: 0.03 }));
  for (const sd of [-1, 1]) {
    const x = sd < 0 ? 30 : 1050;
    const y = eaveY(x);
    acts.push(K.carve(spline([[x - sd * 60, eaveY(x - sd * 60)], [x, y], [x + sd * 22, y - 34]], 6), { width: 8, strength: 0.72, speed: 400, rim: 0.2, taper: (u) => 1 - 0.8 * u, rest: 0.02 }));
    // Hip ridge from the end of the main ridge down to the corner.
    acts.push(K.pour([[sd < 0 ? RIDGE_X[0] : RIDGE_X[1], RIDGE + 30], [x, y - 6]], { width: 16, amount: 1.6, speed: 900, taper: (u) => 1 - 0.4 * u, scatter: 0, rest: 0.02 }));
    acts.push(K.carve([[sd < 0 ? RIDGE_X[0] : RIDGE_X[1], RIDGE + 26], [x, y - 12]], { width: 4, strength: 0.6, speed: 900, rim: 0.1, taper: K.taperBoth, rest: 0.02 }));
  }
  // The ridge beam, its ends sweeping up into swallow tails (燕尾脊), with a moonlit top edge.
  const flat = [214, 866];
  const mid = (x) => {
    const d = x < flat[0] ? flat[0] - x : x > flat[1] ? x - flat[1] : 0;
    return RIDGE + 20 - 0.0075 * d * d - 0.08 * d;
  };
  const thick = (x) => {
    const d = x < flat[0] ? flat[0] - x : x > flat[1] ? x - flat[1] : 0;
    return 42 * (1 - 0.8 * smoothstep(0, 96, d));
  };
  const top = [];
  const bottom = [];
  for (let x = flat[0] - 96; x <= flat[1] + 96; x += 4) {
    top.push([x, mid(x) - thick(x) / 2]);
    bottom.push([x, mid(x) + thick(x) / 2]);
  }
  acts.push(K.reveal((st) => st.mask([...top, ...bottom.reverse()], { feather: 1 }), { op: 'set', level: 2.75, order: 'left', duration: 1 }));
  acts.push(K.carve(top.map(([x, y]) => [x, y + 3]), { width: 6, strength: 0.75, speed: 1800, rim: 0.2, taper: K.even, rest: 0.03 }));
  acts.push(K.carve([[flat[0], RIDGE + 38], [flat[1], RIDGE + 38]], { width: 3, strength: 0.35, speed: 1800, rim: 0, taper: K.taperBoth, rest: 0.03 }));
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
    const hw = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push([pts[i][0] - ((y1 - y0) / len) * hw, pts[i][1] + ((x1 - x0) / len) * hw]);
    R.push([pts[i][0] + ((y1 - y0) / len) * hw, pts[i][1] - ((x1 - x0) / len) * hw]);
  }
  return [...L, ...R.reverse()];
}

// Moonlit cat curled asleep: body, haunch, tabby stripes, the tail wrapped round, paws, and last
// the head, ears, closed eyes, nose and whiskers.
function cat(stage, rng) {
  const acts = [];
  const s = stage.s;
  const W = (o) => ({ ...o, width: o.width * SC });
  const carve = (pts, o) => K.carve(Z(pts), W(o));
  const pour = (pts, o) => K.pour(Z(pts), W(o));
  const mask = (st, polys, o) => st.mask(Z(polys), o);
  const lit = (lo, hi, cx0, cy0, rx, ry) => (X, Y) => {
    const [cx, cy] = Z([cx0, cy0]);
    const dx = (X / s - cx) / (rx * SC);
    const dy = (Y / s - cy) / (ry * SC);
    // Light from the moon at the upper left.
    return lo + (hi - lo) * smoothstep(-0.9, 0.9, 0.6 * dx + 0.8 * dy);
  };
  const body = spline([...BACK, [700, 1116], [560, 1118], [440, 1112], [372, 1076], [360, 1010], [380, 960]], 8, true);
  acts.push(
    K.reveal((st) => mask(st, body, { feather: 1.5 }), {
      op: 'set',
      level: lit(0.12, 0.9, 600, 1000, 220, 120),
      order: (X, Y) => -Y,
      duration: 1.8,
      jitter: 0.02,
    }),
  );
  // Soft fur along the back, then the folded haunch.
  acts.push(carve(spline(BACK, 10), { width: 16, strength: 0.9, speed: 900, rim: 0.2, taper: K.taperBoth, rest: 0.03 }));
  acts.push(pour(spline([[690, 944], [744, 990], [752, 1050], [716, 1100]], 8), { width: 6, amount: 1, speed: 400, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // Tabby stripes across the back, following the curve of the body.
  for (const [x, y, a, len] of [[500, 900, 1.9, 60], [556, 886, 1.75, 70], [614, 884, 1.55, 72], [672, 896, 1.35, 70], [724, 922, 1.12, 64], [764, 962, 0.85, 56], [790, 1016, 0.5, 44]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push([x + Math.cos(a) * len * t + Math.sin(t * Math.PI) * 6, y + Math.sin(a) * len * t]);
    }
    acts.push(pour(pts, { width: 13, amount: 0.9, speed: 500, taper: (u) => 1 - 0.8 * u, scatter: 0.1, rest: 0.02 }));
  }
  // The tail: a thick, fluffy curl round the front with dark rings and a pale tip.
  const tail = spline(TAIL, 10);
  acts.push(pour(tail.map(([x, y]) => [x, y - 22]), { width: 5, amount: 1.1, speed: 900, taper: K.taperBoth, scatter: 0, rest: 0.02 }));
  acts.push(carve(tail, { width: 42, strength: 0.9, speed: 520, rim: 0.3, hard: 0.5, taper: (u) => 0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.3)), rest: 0.03 }));
  const rings = [];
  for (let i = 1; i < 6; i++) {
    const k = Math.round((i / 6.2) * (tail.length - 1));
    const [x0, y0] = tail[k - 1];
    const [x1, y1] = tail[k + 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const [cx, cy] = tail[k];
    rings.push(ribbon([[cx - nx * 17, cy - ny * 17], [cx + (x1 - x0) / len * 5, cy + (y1 - y0) / len * 5], [cx + nx * 17, cy + ny * 17]], 9, 9));
  }
  acts.push(K.reveal((st) => mask(st, rings, { feather: 1 }), { op: 'add', amount: 0.8, order: 'right', duration: 0.8, jitter: 0.03 }));
  // Front paws tucked under the chin.
  const paws = [ellipse(402, 1094, 30, 18, -0.05, 24), ellipse(452, 1100, 28, 16, 0.05, 24)];
  acts.push(K.reveal((st) => mask(st, paws, { feather: 1 }), { op: 'set', level: 0.1, order: 'left', duration: 0.6 }));
  for (const [x, y] of [[402, 1094], [452, 1100]]) {
    acts.push(pour(spline([[x - 30, y + 2], [x - 10, y - 16], [x + 20, y - 14], [x + 30, y + 2]], 6), { width: 3.5, amount: 1, speed: 500, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
    for (const dx of [-12, 0, 12]) acts.push(pour([[x + dx + 14, y + 4], [x + dx + 16, y + 14]], { width: 3, amount: 0.9, speed: 200, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
  }
  // The head, round with full cheeks, resting on the paws.
  const [hx, hy] = HEAD;
  const headPoly = spline([[hx, hy - 76], [hx + 60, hy - 60], [hx + 86, hy - 12], [hx + 78, hy + 40], [hx + 36, hy + 70], [hx, hy + 76], [hx - 36, hy + 70], [hx - 78, hy + 40], [hx - 86, hy - 12], [hx - 60, hy - 60]], 6, true);
  acts.push(K.reveal((st) => mask(st, headPoly, { feather: 1.2 }), { op: 'set', level: lit(0.06, 0.55, hx, hy, 90, 80), order: 'out', duration: 1 }));
  acts.push(pour(headPoly.filter(([, y]) => y > hy - 50), { width: 4, amount: 1.2, speed: 1200, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // Ears prick up: the moment it becomes a cat.
  const ears = [
    [[hx - 80, hy - 32], [hx - 84, hy - 118], [hx - 22, hy - 72]],
    [[hx + 22, hy - 72], [hx + 84, hy - 118], [hx + 80, hy - 32]],
  ];
  acts.push(K.reveal((st) => mask(st, ears.map((e) => spline(e, 4, true)), { feather: 1 }), { op: 'set', level: 0.05, order: 'up', duration: 0.7, rest: 0.05 }));
  for (const e of ears) {
    acts.push(pour([e[0], e[1], e[2]], { width: 4, amount: 1.2, speed: 500, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
    const [ax, ay] = e[0];
    const [bx, by] = e[1];
    const [cx, cy] = e[2];
    const inner = [[ax + (bx - ax) * 0.2 + (cx - ax) * 0.25, ay + (by - ay) * 0.2 + (cy - ay) * 0.25], [bx + (ax + cx - 2 * bx) * 0.22, by + (ay + cy - 2 * by) * 0.22], [cx + (bx - cx) * 0.2 + (ax - cx) * 0.25, cy + (by - cy) * 0.2 + (ay - cy) * 0.25]];
    acts.push(K.reveal((st) => mask(st, spline(inner, 4, true), { feather: 1.2 }), { op: 'add', amount: 0.9, order: 'up', duration: 0.3, rest: 0.03 }));
  }
  // Closed eyes, then nose and mouth.
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 32;
    const ey = hy + 4;
    acts.push(pour(spline([[ex - 18, ey - 2], [ex, ey + 8], [ex + 18, ey - 2]], 6), { width: 5, amount: 1.8, speed: 160, taper: K.taperBoth, scatter: 0, rest: 0.06 }));
  }
  acts.push(K.reveal((st) => mask(st, spline([[hx - 9, hy + 26], [hx + 9, hy + 26], [hx, hy + 36]], 3, true), { feather: 0.6 }), { op: 'set', level: 2.2, order: 'down', duration: 0.2, rest: 0.03 }));
  acts.push(pour(spline([[hx - 14, hy + 44], [hx - 7, hy + 48], [hx, hy + 38], [hx + 7, hy + 48], [hx + 14, hy + 44]], 4), { width: 3, amount: 1.2, speed: 150, taper: K.taperBoth, scatter: 0, rest: 0.05 }));
  // Whiskers last: pale on the night side, dark across the lit fur.
  for (const [dy, a] of [[-4, -0.12], [8, 0.04], [20, 0.2]]) {
    const x0 = hx - 44;
    const y0 = hy + 36 + dy * 0.4;
    acts.push(carve([[x0, y0], [x0 - 60, y0 + dy + a * 60], [x0 - 120, y0 + dy * 1.8 + a * 130]], { width: 3.5, strength: 0.9, speed: 500, rim: 0.1, taper: (u) => 1 - 0.8 * u, rest: 0.02 }));
    const x1 = hx + 44;
    acts.push(pour([[x1, y0], [x1 + 60, y0 + dy + a * 60], [x1 + 110, y0 + dy * 1.8 + a * 120]], { width: 3, amount: 1, speed: 500, taper: (u) => 1 - 0.8 * u, scatter: 0, rest: 0.02 }));
  }
  return acts;
}
