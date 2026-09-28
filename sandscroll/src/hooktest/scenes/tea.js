import { spline, ellipse, arc, measure, pointAt, clamp, smoothstep, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 如鱼得水 — a bowl of green tea seen from above glows on the light table, long leaves unfurling
// in it. The palm stirs round the largest leaf and it comes back as a red-and-white koi: the
// blade becomes the body, the midrib the spine, and the leaf's tip the tail that flicks.
// Portrait 1080x1920, variant B: the cut opens mid-stir, the koi's red head already out of the
// leaf while the rest of it is still leaf.
const CX = 510;
const CY = 1012;
const RIM = 402; // outer edge of the lip
const LIP = 376; // inner edge of the lip
const TEA = 345; // edge of the tea

// The koi seen from above: body length (nose to tail root), half-width at the shoulders, tail
// fin length, heading at the nose (screen radians, nose toward tail), how far the body turns
// by the tail root, the tail fin's flick back against that turn, and where its middle lies.
const KOI = { len: 430, w: 68, tail: 165, head: 0.35, bend: 1.4, flick: -1.0, centre: [505, 975] };

// The small leaves floating round it: centre, direction (base to tip), length, width, bow, curl.
const LEAVES = [
  { c: [690, 818], a: -2.45, L: 210, w: 76, bow: 0.07, curl: 0.5 },
  { c: [352, 1150], a: -0.35, L: 204, w: 78, bow: -0.08, curl: 0 },
  { c: [772, 1072], a: -1.7, L: 168, w: 62, bow: 0.1, curl: 0.3 },
];

export default {
  id: 'tea',
  variant: 'B',
  hookMark: 'stir2',
  hookOffset: 0.05,
  hook: { en: 'Tea leaves → KOI', lines: ['Tea leaves →', 'KOI'], cn: '一片茶叶，一条锦鲤' },
  trend: 'Chinamaxxing (Chinese tea culture is one of its staples; the koi stands for luck)',
  accent: '锦鲤 (the koi’s red head and saddle patches, kohaku markings)',
  music: 'river',
  title: { cn: '茶中锦鲤', en: 'Tea Leaf Koi' },
  theme: '茶文化 · 锦鲤好运（Chinamaxxing 热点）',
  description: '一碗绿茶里茶叶正慢慢舒展，掌心一搅，最大的那片茶叶化作一条红白锦鲤，在茶汤里摆尾游开。',
  payoff: { en: 'Sip slow. Swim free.', cn: '一盏清茶，如鱼得水' },
  inscription: { columns: ['如鱼得水'], note: '成语，典出《三国志·蜀书·诸葛亮传》“孤之有孔明，犹鱼之有水也”' },
  seal: '茶',
  twist: '茶碗里最大的一片茶叶被掌心一搅，化作一条红白锦鲤',
  build(stage, rng) {
    const acts = [];
    const koi = koiShape();
    const hero = teaLeaf(koi.leafBase, koi.leafTip, 168, { bow: koi.leafBow, teeth: 26 });
    const small = LEAVES.map(({ c, a, L, w, bow, curl }) => {
      const dx = (Math.cos(a) * L) / 2;
      const dy = (Math.sin(a) * L) / 2;
      return teaLeaf([c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy], w, { bow, curl, teeth: 15 });
    });

    // Picture A: the bowl's rim in one bright stroke, the tea, then the leaves unfurling in it.
    const [bowlActs, bowlDetails] = bowl(stage);
    acts.push(...bowlActs);
    acts.push(...leaf(stage, hero, { strength: 0.8, duration: 1.0, veins: true }));
    acts.push(...bowlDetails);
    for (const l of small) acts.push(...leaf(stage, l, { strength: 0.78, duration: 0.4, quick: true }));
    const read = K.wait(0.45);
    read.mark = 'A';
    acts.push(read);

    // Twist: the palm stirs round the big leaf from its stalk to its tip. The koi's head comes
    // up red first, then the rest of the leaf is stirred into its body and the tail flicks.
    const guard = leafGuard(stage, small);
    const target = stirTarget(stage, koi, guard);
    acts.push(...stir(stage, hero, -0.04, 0.5, target, 'twist'));
    acts.push(...koiHead(stage, koi));
    acts.push(...stir(stage, hero, 0.42, 1.04, target, 'stir2'));
    acts.push(...koiBody(stage, koi, guard));
    acts.push(...ripples(koi));

    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 626, size: 56, mode: 'carve', strength: 0.9, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 950, 902, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// ---------------------------------------------------------------- the bowl and the tea

// Tea liquor: mid amber, glowing in the middle; the porcelain wall above it pale, lit from the
// upper left and shaded toward the lower right.
function bowlLevel(stage) {
  const s = stage.s;
  const tex = stage.mottle(1, 0.07, 0.02, 41);
  return (X, Y) => {
    const x = X / s - CX;
    const y = Y / s - CY;
    const r = Math.hypot(x, y);
    if (r > TEA) {
      const lit = 0.5 + 0.5 * Math.cos(Math.atan2(y, x) + 2.3);
      const k = clamp((r - TEA) / (LIP - TEA), 0, 1);
      return (0.5 - 0.26 * lit + 0.12 * k) * tex(X, Y);
    }
    const q = r / TEA;
    return (0.86 + 0.34 * q * q) * tex(X, Y);
  };
}

function bowl(stage) {
  const acts = [];
  const a0 = -Math.PI * 0.8;
  // The opening: the rim, one fast glowing circle closing exactly on itself (no sand ridge, so
  // the join leaves no mark).
  const rim = K.carve(arc(CX, CY, (RIM + LIP) / 2, a0, a0 + TAU - 0.007, 180), { width: RIM - LIP, strength: 0.95, speed: 2000, rim: 0, taper: K.even, rest: 0.05 });
  rim.mark = 'open';
  acts.push(rim);
  // The tea fills the bowl from the middle outward, the wall catching the light last.
  acts.push(K.reveal((st) => st.mask(ellipse(CX, CY, LIP, LIP, 0, 140), { feather: 1 }), { op: 'set', level: bowlLevel(stage), order: 'out', duration: 1.0, jitter: 0.03, rest: 0.05 }));
  // The edge of the tea: a fine bright meniscus.
  acts.push(K.carve(arc(CX, CY, TEA, a0, a0 + TAU - 0.003, 160), { width: 5, strength: 0.75, speed: 3000, rim: 0, taper: K.even, rest: 0.03 }));
  // Details once the first leaf is in: a fine line of sand where the lip turns down into the
  // wall, and a thin shadow inside the meniscus at the far side.
  const details = [
    K.pour(arc(CX, CY, LIP + 1, a0 + 1, a0 + 1 + TAU - 0.004, 180), { width: 4, amount: 0.5, speed: 3200, taper: K.even, scatter: 0, rest: 0.03 }),
    K.pour(arc(CX, CY, TEA - 7, Math.PI * 0.05, Math.PI * 0.95, 60), { width: 7, amount: 0.35, speed: 2600, taper: K.taperBoth, scatter: 0, rest: 0.03 }),
  ];
  return [acts, details];
}

// ---------------------------------------------------------------- leaves

// A tea leaf along a gently bowed midrib from `base` to `tip`: an elliptic blade widest a third
// of the way up, finely serrated, with a drawn-out tip and a short stalk. `bow` bends the midrib
// (fraction of the length); `curl` (0..1) rolls one edge under, as a leaf still unfurling.
function teaLeaf(base, tip, width, { bow = 0, curl = 0, teeth = 16 } = {}) {
  const [bx, by] = base;
  const [tx, ty] = tip;
  const L = Math.hypot(tx - bx, ty - by);
  const ux = (tx - bx) / L;
  const uy = (ty - by) / L;
  const P = (u) => {
    const b = bow * L * 4 * u * (1 - u);
    return [bx + ux * L * u - uy * b, by + uy * L * u + ux * b];
  };
  const N = (u) => {
    const [x0, y0] = P(u - 0.003);
    const [x1, y1] = P(u + 0.003);
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [-(y1 - y0) / l, (x1 - x0) / l];
  };
  const at = (u, v) => {
    const [x, y] = P(u);
    const [nx, ny] = N(u);
    return [x + nx * v, y + ny * v];
  };
  const prof = (u) => (Math.pow(clamp(u, 0, 1), 0.6) * Math.pow(clamp(1 - u, 0, 1), 1.25)) / 0.312;
  const hw = (u, side) => {
    let w = (width / 2) * prof(u);
    if (side < 0) w *= 1 - 0.5 * curl;
    if (teeth && u > 0.12 && u < 0.93) w *= 1 + 0.05 * ((u * teeth) % 1);
    return w;
  };
  const n = 180;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    left.push(at(u, hw(u, 1)));
    right.push(at(u, -hw(u, -1)));
  }
  const outline = ccw([...left, ...right.reverse()]);
  const veins = [];
  for (let i = 0; i < 7; i++) {
    const u0 = 0.1 + 0.11 * i;
    for (const sg of [1, -1]) {
      const w = (u) => hw(u, sg);
      veins.push(spline([at(u0, 0), at(u0 + 0.05, sg * 0.42 * w(u0 + 0.05)), at(u0 + 0.12, sg * 0.74 * w(u0 + 0.12)), at(u0 + 0.2, sg * 0.84 * w(u0 + 0.2))], 5));
    }
  }
  const midrib = [];
  for (let i = 0; i <= 40; i++) midrib.push(P((i / 40) * 0.97));
  const stalk = [P(-0.055), P(0.02)];
  // The rolled edge: a fold line just inside the narrow side.
  const fold = [];
  if (curl > 0) for (let i = 4; i <= 36; i++) fold.push(at(i / 40, -hw(i / 40, -1) * 0.55));
  const order = (s) => (X, Y) => ((X / s - bx) * ux + (Y / s - by) * uy) / L;
  return { outline, veins, midrib, stalk, fold, P, order };
}

function leaf(stage, l, { strength, duration, veins = false, quick = false }) {
  const acts = [
    K.reveal((st) => st.mask(l.outline, { feather: 0.7 }), { op: 'carve', strength, order: l.order(stage.s), duration, jitter: 0.04, rest: 0.03 }),
    K.carve(l.stalk, { width: 8, strength: 0.9, speed: 500, rim: 0.2, taper: (u) => 1 - 0.4 * u, rest: 0.01 }),
    K.carve(l.midrib, { width: quick ? 4.5 : 7, strength: 0.95, speed: quick ? 1300 : 900, rim: 0.4, taper: (u) => 1 - 0.75 * u, rest: 0.02 }),
  ];
  if (l.fold.length) acts.push(K.pour(l.fold, { width: 4.5, amount: 0.5, speed: 1300, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
  if (veins) {
    const ribbons = l.veins.map((v) => ribbon(v, 3.6, 1.2));
    acts.push(K.reveal((st) => st.mask(ribbons, { feather: 0.4 }), { op: 'carve', strength: 0.85, order: l.order(stage.s), duration: 0.45, jitter: 0.02, rest: 0.03 }));
  }
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
  return ccw([...L, ...R.reverse()]);
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

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ---------------------------------------------------------------- the koi

// The koi from above. Its spine turns steadily from the nose to the root of the tail; t runs
// 0 (nose) .. 1 (tail root). The leaf it grows from lies along the same line, half as bent,
// from just behind the nose to where the tail fin would end if it did not flick.
function koiShape() {
  const { len, w: W, tail: TL, head, bend, flick, centre } = KOI;
  const n = 160;
  const raw = [[0, 0]];
  for (let i = 1; i <= n; i++) {
    const a = head + bend * ((i - 0.5) / n);
    const [x, y] = raw[i - 1];
    raw.push([x + (Math.cos(a) * len) / n, y + (Math.sin(a) * len) / n]);
  }
  const aR = head + bend;
  const root0 = raw[n];
  const straightTip = [root0[0] + Math.cos(aR) * TL * 0.95, root0[1] + Math.sin(aR) * TL * 0.95];
  // Centre the koi (its spine, and the tail as a quarter share) on KOI.centre.
  let sx = 0;
  let sy = 0;
  for (const [x, y] of raw) {
    sx += x;
    sy += y;
  }
  const ox = centre[0] - (sx / raw.length + straightTip[0] * 0.25) / 1.25;
  const oy = centre[1] - (sy / raw.length + straightTip[1] * 0.25) / 1.25;
  const pts = raw.map(([x, y]) => [x + ox, y + oy]);
  const m = measure(pts);
  const frame = (t) => {
    const [px, py, tx, ty] = pointAt(m, clamp(t, 0, 1) * m.length);
    return { x: px, y: py, tx, ty, nx: -ty, ny: tx };
  };
  const at = (t, v) => {
    const p = frame(t);
    return [p.x + p.nx * v, p.y + p.ny * v];
  };
  // Half-width: a rounded blunt head, broad shoulders, a plump body tapering to the tail root.
  const prof = (t) => (t < 0.28 ? Math.sqrt(Math.max(0, 1 - (1 - t / 0.28) ** 2)) : 1 - 0.72 * Math.pow(smoothstep(0.28, 1, t), 1.35));
  const hw = (t) => W * prof(t);
  const part = (t0, t1, k = 1) => {
    const a = [];
    const b = [];
    for (let i = 0; i <= 70; i++) {
      const t = t0 + ((t1 - t0) * i) / 70;
      a.push(at(t, k * hw(t)));
      b.push(at(t, -k * hw(t)));
    }
    return ccw([...a, ...b.reverse()]);
  };
  const body = part(0, 1);

  // Tail fin: a broad two-lobed fan from the root, its centre line swinging by `flick`.
  const root = frame(1);
  const a0 = Math.atan2(root.ty, root.tx);
  const centreLine = [[root.x, root.y]];
  const dirs = [a0];
  for (let i = 1; i <= 40; i++) {
    const a = a0 + flick * Math.pow((i - 0.5) / 40, 1.4);
    const [x, y] = centreLine[i - 1];
    centreLine.push([x + (Math.cos(a) * TL) / 40, y + (Math.sin(a) * TL) / 40]);
    dirs.push(a0 + flick * Math.pow(i / 40, 1.4));
  }
  const tailAt = (u, v) => {
    const i = clamp(u, 0, 1) * 40;
    const i0 = Math.floor(Math.min(39, i));
    const f = i - i0;
    const x = centreLine[i0][0] + (centreLine[i0 + 1][0] - centreLine[i0][0]) * f;
    const y = centreLine[i0][1] + (centreLine[i0 + 1][1] - centreLine[i0][1]) * f;
    const a = dirs[i0] + (dirs[i0 + 1] - dirs[i0]) * f;
    const spread = W * (0.28 + 1.0 * Math.pow(Math.sin((clamp(u, 0, 1) * Math.PI) / 2), 0.8));
    return [x - Math.sin(a) * v * spread, y + Math.cos(a) * v * spread];
  };
  // Outline: the outer edges out to rounded lobe tips, then the trailing edge in to a soft notch.
  const edgeU = (v) => 0.74 + 0.26 * Math.pow(Math.sin((Math.min(1, Math.abs(v)) * Math.PI) / 2), 0.7);
  const tailPoly = [];
  for (let i = 0; i <= 24; i++) {
    const u = (i / 24) * 0.97;
    tailPoly.push(tailAt(u, 1 - 0.2 * smoothstep(0.78, 0.97, u) ** 2));
  }
  for (let i = 1; i < 36; i++) {
    const v = 0.8 - (1.6 * i) / 36;
    tailPoly.push(tailAt(edgeU(v) * (1 - 0.02 * (1 - Math.abs(v))), v));
  }
  for (let i = 24; i >= 0; i--) {
    const u = (i / 24) * 0.97;
    tailPoly.push(tailAt(u, -(1 - 0.2 * smoothstep(0.78, 0.97, u) ** 2)));
  }
  const tail = ccw(tailPoly);
  const rays = [];
  for (const v of [-0.72, -0.44, -0.16, 0.16, 0.44, 0.72]) {
    const r = [];
    const end = edgeU(v) - 0.06;
    for (let i = 0; i <= 12; i++) {
      const u = 0.05 + (i / 12) * (end - 0.05);
      r.push(tailAt(u, v * (0.35 + 0.65 * (i / 12))));
    }
    rays.push(r);
  }
  // Fan order for the flick: the fin sweeps open from the straight line toward the swing.
  const tailOrder = (s) => (X, Y) => {
    let a = Math.atan2(Y / s - root.y, X / s - root.x) - a0;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return (a * Math.sign(flick) + 1.6) / 3.2;
  };

  // Fins: rounded fans hinged at the body edge, swept back.
  const fan = (t, sg, flen, spread, sweep) => {
    const p = frame(t);
    const base = at(t, sg * hw(t) * 0.8);
    const back = Math.atan2(p.ty, p.tx);
    const out = Math.atan2(sg * p.ny, sg * p.nx);
    const dir = Math.atan2(Math.sin(back) * sweep + Math.sin(out) * (1 - sweep), Math.cos(back) * sweep + Math.cos(out) * (1 - sweep));
    const poly = [at(t - 0.05, sg * hw(t - 0.05) * 0.7)];
    for (let i = 0; i <= 14; i++) {
      const a = dir - spread + (2 * spread * i) / 14;
      const l = flen * (0.72 + 0.28 * Math.pow(Math.sin((Math.PI * i) / 14), 0.7));
      poly.push([base[0] + l * Math.cos(a), base[1] + l * Math.sin(a)]);
    }
    poly.push(at(t + 0.08, sg * hw(t + 0.08) * 0.7));
    const fr = [];
    for (let k = 0; k < 5; k++) {
      const a = dir - spread * 0.8 + (1.6 * spread * k) / 4;
      fr.push([base, [base[0] + flen * 0.86 * Math.cos(a), base[1] + flen * 0.86 * Math.sin(a)]]);
    }
    return { poly: ccw(poly), rays: fr };
  };
  const pectoral = [fan(0.27, 1, 1.2 * W, 0.42, 0.52), fan(0.27, -1, 1.2 * W, 0.42, 0.52)];
  const pelvic = [fan(0.58, 1, 0.62 * W, 0.28, 0.66), fan(0.58, -1, 0.62 * W, 0.28, 0.66)];

  // Head: eyes at the sides, gill covers, a pair of short barbels at the snout.
  const eyes = [at(0.1, 0.8 * hw(0.1)), at(0.1, -0.8 * hw(0.1))];
  const gills = [1, -1].map((sg) => spline([at(0.2, sg * hw(0.2) * 0.98), at(0.232, sg * hw(0.232) * 0.7), at(0.25, sg * hw(0.25) * 0.36)], 6));
  const nose = frame(0);
  const barbels = [1, -1].map((sg) => {
    const [bx, by] = at(0.02, sg * 13);
    return spline([[bx, by], [bx - nose.tx * 8 + nose.nx * sg * 7, by - nose.ty * 8 + nose.ny * sg * 7], [bx - nose.tx * 9 + nose.nx * sg * 19, by - nose.ty * 9 + nose.ny * sg * 19]], 5);
  });
  // Scales: a fine net of scallops, their free edges toward the tail, down the back.
  const scales = [];
  for (let t = 0.3, row = 0; t <= 0.8; t += 0.034, row++) {
    for (let f = -0.72 + (row % 2) * 0.16; f <= 0.73; f += 0.32) {
      const [cx, cy] = at(t, f * hw(t));
      const p = frame(t);
      const back = Math.atan2(p.ty, p.tx);
      scales.push(crescent(cx, cy, 0.1 * W + 2 * (1 - t), back - 1.2, back + 1.2, 1.8));
    }
  }

  // Kohaku markings: a red cap over the head between the eyes, a broad saddle down the back.
  const patch = (t0, t1, width, lobes, seed) => {
    const out = [];
    const k = 48;
    for (const sg of [1, -1]) {
      const side = [];
      for (let i = 0; i <= k; i++) {
        const t = t0 + ((t1 - t0) * i) / k;
        const e = Math.pow(Math.sin((Math.PI * i) / k), 0.34);
        const wob = 1 + lobes * (Math.sin(i * 0.55 + seed * sg) * 0.6 + Math.sin(i * 1.7 + seed * 3 * sg) * 0.4);
        side.push(at(t, sg * Math.min(0.96, width * e * wob) * hw(t)));
      }
      out.push(...(sg > 0 ? side : side.reverse()));
    }
    return ccw(out);
  };
  const patches = [patch(0.045, 0.235, 0.66, 0.05, 1.3), patch(0.33, 0.73, 0.94, 0.09, 4.1)];

  // The leaf: from just behind the nose to the unflicked tail tip, half as bent.
  const leafBase = at(0.01, 0);
  const leafTip = [straightTip[0] + ox, straightTip[1] + oy];
  const dx = leafTip[0] - leafBase[0];
  const dy = leafTip[1] - leafBase[1];
  const chord = Math.hypot(dx, dy);
  const mid = at(0.6, 0);
  const sag = ((mid[0] - (leafBase[0] + leafTip[0]) / 2) * -dy + (mid[1] - (leafBase[1] + leafTip[1]) / 2) * dx) / chord;
  const leafBow = (0.5 * sag) / chord;

  // Nearest point of the spine to a field pixel: t along the body and v / half-width across it.
  const coords = (s) => {
    const N = 120;
    const S = [];
    for (let i = 0; i <= N; i++) {
      const p = frame(i / N);
      S.push([p.x * s, p.y * s, p.nx, p.ny]);
    }
    return (X, Y) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i <= N; i++) {
        const d = (X - S[i][0]) ** 2 + (Y - S[i][1]) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      const [x0, y0, nx, ny] = S[best];
      const t = best / N;
      return [t, ((X - x0) * nx + (Y - y0) * ny) / s / Math.max(4, hw(t))];
    };
  };
  const order = (s) => {
    const uv = coords(s);
    return (X, Y) => uv(X, Y)[0];
  };
  const shapes = [body, tail, ...pectoral.map((f) => f.poly), ...pelvic.map((f) => f.poly)];
  const covers = (x, y, pad = 0) => shapes.some((p) => inside(p, x, y) || (pad > 0 && [[pad, 0], [-pad, 0], [0, pad], [0, -pad]].some(([ex, ey]) => inside(p, x + ex, y + ey))));
  const tailTip = tailAt(0.92, 0);
  return { at, hw, part, body, tail, rays, tailOrder, tailTip, pectoral, pelvic, eyes, gills, barbels, scales, patches, leafBase, leafTip, leafBow, order, coords, covers };
}

function crescent(cx, cy, r, a0, a1, w) {
  const outer = arc(cx, cy, r + w / 2, a0, a1, 10);
  const inner = arc(cx, cy, r - w / 2, a1, a0, 10);
  return ccw([...outer, ...inner]);
}

// How much the palm must leave a field pixel alone: 1 on and just round the small leaves.
function leafGuard(stage, small) {
  let keep = null;
  return (X, Y) => {
    keep ??= stage.mask(small.map((l) => l.outline), { feather: 5 }).map((a) => Math.min(1, a * 2));
    return keep.at(X, Y);
  };
}

// What the stirring palm leaves behind: tea everywhere, except a soft pale koi where the leaf
// was. The wall, the rim and the other leaves are left as they are.
function stirTarget(stage, koi, guard) {
  const s = stage.s;
  const tea = bowlLevel(stage);
  let soft = null;
  return (X, Y) => {
    soft ??= stage.mask([koi.body, koi.tail, ...koi.pectoral.map((f) => f.poly)], { feather: 6 });
    const r = Math.hypot(X / s - CX, Y / s - CY);
    const d = stage.field.d[Y * stage.field.w + X];
    const k = soft.at(X, Y);
    const t = tea(X, Y) * (1 - k) + 0.3 * k;
    const hold = Math.max(smoothstep(TEA - 20, TEA - 5, r), guard(X, Y));
    return t + (d - t) * hold;
  };
}

// The palm stirs in small circles while it travels along the leaf from u0 to u1.
function stir(stage, hero, u0, u1, target, mark) {
  const loops = 3.0 * (u1 - u0) + 0.8;
  const path = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const u = u0 + (u1 - u0) * f;
    const th = -Math.PI / 2 + f * TAU * loops;
    const [x, y] = hero.P(u);
    const r = 72 * Math.sin(Math.PI * Math.min(1, f * 1.25 + 0.12));
    path.push([x + r * Math.cos(th), y + r * Math.sin(th)]);
  }
  const act = K.palm(path, { width: 190, speed: 640, target, rate: 0.9, streak: stage.streaks[1], hard: 0.3, rest: 0.05 });
  act.mark = mark;
  return [act];
}

// The shading of the koi's body: bright along the back, a little deeper toward the flanks.
function bodyLevel(koi, s) {
  let uv = null;
  return (X, Y) => {
    uv ??= koi.coords(s);
    const [, v] = uv(X, Y);
    return 0.05 + 0.2 * smoothstep(0.55, 1.05, Math.abs(v));
  };
}

// The head comes up out of the stirred leaf, its red cap glazed on as it is lit; the lit part
// fades into the soft body behind the gills.
function koiHead(stage, koi) {
  const s = stage.s;
  const acts = [];
  acts.push(K.tint(stage, [koi.patches[0]], { fadeIn: 0.45 }));
  let uv = null;
  const head = K.reveal(
    (st) => {
      uv = koi.coords(s);
      return st.mask(koi.part(0, 0.46), { feather: 0.8 }).map((a, X, Y) => a * smoothstep(0.46, 0.3, uv(X, Y)[0]));
    },
    { op: 'set', level: bodyLevel(koi, s), order: koi.order(s), duration: 0.8, jitter: 0.02, rest: 0.03 },
  );
  head.mark = 'koi';
  acts.push(head);
  acts.push(K.reveal((st) => st.mask(koi.eyes.map(([x, y]) => ellipse(x, y, 7.5, 7.5, 0, 16)), { feather: 0.5 }), { op: 'set', level: 2.6, order: 'out', duration: 0.25, rest: 0.03 }));
  return acts;
}

function koiBody(stage, koi, guard) {
  const s = stage.s;
  const acts = [];
  // The saddle's red goes on just before the rest of the body is lit.
  acts.push(K.tint(stage, [koi.patches[1]], { fadeIn: 0.45 }));
  acts.push(K.reveal((st) => st.mask(koi.part(0.3, 1), { feather: 0.8 }), { op: 'set', level: bodyLevel(koi, s), order: koi.order(s), duration: 0.9, jitter: 0.02, rest: 0.03 }));
  acts.push(...tidy(stage, koi, guard));
  // The tail flicks: the fin fans open from the leaf's line toward the swing, rays after.
  const flick = K.reveal((st) => st.mask(koi.tail, { feather: 0.9 }), { op: 'set', level: 0.36, order: koi.tailOrder(s), duration: 0.6, jitter: 0.03, rest: 0.02 });
  flick.mark = 'flick';
  acts.push(flick);
  acts.push(K.reveal((st) => st.mask(koi.rays.map((r) => ribbon(r, 3.6, 1.2)), { feather: 0.4 }), { op: 'carve', strength: 0.6, order: 'out', duration: 0.3, jitter: 0.02, rest: 0.02 }));
  // Pectoral and pelvic fins, translucent with bright rays, laid beside the body, not over it.
  const fins = (list) => (st) => {
    const b = st.mask(koi.body, { feather: 0.8 });
    return st.mask(list.map((f) => f.poly), { feather: 0.8 }).map((a, X, Y) => a * (1 - b.at(X, Y)));
  };
  acts.push(K.reveal(fins(koi.pectoral), { op: 'set', level: 0.38, order: 'out', duration: 0.45, jitter: 0.03, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(koi.pectoral.flatMap((f) => f.rays.map((r) => ribbon(r, 3.2, 1))), { feather: 0.4 }), { op: 'carve', strength: 0.65, order: 'out', duration: 0.3, jitter: 0.02, rest: 0.02 }));
  acts.push(K.reveal(fins(koi.pelvic), { op: 'set', level: 0.42, order: 'out', duration: 0.25, jitter: 0.03, rest: 0.02 }));
  // Gill covers, barbels, and a fine net of scales, strongest where the saddle is.
  for (const g of koi.gills) acts.push(K.pour(g, { width: 3, amount: 0.45, speed: 700, scatter: 0, rest: 0.01 }));
  for (const b of koi.barbels) acts.push(K.carve(b, { width: 3, strength: 0.8, speed: 300, rim: 0.1, taper: K.taperEnd, rest: 0.01 }));
  let uv = null;
  acts.push(
    K.reveal((st) => st.mask(koi.scales, { feather: 0.3 }), {
      op: 'add',
      amount: (X, Y) => {
        uv ??= koi.coords(s);
        const t = uv(X, Y)[0];
        return 0.08 + 0.18 * smoothstep(0.3, 0.36, t) * smoothstep(0.76, 0.7, t);
      },
      order: koi.order(s),
      duration: 0.5,
      jitter: 0.02,
      rest: 0.05,
    }),
  );
  return acts;
}

// The palm runs down both flanks, wiping what is left of the leaf back into the tea; the koi
// itself (body, fins, tail) and the other leaves are left untouched.
function tidy(stage, koi, guard) {
  const tea = bowlLevel(stage);
  let k = null;
  const target = (X, Y) => {
    k ??= stage.mask([koi.body, koi.tail, ...koi.pectoral.map((f) => f.poly), ...koi.pelvic.map((f) => f.poly)], { feather: 2 }).map((a) => Math.min(1, a * 2));
    const d = stage.field.d[Y * stage.field.w + X];
    const m = Math.max(k.at(X, Y), guard(X, Y));
    return tea(X, Y) * (1 - m) + d * m;
  };
  const acts = [];
  for (const sg of [-1, 1]) {
    const path = [];
    for (let i = 0; i <= 40; i++) {
      const t = 0.04 + (i / 40) * 0.98;
      path.push(koi.at(t, sg * (koi.hw(t) + 48)));
    }
    acts.push(K.palm(path, { width: 116, speed: 1300, target, rate: 0.95, streak: stage.streaks[2], hard: 0.45, rest: 0.02 }));
  }
  return acts;
}

// Rings spreading in the tea from where the tail flicked: broken arcs, kept off the koi and
// inside the bowl.
function ripples(koi) {
  const [x, y] = koi.tailTip;
  const acts = [];
  for (const r of [54, 96, 140]) {
    let run = [];
    const runs = [];
    let first = null;
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * TAU;
      const p = [x + r * Math.cos(a), y + r * Math.sin(a)];
      if (i === 0) first = p;
      const ok = Math.hypot(p[0] - CX, p[1] - CY) < TEA - 18 && !koi.covers(p[0], p[1], 16);
      if (ok) run.push(p);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) {
      // A ring that is open across angle 0 is one arc, not two.
      if (runs.length && runs[0][0] === first) runs[0] = [...run, ...runs[0]];
      else runs.push(run);
    }
    for (const pts of runs) {
      if (pts.length > 6) acts.push(K.carve(pts, { width: 5.5, strength: 0.62, speed: 1600, rim: 0.25, taper: K.taperBoth, rest: 0.02 }));
    }
  }
  return acts;
}
