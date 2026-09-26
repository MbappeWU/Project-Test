import { spline, ellipse, arc, smoothstep, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 年年有余 — two koi, one carved in light and one laid in dark sand, chase each other round a
// pool of lamplight until, head to tail, they close into a taiji: the bright koi becomes the
// light half, the dark koi the dark half, and their eyes become the two dots.
const CX = 540;
const CY = 900;
const R = 300;
const W = 58; // half-width of a koi at its shoulders

export default {
  id: 'koi',
  music: 'river',
  title: { cn: '年年有余', en: 'Two Koi' },
  theme: '和谐 · 好运',
  hook: { en: 'Wait for the circle to close', cn: '两条锦鲤，一个圆' },
  payoff: { en: 'Two koi. One balance.', cn: '年年有余' },
  inscription: { columns: ['年年有余'], note: '吉语' },
  seal: '有余',
  twist: '两条追逐的锦鲤首尾相接，合成一个太极圆',
  build(stage, rng) {
    const s = stage.s;
    const off = rng.float(0, 100);
    const light = fish(Math.PI * 0.45, s);
    const dark = fish(Math.PI * 1.45, s);
    const acts = [];

    // Picture A: the bright koi in one stroke, the pool of light, then the dark koi.
    const first = K.carve(light.spinePath(0, 1.12), { width: 46, strength: 0.94, speed: 640, rim: 0.35, rest: 0.05 });
    first.mark = 'open';
    acts.push(first);
    acts.push(K.reveal((st) => st.mask(light.body, { feather: 1.2 }), { op: 'carve', strength: 0.93, order: light.order, duration: 1.3, jitter: 0.02, rest: 0.05 }));
    acts.push(K.reveal((st) => K.radialMask(st, CX, CY, 330, 470, 1.6), { op: 'carve', strength: 0.5, order: 'out', duration: 1.3, jitter: 0.025, rest: 0.05 }));
    acts.push(...brightFins(light));
    acts.push(...darkKoi(stage, dark, off));
    const recog = K.wait(0.01);
    recog.mark = 'A';
    acts.push(recog);
    acts.push(...brightDetails(light), ...darkDetails(dark));
    acts.push(...ripples([[345, 0.2, 1.7], [392, 2.4, 3.9], [430, 3.8, 5.4]], 0.45, 1800));

    // Twist: a stirring palm swirls both koi round the circle, then they settle into the taiji.
    const tgt = taijiTarget(s, stage.mottle(1, 0.1, 0.02, off + 9));
    const swirl = [];
    for (let i = 0; i <= 200; i++) {
      const a = Math.PI * 1.45 - (i / 200) * TAU * 1.7;
      const r = 250 - (i / 200) * 190;
      swirl.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]);
    }
    const stir = K.palm(swirl, { width: 170, speed: 650, target: tgt, rate: 0.75, streak: stage.streaks[1], hard: 0.3, rest: 0.1 });
    stir.mark = 'twist';
    acts.push(stir);
    acts.push(K.palm(arc(CX, CY, 262, Math.PI * 1.5, -Math.PI * 0.5, 96), { width: 110, speed: 1100, target: tgt, rate: 0.7, streak: stage.streaks[2], hard: 0.3, rest: 0.1 }));
    const yang = K.reveal((st) => st.mask(taijiLight(), { feather: 0.7 }), { op: 'carve', strength: 0.95, order: angleOrder(s, Math.PI * 1.5), duration: 3.5, jitter: 0.015, rest: 0.05 });
    const yin = K.reveal((st) => st.mask(taijiDark(), { feather: 0.7 }), { op: 'set', level: stage.mottle(3.3, 0.06, 0.02, off + 3), order: angleOrder(s, Math.PI * 0.5), duration: 3.5, jitter: 0.015, rest: 0.05 });
    acts.push(yang, yin);
    // The circle closes: one stroke all the way round.
    acts.push(K.carve(arc(CX, CY, R + 9, Math.PI * 1.5, Math.PI * 1.5 - TAU * 1.02, 160), { width: 11, strength: 0.93, speed: 900, rim: 0.4, taper: K.even, rest: 0.1 }));
    acts.push(K.reveal((st) => st.mask(ellipse(CX, CY - R / 2, R * 0.13, R * 0.13, 0, 40), { feather: 0.6 }), { op: 'carve', strength: 0.96, order: 'out', duration: 0.8, rest: 0.05 }));
    acts.push(K.reveal((st) => st.mask(ellipse(CX, CY + R / 2, R * 0.13, R * 0.13, 0, 40), { feather: 0.6 }), { op: 'set', level: 3.4, order: 'out', duration: 0.8, rest: 0.1 }));
    const fin = K.wait(0.01);
    fin.mark = 'taiji';
    acts.push(fin);
    acts.push(...ripples([[352, -0.5, 1.9], [395, 2.2, 4.4], [440, 3.7, 5.6], [372, 4.2, 5.4]], 0.5, 900));

    acts.push(K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 470, size: 56, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 950, 780, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A koi swimming round the pool, its head curled in toward the centre at angle `aH`, its body
// following the circle (angle growing from head to tail) and its tail flicking outward.
// Parameter t runs 0 (nose) .. 1 (root of the tail) .. 1.3 (tail tips).
function fish(aH, s) {
  const P = (t) => {
    const a = aH + 2.5 * t;
    const r = t <= 1 ? 160 + 88 * smoothstep(0, 1, t) : 248 + 70 * (t - 1);
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const N = (t) => {
    const [x0, y0] = P(t - 0.004);
    const [x1, y1] = P(t + 0.004);
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [-(y1 - y0) / l, (x1 - x0) / l];
  };
  const at = (t, off) => {
    const [x, y] = P(t);
    const [nx, ny] = N(t);
    return [x + nx * off, y + ny * off];
  };
  const prof = (t) => (t < 0.3 ? Math.sqrt(Math.max(0, 1 - (1 - t / 0.3) ** 2)) : 1 - 0.8 * smoothstep(0.3, 1, t));
  const hw = (t) => W * prof(t);
  const side = (sign) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      pts.push(at(t, sign * hw(t)));
    }
    return pts;
  };
  const body = [...side(1), ...side(-1).reverse()];

  // Flowing tail: two lobes sweeping to one side, notched in the middle.
  const sway = (u) => 0.45 * W * u * u;
  const edge = (u) => W * (0.2 + 0.95 * Math.pow(Math.sin((u * Math.PI) / 2), 0.8)) * (1 + 0.08 * Math.sin(u * 9));
  const lobe = (sign) => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      pts.push(at(1 + 0.3 * u, sway(u) + sign * edge(u)));
    }
    return pts;
  };
  const tail = [...lobe(1), at(1 + 0.3 * 0.55, sway(0.55)), ...lobe(-1).reverse()];
  const rays = [];
  for (const f of [-0.95, -0.6, -0.25, 0.25, 0.6, 0.95]) {
    const tip = 1 + 0.3 * (0.66 + 0.34 * Math.abs(f));
    rays.push(spline([at(0.97, f * 0.12 * W), at(1 + 0.3 * 0.4 * (0.66 + 0.34 * Math.abs(f)), sway(0.4) + f * edge(0.4) * 0.9), at(tip, sway(1) + f * edge(1) * 0.93)], 8));
  }

  // Fins as fans hinged at the body edge, swept back along the body.
  const fan = (t, sign, len, spread, sweep) => {
    const base = at(t, sign * hw(t) * 0.8);
    const [nx, ny] = N(t);
    const [tx, ty] = [ny, -nx];
    const dir = Math.atan2(sign * ny * Math.cos(sweep) + ty * Math.sin(sweep), sign * nx * Math.cos(sweep) + tx * Math.sin(sweep));
    const pts = [at(t - 0.05, sign * hw(t - 0.05) * 0.7)];
    for (let i = 0; i <= 10; i++) {
      const a = dir - spread + (2 * spread * i) / 10;
      const l = len * (0.8 + 0.2 * Math.sin((Math.PI * i) / 10));
      pts.push([base[0] + l * Math.cos(a), base[1] + l * Math.sin(a)]);
    }
    pts.push(at(t + 0.06, sign * hw(t + 0.06) * 0.7));
    const ray = (k) => {
      const a = dir - spread * 0.8 + (1.6 * spread * k) / 2;
      return [base, [base[0] + len * 0.95 * Math.cos(a), base[1] + len * 0.95 * Math.sin(a)]];
    };
    return { poly: pts, rays: [ray(0), ray(1), ray(2)] };
  };
  const fins = [fan(0.25, 1, 1.35 * W, 0.4, 0.95), fan(0.25, -1, 1.35 * W, 0.4, 0.95), fan(0.63, 1, 0.62 * W, 0.32, 1.0), fan(0.63, -1, 0.62 * W, 0.32, 1.0)];

  // Head: eyes, gill covers and a pair of barbels.
  const eyes = [at(0.09, 0.72 * hw(0.09)), at(0.09, -0.72 * hw(0.09))];
  const gills = [1, -1].map((sg) => spline([at(0.14, sg * hw(0.14) * 0.95), at(0.175, sg * hw(0.175) * 0.7), at(0.2, sg * hw(0.2) * 0.42)], 6));
  const [tx0, ty0] = (() => {
    const [x0, y0] = P(0);
    const [x1, y1] = P(0.01);
    const l = Math.hypot(x1 - x0, y1 - y0);
    return [(x0 - x1) / l, (y0 - y1) / l];
  })();
  const barbels = [1, -1].map((sg) => {
    const [bx, by] = at(0.02, sg * 10);
    const [nx, ny] = N(0);
    return spline([[bx, by], [bx + tx0 * 10 + nx * sg * 10, by + ty0 * 10 + ny * sg * 10], [bx + tx0 * 14 + nx * sg * 26, by + ty0 * 14 + ny * sg * 26]], 5);
  });

  // A hint of scales: small scallops opening toward the head, in rows along the back.
  const scales = [];
  for (let t = 0.32; t <= 0.8; t += 0.07) {
    const rows = t < 0.6 ? [-0.52, 0, 0.52] : [-0.35, 0.35];
    for (const f of rows) {
      const o = f * hw(t) + (Math.round(t / 0.07) % 2 ? 0.13 * hw(t) : 0);
      const [cx, cy] = at(t, o);
      const [nx, ny] = N(t);
      const back = Math.atan2(-nx, ny);
      const r = 0.2 * hw(t) + 3;
      scales.push(crescent(cx, cy, r, back - 1.1, back + 1.1, 2.6));
    }
  }

  const spinePath = (t0, t1, n = 60) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(P(t0 + ((t1 - t0) * i) / n));
    return pts;
  };
  const order = (X, Y) => {
    let a = Math.atan2(Y / s - CY, X / s - CX) - aH + 0.4;
    a = ((a % TAU) + TAU) % TAU;
    return a / TAU;
  };
  const dorsal = spinePath(0.3, 0.66, 30);
  return { P, N, at, body, tail, rays, fins, eyes, gills, barbels, scales, dorsal, spinePath, order };
}

// Thin crescent band (a scale edge) along a circle arc.
function crescent(cx, cy, r, a0, a1, w) {
  const outer = arc(cx, cy, r + w / 2, a0, a1, 10);
  const inner = arc(cx, cy, r - w / 2, a1, a0, 10);
  return [...outer, ...inner];
}

function brightFins(k) {
  const acts = [
    K.reveal((st) => st.mask(k.tail, { feather: 1 }), { op: 'carve', strength: 0.6, order: 'out', duration: 0.9, jitter: 0.05, rest: 0.03 }),
  ];
  for (const r of k.rays) acts.push(K.carve(r, { width: 7, strength: 0.55, speed: 1000, rim: 0.15, taper: K.taperEnd, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(k.fins.map((f) => f.poly), { feather: 1 }), { op: 'carve', strength: 0.72, order: 'out', duration: 0.8, jitter: 0.05, rest: 0.03 }));
  for (const f of k.fins.slice(0, 2)) for (const r of f.rays) acts.push(K.carve(r, { width: 4, strength: 0.5, speed: 900, rim: 0.1, taper: K.taperEnd, rest: 0.01 }));
  return acts;
}

function brightDetails(k) {
  const acts = [
    K.reveal((st) => st.mask(k.eyes.map(([x, y]) => ellipse(x, y, 7, 7, 0, 14)), { feather: 0.5 }), { op: 'set', level: 3.2, order: 'out', duration: 0.3, rest: 0.03 }),
  ];
  for (const g of k.gills) acts.push(K.pour(g, { width: 4, amount: 0.9, speed: 500, scatter: 0, rest: 0.02 }));
  for (const b of k.barbels) acts.push(K.carve(b, { width: 3.5, strength: 0.85, speed: 300, rim: 0.1, taper: K.taperEnd, rest: 0.02 }));
  acts.push(K.pour(k.dorsal, { width: 5, amount: 0.35, speed: 900, scatter: 0, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(k.scales, { feather: 0.4 }), { op: 'add', amount: 0.45, order: k.order, duration: 0.5, jitter: 0.02, rest: 0.05 }));
  return acts;
}

// The dark koi: laid in thick sand, then outlined with a fingertip so it reads on the pool.
function darkKoi(stage, k, off) {
  const acts = [];
  acts.push(K.reveal((st) => st.mask(k.body, { feather: 0.9 }), { op: 'set', level: stage.mottle(3.2, 0.08, 0.02, off), order: k.order, duration: 1.8, jitter: 0.02, rest: 0.05 }));
  acts.push(K.reveal((st) => st.mask(k.tail, { feather: 1 }), { op: 'add', amount: 0.85, order: 'out', duration: 0.8, jitter: 0.05, rest: 0.03 }));
  acts.push(K.reveal((st) => st.mask(k.fins.map((f) => f.poly), { feather: 1 }), { op: 'add', amount: 0.85, order: 'out', duration: 0.7, jitter: 0.05, rest: 0.03 }));
  acts.push(K.carve([...k.body, k.body[0]], { width: 6, strength: 0.88, speed: 1300, rim: 0.2, taper: K.even, rest: 0.03 }));
  return acts;
}

function darkDetails(k) {
  const acts = [];
  acts.push(K.carve([...k.tail, k.tail[0]], { width: 4, strength: 0.7, speed: 1300, rim: 0.1, taper: K.even, rest: 0.02 }));
  for (const r of k.rays) acts.push(K.carve(r, { width: 3, strength: 0.4, speed: 1100, rim: 0.05, taper: K.taperEnd, rest: 0.01 }));
  for (const f of k.fins) acts.push(K.carve(f.poly.slice(1, -1), { width: 4, strength: 0.8, speed: 900, rim: 0.05, taper: K.even, rest: 0.01 }));
  for (const f of k.fins.slice(0, 2)) for (const r of f.rays) acts.push(K.carve(r, { width: 3, strength: 0.45, speed: 900, rim: 0.05, taper: K.taperEnd, rest: 0.01 }));
  acts.push(K.reveal((st) => st.mask(k.eyes.map(([x, y]) => ellipse(x, y, 7.5, 7.5, 0, 14)), { feather: 0.5 }), { op: 'carve', strength: 0.95, order: 'out', duration: 0.3, rest: 0.03 }));
  for (const g of k.gills) acts.push(K.carve(g, { width: 3.5, strength: 0.6, speed: 500, rim: 0.05, rest: 0.02 }));
  for (const b of k.barbels) acts.push(K.carve(b, { width: 3.5, strength: 0.85, speed: 300, rim: 0.1, taper: K.taperEnd, rest: 0.02 }));
  acts.push(K.carve(k.dorsal, { width: 4, strength: 0.3, speed: 900, rim: 0.05, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(k.scales, { feather: 0.4 }), { op: 'carve', strength: 0.45, order: k.order, duration: 0.5, jitter: 0.02, rest: 0.05 }));
  return acts;
}

// Broken ripple rings round the pool: [radius, from angle, to angle].
function ripples(list, strength, speed) {
  return list.map(([r, a0, a1]) => K.carve(arc(CX, CY, r, a0, a1, Math.ceil((a1 - a0) * 30)), { width: 4, strength, speed, rim: 0.2, taper: K.taperBoth, rest: 0.03 }));
}

// The taiji halves. Light: the left half plus the lower small circle, minus the upper one;
// dark: the right half plus the upper small circle, minus the lower one.
function taijiLight() {
  return [
    ...arc(CX, CY, R, Math.PI * 1.5, Math.PI * 0.5, 96),
    ...arc(CX, CY + R / 2, R / 2, Math.PI * 0.5, -Math.PI * 0.5, 64),
    ...arc(CX, CY - R / 2, R / 2, Math.PI * 0.5, Math.PI * 1.5, 64),
  ];
}

function taijiDark() {
  return [
    ...arc(CX, CY, R, Math.PI * 0.5, -Math.PI * 0.5, 96),
    ...arc(CX, CY - R / 2, R / 2, Math.PI * 1.5, Math.PI * 0.5, 64),
    ...arc(CX, CY + R / 2, R / 2, -Math.PI * 0.5, Math.PI * 0.5, 64),
  ];
}

// Soft target for the stirring palm: light fish pale, dark fish thick, the pool around it.
function taijiTarget(s, grain) {
  return (x, y) => {
    const X = x / s - CX;
    const Y = y / s - CY;
    const d = Math.hypot(X, Y);
    if (d > R + 20) return 1.0 * grain(x, y);
    const inU = Math.hypot(X, Y + R / 2) < R / 2;
    const inL = Math.hypot(X, Y - R / 2) < R / 2;
    const lightSide = (X < 0 && !inU) || inL;
    return (lightSide ? 0.35 : 2.9) * grain(x, y);
  };
}

// Fill order sweeping round the centre with decreasing angle, starting at `a0` (a fish's tail).
function angleOrder(s, a0) {
  return (X, Y) => {
    let a = a0 - Math.atan2(Y / s - CY, X / s - CX);
    a = ((a % TAU) + TAU) % TAU;
    return a / TAU;
  };
}
