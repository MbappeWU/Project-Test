import { spline, ellipse, clamp, smoothstep, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 采菊东篱下 — a chrysanthemum seen three-quarters from above opens petal by petal: a cupped,
// incurved heart, then long tubular petals that droop and hook at the tips, on a stem with two
// lobed leaves. A palm smears the stem and leaves into porcelain: the bloom was floating in a
// cup of chrysanthemum tea all along, with ripples and a breath of steam. Portrait 1080x1920.
export default {
  id: 'chrysanthemum',
  music: 'pine',
  title: { cn: '采菊', en: 'Chrysanthemum Bloom' },
  theme: '节日 · 重阳（10 月 18 日）',
  hook: { en: 'Watch a flower bloom in sand', cn: '一朵菊花，慢慢开' },
  payoff: { en: '…and now it’s tea.', cn: '重阳节，喝一杯菊花茶' },
  inscription: { columns: ['采菊东篱下'], note: '晋 · 陶渊明《饮酒·其五》' },
  seal: '重阳',
  twist: '层层绽放的菊花原来漂在一杯菊花茶里',
  opening(stage) {
    return stage.mottle(NIGHT, 0.1, 0.01, 3);
  },
  build(stage, rng) {
    const acts = [];
    const petals = bloomPlan(rng);
    // ---- Picture A: the bloom opens, then its stem and leaves ----
    acts.push(...bloom(petals));
    acts.push(...stemAndLeaves(stage));
    acts.push(K.wait(3.2));
    // ---- Twist: the palm turns stem and leaves into a cup of tea around the flower ----
    acts.push(...cup(stage, rng));
    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 952, y: 440, size: 54, mode: 'carve', strength: 0.9, perChar: 1.1 }));
    acts.push(...K.seal(stage, this.seal, 952, 790, { size: 58, seed: 9 }));
    return acts;
  },
};

// The flower head sits where the tea surface will be; the view is three-quarters from above,
// so the flower's plane is squashed vertically.
const C = [540, 896];
const FLAT = 0.5;
const NIGHT = 2.6;
const CUP = { cx: 540, rimY: 966, rx: 382, ry: 142, footY: 1326 };
// Lowest point a petal may hang to, so the whole bloom later floats inside the rim.
const DROP = 186;
// Overall size of the bloom.
const SIZE = 1.27;

// A petal path: leaves the heart at radius r0 in direction phi, runs length L in the flower's
// plane (bending by `bend`), droops toward the viewer and curls its tip into a hook.
function petalPath({ phi, r0, L, bend, droop, lift, hook }) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const a = phi + bend * u * u;
    const r = r0 + L * u;
    let x = C[0] + r * Math.cos(a);
    let y = C[1] + r * Math.sin(a) * FLAT + droop * L * u * u - lift * L * Math.sin(Math.PI * u) * 0.5;
    if (u > 0.72) {
      const h = ((u - 0.72) / 0.28) ** 2 * hook * L * 0.22;
      x += -Math.sin(a) * h;
      y += Math.cos(a) * h * FLAT - Math.abs(h) * 0.6;
    }
    // Petals hanging toward the viewer ease off before the rim: a soft limit, not a cut.
    x = C[0] + (x - C[0]) * SIZE;
    y = C[1] + (y - C[1]) * SIZE;
    if (y > C[1]) y = C[1] + DROP * Math.tanh((y - C[1]) / DROP);
    pts.push([x, y]);
  }
  return pts;
}

// Rings from the heart outward. Irregular angles, lengths and curls keep it a living flower,
// not a flat radial disc: back petals are short and stand up, front and side petals hang.
function bloomPlan(rng) {
  const rings = [
    { n: 11, r0: 8, L: [34, 50], w: 17, bend: 1.1, droop: [-0.1, 0], lift: [0.6, 0.9], hook: [0, 0.3], crease: false },
    { n: 13, r0: 28, L: [58, 80], w: 21, bend: 0.7, droop: [-0.05, 0.08], lift: [0.4, 0.7], hook: [0.2, 0.6], crease: false },
    { n: 16, r0: 62, L: [96, 132], w: 25, bend: 0.45, droop: [0.1, 0.28], lift: [0.1, 0.35], hook: [0.3, 0.9], crease: true },
    { n: 19, r0: 100, L: [140, 200], w: 26, bend: 0.4, droop: [0.25, 0.6], lift: [0, 0.15], hook: [0.5, 1.4], crease: true },
  ];
  const out = [];
  // The hero stands up out of the heart, dead centre, and curls over at the tip.
  const hero = { phi: -1.62, w: 56, ring: 3, crease: false, pts: spline([[540, 910], [514, 856], [506, 800], [526, 754], [568, 736], [606, 750], [616, 784]], 8) };
  for (const [k, ring] of rings.entries()) {
    const list = [];
    const rot = rng.float(0, TAU);
    for (let i = 0; i < ring.n; i++) {
      const phi = rot + ((i + rng.float(-0.3, 0.3)) * TAU) / ring.n;
      const back = Math.sin(phi) < -0.35;
      // The hero petal already hangs at the front left; leave its place free.
      if (k > 0 && Math.abs(Math.atan2(Math.sin(phi - hero.phi), Math.cos(phi - hero.phi))) < 0.3) continue;
      const side = rng.chance(0.5) ? 1 : -1;
      const front = Math.max(0, Math.sin(phi) + 0.25);
      list.push({
        phi,
        r0: ring.r0 * rng.float(0.85, 1.15),
        L: rng.float(...ring.L) * (back ? 0.72 : 1),
        bend: side * ring.bend * rng.float(0.4, 1),
        droop: back ? ring.droop[0] * 0.3 : rng.float(...ring.droop) * (0.45 + front),
        lift: rng.float(...ring.lift) * (back ? 1.6 : 1),
        hook: side * rng.float(...ring.hook),
        w: ring.w * rng.float(0.85, 1.15),
        crease: ring.crease && rng.chance(0.7),
        ring: k,
      });
    }
    // Back petals first, the front ones overlap them.
    list.sort((a, b) => Math.sin(a.phi) - Math.sin(b.phi));
    out.push(...list);
  }
  return { hero, petals: out };
}

const heroTaper = (u) => 0.4 + 0.6 * smoothstep(0, 0.25, u) * (1 - 0.62 * smoothstep(0.6, 1, u));
const petalTaper = (u) => 0.3 + 0.7 * smoothstep(0, 0.22, u) * (1 - 0.55 * smoothstep(0.7, 1, u));

function petal(p, first = false) {
  const pts = p.pts || petalPath(p);
  const acts = [];
  // A dark bed first, so a petal lying over another keeps its own edge.
  if (!first) acts.push(K.pour(pts, { width: p.w + 8, amount: p.ring > 0 ? 1.8 : 1.2, speed: 1400, taper: petalTaper, scatter: 0, hard: 0.5, rest: 0 }));
  acts.push(K.carve(pts, { width: p.w, strength: 0.97, speed: first ? 1100 : 1300, rim: 0.3, taper: first ? heroTaper : petalTaper, hard: first ? 0.65 : 0.55, rest: first ? 0.02 : 0.01 }));
  // The hero is carved twice down its core, so it glows at once.
  if (first) acts.push(K.carve(pts, { width: p.w * 0.55, strength: 0.95, speed: 1600, rim: 0, taper: heroTaper, hard: 0.5, rest: 0.02 }));
  // Tubular petals: a fine groove down one side.
  if (p.crease) {
    const off = p.w * 0.18;
    const crease = pts.slice(2, 12).map(([x, y], i, arr) => {
      const [nx, ny] = arr[Math.min(i + 1, arr.length - 1)];
      const [px, py] = arr[Math.max(i - 1, 0)];
      const dl = Math.hypot(nx - px, ny - py) || 1;
      return [x - ((ny - py) / dl) * off, y + ((nx - px) / dl) * off];
    });
    acts.push(K.pour(crease, { width: 2.2, amount: 0.35, speed: 1600, taper: K.taperBoth, scatter: 0, rest: 0 }));
  }
  return acts;
}

function bloom({ hero, petals }) {
  const acts = [];
  // The hook: one long glowing petal swept in a single stroke.
  acts.push(...petal(hero, true));
  // The heart lights up beside it at once; its incurved petals are then cut into that glow and
  // the rings open outward from the centre.
  acts.push(K.reveal((st) => st.mask(ellipse(C[0], C[1] - 10, 66, 42, 0, 32), { feather: 1.5, rough: 0.15, roughScale: 0.3 }), { op: 'carve', strength: 0.9, order: 'out', duration: 0.25, jitter: 0.08, rest: 0 }));
  for (const p of petals) acts.push(...petal(p));
  // A few tiny florets glinting deep in the heart.
  const dots = [];
  for (let i = 0; i < 7; i++) dots.push(ellipse(C[0] - 18 + i * 6, C[1] - 16 + (i % 2) * 6, 3.5, 3, 0, 8));
  acts.push(K.reveal((st) => st.mask(dots, { feather: 0.3 }), { op: 'carve', strength: 0.8, order: 'left', duration: 0.2, rest: 0.1 }));
  return acts;
}

// A chrysanthemum leaf: deeply lobed, drawn along a curved midrib from base to tip.
function leafPoly(base, angle, len, width, lobes = 3) {
  const left = [];
  const right = [];
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75) * (1 - 0.25 * t);
    const lobe = 0.62 + 0.38 * Math.pow(Math.abs(Math.sin(Math.PI * lobes * t + 0.4)), 0.6);
    const w = width * env * lobe;
    const bendY = Math.sin(Math.PI * t) * len * 0.08;
    const ax = t * len;
    for (const [side, arr] of [[1, left], [-1, right]]) {
      const ly = side * w + bendY;
      arr.push([base[0] + ax * ca - ly * sa, base[1] + ax * sa + ly * ca]);
    }
  }
  const mid = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const ax = t * len * 0.95;
    const ly = Math.sin(Math.PI * t) * len * 0.08;
    mid.push([base[0] + ax * ca - ly * sa, base[1] + ax * sa + ly * ca]);
  }
  return { poly: [...left, ...right.reverse()], mid };
}

const STEM = [[548, 1002], [560, 1080], [580, 1170], [596, 1250], [606, 1320]];
const LEAVES = [
  { base: [572, 1140], angle: Math.PI + 0.55, len: 230, width: 64 },
  { base: [594, 1232], angle: -0.35, len: 200, width: 56 },
];

function stemAndLeaves(stage) {
  const acts = [];
  const stem = spline(STEM, 8);
  acts.push(K.carve(stem, { width: 16, strength: 0.62, speed: 700, rim: 0.25, taper: (u) => 1 - 0.3 * u, rest: 0.05 }));
  for (const lf of LEAVES) {
    const { poly, mid } = leafPoly(lf.base, lf.angle, lf.len, lf.width);
    acts.push(K.reveal((st) => st.mask(poly, { feather: 0.7, rough: 0.06, roughScale: 0.3 }), { op: 'set', level: stage.mottle(0.95, 0.15, 0.03, 5), order: 'left', duration: 0.7, jitter: 0.05, rest: 0.03 }));
    acts.push(K.pour(poly, { width: 4, amount: 1.4, speed: 1800, taper: K.even, scatter: 0, rest: 0.02 }));
    acts.push(K.carve(mid, { width: 4, strength: 0.7, speed: 800, rim: 0.2, rest: 0.02 }));
    // Side veins toward the lobes.
    for (let i = 3; i < 11; i += 2) {
      const [x, y] = mid[i];
      const [x2, y2] = mid[i + 1];
      const dl = Math.hypot(x2 - x, y2 - y) || 1;
      const tx = (x2 - x) / dl;
      const ty = (y2 - y) / dl;
      for (const side of [1, -1]) {
        const vx = tx * 0.7 - ty * side * 0.7;
        const vy = ty * 0.7 + tx * side * 0.7;
        const vl = lf.width * 0.62 * Math.sin((Math.PI * i) / 12);
        acts.push(K.carve([[x, y], [x + vx * vl * 0.5 + tx * 6, y + vy * vl * 0.5 + ty * 6], [x + vx * vl + tx * 14, y + vy * vl + ty * 14]], { width: 2.4, strength: 0.5, speed: 900, rim: 0.1, rest: 0 }));
      }
    }
  }
  return acts;
}

// ---- The cup ----
const rimAt = (x, sign) => CUP.rimY + sign * CUP.ry * Math.sqrt(Math.max(0, 1 - ((x - CUP.cx) / CUP.rx) ** 2));

function bowlPoly() {
  const pts = [];
  for (let x = CUP.cx - CUP.rx; x <= CUP.cx + CUP.rx + 1e-6; x += 8) pts.push([x, rimAt(x, 1)]);
  const D = CUP.footY - CUP.rimY;
  const ctrl = [[CUP.cx + CUP.rx, CUP.rimY], [CUP.cx + CUP.rx - 14, CUP.rimY + 0.36 * D], [CUP.cx + 262, CUP.rimY + 0.7 * D], [CUP.cx + 140, CUP.footY - 8], [CUP.cx, CUP.footY], [CUP.cx - 140, CUP.footY - 8], [CUP.cx - 262, CUP.rimY + 0.7 * D], [CUP.cx - CUP.rx + 14, CUP.rimY + 0.36 * D], [CUP.cx - CUP.rx, CUP.rimY]];
  return { outline: [...pts, ...spline(ctrl, 8)], side: spline(ctrl, 8) };
}

// The rim ellipse from the back-left round the front to the back-right, open behind the bloom.
function lip(drx, dry, dy = 0) {
  const pts = [];
  const gap = 0.4;
  for (let i = 0; i <= 96; i++) {
    const a = -Math.PI / 2 - gap - ((TAU - 2 * gap) * i) / 96;
    pts.push([CUP.cx + (CUP.rx - drx) * Math.cos(a), CUP.rimY + dy + (CUP.ry - dry) * Math.sin(a)]);
  }
  return pts;
}

function cup(stage, rng) {
  const s = stage.s;
  const acts = [];
  const night = stage.mottle(NIGHT, 0.1, 0.01, 3);
  const { outline, side } = bowlPoly();
  // Porcelain lit from the left: a soft highlight band, deeper on the right and toward the foot.
  const tex = stage.mottle(1, 0.06, 0.02, 41);
  const porcelain = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const u = (x - CUP.cx) / CUP.rx;
    const v = clamp((y - CUP.rimY) / (CUP.footY - CUP.rimY), 0, 1);
    const hl = Math.exp(-(((u + 0.45) / 0.16) ** 2));
    return (1.2 + 0.6 * Math.max(0, u) ** 1.5 + 0.35 * Math.abs(u) ** 3 + 0.5 * v - 0.7 * hl) * tex(X, Y);
  };
  let bowlMask = null;
  const reshape = (X, Y) => (bowlMask && bowlMask.at(X, Y) > 0.5 ? porcelain(X, Y) : night(X, Y));
  // The palm drags the leaves and stem around into the round of a bowl.
  const strokes = [
    [[180, 1060], [250, 1200], [400, 1290], [540, 1305], [690, 1285], [830, 1190], [900, 1060]],
    [[860, 1120], [760, 1200], [540, 1235], [320, 1200], [220, 1120]],
    [[300, 1150], [420, 1170], [540, 1175], [660, 1170], [780, 1150]],
  ];
  acts.push(
    K.call((st) => {
      bowlMask = st.mask(outline, { feather: 1 });
    }),
  );
  for (const [i, pts] of strokes.entries()) {
    acts.push(K.palm(spline(pts, 8), { width: i === 2 ? 110 : 150, speed: 420, target: reshape, rate: 0.8, streak: stage.streaks[i % 3], hard: 0.3, rest: 0.03 }));
  }
  // The last of the stem is swept away under the foot.
  acts.push(K.palm([[560, 1380], [610, 1350], [650, 1320]], { width: 110, speed: 500, target: night, rate: 0.95, hard: 0.4, rest: 0.03 }));
  // Crisp porcelain body, then its contour.
  acts.push(K.reveal((st) => st.mask(outline, { feather: 0.8 }), { op: 'set', level: porcelain, order: 'down', duration: 2.6, jitter: 0.04, rest: 0.05 }));
  acts.push(K.pour(side, { width: 7, amount: 1.4, speed: 700, taper: K.even, scatter: 0, rest: 0.02 }));
  // A fine glaze line under the lip and the ring of the foot.
  const band = [];
  for (let x = CUP.cx - CUP.rx + 30; x <= CUP.cx + CUP.rx - 30; x += 10) band.push([x, rimAt(x, 1) + 34 - 10 * ((x - CUP.cx) / CUP.rx) ** 2]);
  acts.push(K.carve(band, { width: 3.5, strength: 0.55, speed: 1200, rim: 0.2, taper: K.taperBoth, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask([[CUP.cx - 118, CUP.footY - 12], [CUP.cx + 118, CUP.footY - 12], [CUP.cx + 108, CUP.footY + 20], [CUP.cx - 108, CUP.footY + 20]], { feather: 0.6 }), { op: 'set', level: 2.4, order: 'left', duration: 0.4, rest: 0.02 }));
  acts.push(K.carve([[CUP.cx - 104, CUP.footY - 4], [CUP.cx + 104, CUP.footY - 4]], { width: 3, strength: 0.6, speed: 900, taper: K.taperBoth, rest: 0.02 }));
  // The highlight stroke down the left of the bowl.
  acts.push(K.carve(spline([[CUP.cx - 200, CUP.rimY + 70], [CUP.cx - 190, CUP.rimY + 160], [CUP.cx - 150, CUP.rimY + 250]], 8), { width: 12, strength: 0.55, speed: 700, rim: 0.1, taper: K.taperBoth, rest: 0.03 }));

  // Tea: a warm glowing surface filling the rim, the floating flower left as it is.
  const teaTex = stage.mottle(1, 0.1, 0.02, 43);
  let leaves = null;
  const heart = (x, y) => Math.hypot((x - C[0]) / 152, (y - C[1] + 6) / 82);
  const footprint = (x, y) => Math.hypot((x - C[0]) / 298, (y - C[1] - 30) / 158);
  const tea = (X, Y) => {
    const x = X / s;
    const y = Y / s;
    const d = stage.field.d[Y * stage.field.w + X];
    const e = Math.hypot((x - CUP.cx) / CUP.rx, (y - CUP.rimY) / CUP.ry);
    // Sheen toward the back of the cup, deeper amber toward the front lip.
    const T = (0.62 + 0.3 * e ** 3 + 0.2 * clamp((y - CUP.rimY) / CUP.ry, -1, 1)) * teaTex(X, Y);
    // The heart keeps its own shading; elsewhere the petals stay and the gaps between them
    // fill with tea, darkened by the flower's shadow.
    const shadow = 0.9 * smoothstep(1.25, 0.75, footprint(x, y));
    const k = smoothstep(0.8, 1.1, heart(x, y));
    // Wet petals catch the light a little more.
    const leaf = leaves ? leaves.at(X, Y) : 0;
    const v = d < T && leaf < 0.05 ? d * 0.65 : T + shadow;
    return d + (v - d) * k;
  };
  const surface = ellipse(CUP.cx, CUP.rimY, CUP.rx - 10, CUP.ry - 8, 0, 96);
  acts.push(K.reveal((st) => {
    // Leaves were painted after the bloom, so no petal lies inside them: they sink into the tea.
    leaves = st.mask(LEAVES.map((lf) => leafPoly(lf.base, lf.angle, lf.len, lf.width).poly), { feather: 1.5 });
    return st.mask(surface, { feather: 0.8 });
  }, { op: 'set', level: tea, order: 'out', duration: 3, jitter: 0.05, rest: 0.05 }));
  // The lip: a dark outer edge and a bright glaze line.
  // The back of the lip passes behind the petals that stand above the tea.
  acts.push(K.pour(lip(0, 0), { width: 7, amount: 1.6, speed: 900, taper: K.even, scatter: 0, rest: 0.02 }));
  acts.push(K.carve(lip(6, 4, 1), { width: 6, strength: 0.92, speed: 900, rim: 0.25, taper: K.even, rest: 0.03 }));
  acts.push(K.pour(lip(16, 11, 3), { width: 3, amount: 0.7, speed: 1200, taper: K.even, scatter: 0, rest: 0.03 }));
  // Ripples spreading from the flower: broken rings of dark trough and bright crest that pass
  // under the petals (masked wherever a petal already lies) and stay inside the lip.
  const troughs = [];
  const crests = [];
  for (const rr of [1.14, 1.3, 1.46]) {
    const a0 = rng.float(0, 0.6);
    for (const [from, to] of [[a0, a0 + 1.7], [a0 + 2.3, a0 + 3.4]]) {
      const band = (dy, w) => {
        const outer = [];
        const inner = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const a = from + (to - from) * t;
          const h = w * Math.sin(Math.PI * t);
          outer.push([C[0] + (262 * rr + h) * Math.cos(a), C[1] + 16 + dy + (135 * rr + h) * Math.sin(a)]);
          inner.push([C[0] + (262 * rr - h) * Math.cos(a), C[1] + 16 + dy + (135 * rr - h) * Math.sin(a)]);
        }
        return [...outer, ...inner.reverse()];
      };
      troughs.push(band(0, 2));
      crests.push(band(4, 1.6));
    }
  }
  const onTea = (st, polys) => {
    const W = st.field.w;
    const d = st.field.d;
    return st.mask(polys, { feather: 0.5 }).map((a, X, Y) => {
      const inLip = Math.hypot((X / s - CUP.cx) / (CUP.rx - 24), (Y / s - CUP.rimY) / (CUP.ry - 16)) < 1;
      return inLip && d[Y * W + X] > 0.3 ? a : 0;
    });
  };
  acts.push(K.reveal((st) => onTea(st, troughs), { op: 'add', amount: 0.45, order: 'out', duration: 1.2, jitter: 0.03, rest: 0 }));
  acts.push(K.reveal((st) => onTea(st, crests), { op: 'carve', strength: 0.6, order: 'out', duration: 1.2, jitter: 0.03, rest: 0.05 }));
  // A breath of steam: three soft wavy wisps rising side by side above the cup.
  const steam = [
    [462, 722, 180, 0.0],
    [554, 704, 220, 1.7],
    [642, 726, 160, 3.1],
  ];
  for (const [x, y, h, ph] of steam) {
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      pts.push([x + 18 * Math.sin(ph + t * 5.2) * (0.4 + t), y - t * h]);
    }
    acts.push(K.carve(pts, { width: 11, strength: 0.52, speed: 150, rim: 0, hard: 0.1, taper: (u) => 0.4 + 0.6 * Math.sin(Math.PI * u), rest: 0.05 }));
  }
  return acts;
}
