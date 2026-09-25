import { spline, ellipse, smoothstep, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 美美与共 — a glowing blue-and-white 玉壶春瓶 on a table, holding a luminous peony and a deep rose
// side by side, a rosebud reaching up, leaves of both, and a few petals fallen on the table.
// Portrait 1080x1920.
export default {
  id: 'vase',
  music: 'garden',
  title: { cn: '美美与共', en: 'Peony and Rose' },
  hook: { cn: '牡丹遇见玫瑰：美美与共', en: 'When a peony meets a rose' },
  theme: '和谐 · 包容',
  poem: {
    columns: ['各美其美', '美人之美', '美美与共', '天下大同'],
    cn: '各美其美，美人之美，美美与共，天下大同',
    en: 'Cherish your own beauty, admire the beauty of others; beauty shared makes the world one.',
    by: '费孝通  ·  Fei Xiaotong',
  },
  seal: '美美与共',
  build(stage, rng) {
    const acts = [];
    const off = rng.float(0, 100);
    const s = stage.s;
    const table = 1300;
    const vx = 430;
    const H = 600;
    const mouth = table - H;
    // A warm mid-toned wall, a lit table top with a dark front edge.
    acts.push(...K.cover(stage, stage.vgrad(1.15, 0.8, 0, table, 0.08, off), { y0: -60, y1: 1980, width: 480, speed: 2600 }));
    const grain = stage.streaky(1, 0.25, 0.0025, 0.08, off + 7);
    acts.push(K.reveal((st) => st.mask([[-20, table - 34], [1100, table - 34], [1100, 1376], [-20, 1376]], { feather: 1.5 }), { op: 'set', level: (x, y) => grain(x, y) * (0.42 + 0.25 * smoothstep(table - 34, 1376, y / s)), order: 'left', duration: 2 }));
    acts.push(K.reveal((st) => st.mask([[-20, 1376], [1100, 1376], [1100, 1940], [-20, 1940]], { feather: 1.5 }), { op: 'set', level: (x, y) => grain(x, y) * (1.9 + 0.4 * smoothstep(1376, 1900, y / s)), order: 'left', duration: 2 }));
    acts.push(K.carve([[-20, 1374], [1100, 1374]], { width: 5, strength: 0.6, speed: 900, taper: K.even, rim: 0.2, rest: 0.03 }));
    acts.push(K.reveal((st) => st.mask(ellipse(vx + 80, table + 4, 250, 22, 0, 48), { feather: 12 }), { op: 'add', amount: 0.5, order: 'out', duration: 0.6 }));
    acts.push(...vase(stage, rng, { x: vx, base: table, H }));
    // Stems from the vase mouth, leaves behind, then the two blooms and the bud.
    const peonyC = [300, 612];
    const roseC = [578, 712];
    const budC = [596, 470];
    const stems = [
      [[vx - 10, mouth + 12], [vx - 40, mouth - 50], [peonyC[0] + 50, peonyC[1] + 90]],
      [[vx + 10, mouth + 12], [vx + 70, mouth - 30], [roseC[0] - 40, roseC[1] + 50]],
      [[vx + 16, mouth + 8], [vx + 110, mouth - 120], [budC[0] - 6, budC[1] + 46]],
    ];
    for (const [i, pts] of stems.entries()) acts.push(K.pour(spline(pts, 12), { width: [11, 8, 6][i], amount: 2.4, speed: 260, scatter: 0.1, rest: 0.03 }));
    acts.push(...peonyLeaf(stage, 150, 700, 2.55, 170, rng));
    acts.push(...peonyLeaf(stage, 196, 488, -2.35, 140, rng));
    acts.push(...roseLeaves(stage, 470, 610, -0.95, 38, rng));
    acts.push(...roseLeaves(stage, 646, 792, 0.95, 40, rng));
    acts.push(...peony(stage, rng, peonyC[0], peonyC[1], 182));
    acts.push(...rose(stage, rng, roseC[0], roseC[1], 108));
    acts.push(...bud(stage, budC[0], budC[1], 38));
    acts.push(...peonyLeaf(stage, 410, 742, 0.35, 140, rng));
    // Fallen petals (落英) on the table: pale peony petals and a dark rose petal.
    for (const [px, py, a, lv, sz] of [[700, 1322, 0.3, 0.1, 34], [786, 1346, -0.4, 0.16, 28], [628, 1350, 2.8, 1.9, 24]]) {
      acts.push(...fallenPetal(stage, px, py, a, sz, lv));
    }
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 966, y: 486, size: 54, mode: 'carve', strength: 0.9, perChar: 1.1 }));
    acts.push(...K.seal(stage, this.seal, 754, 772, { size: 56, seed: rng.int(1, 999) }));
    return acts;
  },
};

// 玉壶春瓶: flared mouth, slender neck, pear belly sagging low, ring foot. Glowing white glaze
// with cylindrical shading and 青花 decoration poured on: banana leaves, a scroll band, lotus panels.
function vase(stage, rng, { x, base, H }) {
  const acts = [];
  const s = stage.s;
  const prof = [[0.155, 1], [0.14, 0.975], [0.086, 0.9], [0.072, 0.8], [0.086, 0.7], [0.13, 0.6], [0.2, 0.5], [0.25, 0.4], [0.268, 0.3], [0.255, 0.2], [0.215, 0.12], [0.18, 0.06], [0.172, 0.03], [0.176, 0]];
  const widthAt = (h) => {
    if (h >= 1) return prof[0][0];
    for (let i = 1; i < prof.length; i++) {
      if (prof[i][1] <= h) {
        const [w0, h0] = prof[i - 1];
        const [w1, h1] = prof[i];
        return w0 + ((w1 - w0) * (h - h0)) / (h1 - h0);
      }
    }
    return prof[prof.length - 1][0];
  };
  const k = 0.1;
  // Point on the surface at angle phi round the vase (0 = facing us) and height h.
  const at = (phi, h) => {
    const w = widthAt(h) * H;
    return [x + w * Math.sin(phi), base - h * H + w * k * Math.cos(phi)];
  };
  const right = spline(prof.map(([w, h]) => [x + w * H, base - h * H]).reverse(), 8);
  const foot = [];
  for (let a = 0; a <= Math.PI; a += 0.1) foot.push([x + Math.cos(a) * 0.176 * H, base + Math.sin(a) * 0.176 * H * k]);
  const body = [...right, ...right.map(([px, py]) => [2 * x - px, py]).reverse(), ...foot.reverse()];
  const glaze = (X, Y) => {
    const vy = Y / s;
    const h = Math.max(0, Math.min(1, (base - vy) / H));
    const u = Math.max(-1, Math.min(1, (X / s - x) / (widthAt(h) * H)));
    const lit = Math.max(0, -0.62 * u + 0.78 * Math.sqrt(1 - u * u));
    return 0.04 + 0.78 * Math.pow(1 - lit, 1.7) + 0.35 * smoothstep(0.22, 0, h);
  };
  acts.push(K.reveal((st) => st.mask(body, { feather: 1 }), { op: 'set', level: glaze, order: 'up', duration: 4 }));
  // Open mouth: the dark interior seen over the rim.
  const [, my] = at(0, 1);
  acts.push(K.reveal((st) => st.mask(ellipse(x, base - H + 2, 0.132 * H, 0.132 * H * 0.22, 0, 40), { feather: 1 }), { op: 'set', level: 2.2, order: 'out', duration: 0.5 }));
  const band = (h, width = 3, amount = 1.6) => {
    const pts = [];
    for (let phi = -1.45; phi <= 1.45; phi += 0.05) pts.push(at(phi, h));
    return K.pour(pts, { width, amount, speed: 320, taper: K.taperBoth, scatter: 0, rest: 0.03 });
  };
  for (const h of [0.985, 0.955, 0.655, 0.625, 0.505, 0.23, 0.205, 0.045]) acts.push(band(h, h > 0.9 || h < 0.1 ? 3.5 : 2.6));
  // Banana leaves (蕉叶纹) climbing the neck.
  for (const phi0 of [-1.05, -0.35, 0.35, 1.05]) {
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.1) pts.push(at(phi0 - 0.3 * (1 - t), 0.665 + 0.26 * t));
    for (let t = 1; t >= -0.001; t -= 0.1) pts.push(at(phi0 + 0.3 * (1 - t), 0.665 + 0.26 * t));
    acts.push(K.pour(pts, { width: 2.4, amount: 1.5, speed: 260, taper: K.even, scatter: 0, rest: 0.02 }));
    const vein = [];
    for (let t = 0; t <= 1.001; t += 0.1) vein.push(at(phi0, 0.665 + 0.24 * t));
    acts.push(K.pour(vein, { width: 2, amount: 1.4, speed: 260, taper: K.taperEnd, scatter: 0, rest: 0.02 }));
  }
  // Scroll band on the shoulder (缠枝纹): a running vine with curls.
  const vine = [];
  for (let phi = -1.4; phi <= 1.4; phi += 0.03) vine.push(at(phi, 0.565 + 0.028 * Math.sin(phi * 6.5)));
  acts.push(K.pour(vine, { width: 2.4, amount: 1.5, speed: 320, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  for (let i = 0; i < 8; i++) {
    const phi0 = -1.25 + (i * 2.5) / 7;
    const up = i % 2 ? 1 : -1;
    const curl = [];
    for (let a = 0; a < TAU * 0.85; a += 0.3) curl.push(at(phi0 + 0.05 * Math.cos(a) * (1 - a / 7), 0.565 + up * 0.03 + 0.022 * Math.sin(a) * (1 - a / 7)));
    acts.push(K.pour(curl, { width: 2.2, amount: 1.4, speed: 200, taper: K.taperEnd, scatter: 0, rest: 0.02 }));
  }
  // Lotus panels (莲瓣纹) round the foot.
  for (let i = 0; i < 9; i++) {
    const phi0 = -1.6 + (i * 3.2) / 8;
    if (Math.abs(phi0) > 1.45) continue;
    for (const inset of [0, 1]) {
      const pts = [];
      const hw = 0.17 - inset * 0.07;
      for (let t = 0; t <= 1.001; t += 0.1) {
        const a = Math.PI * t;
        pts.push(at(phi0 - hw * Math.cos(a), 0.06 + (0.14 - inset * 0.05) * Math.sin(a)));
      }
      acts.push(K.pour(pts, { width: inset ? 1.8 : 2.4, amount: 1.4, speed: 260, taper: K.even, scatter: 0, rest: 0.02 }));
    }
  }
  // Glaze highlights.
  acts.push(K.carve(spline([at(-0.62, 0.14), at(-0.66, 0.26), at(-0.6, 0.42)], 10), { width: 10, strength: 0.55, speed: 260, rim: 0, taper: K.taperBoth, rest: 0.03 }));
  acts.push(K.carve(spline([at(-0.6, 0.7), at(-0.62, 0.82), at(-0.55, 0.93)], 10), { width: 4, strength: 0.45, speed: 260, rim: 0, taper: K.taperBoth, rest: 0.03 }));
  return acts;
}

// Full peony built petal by petal from the outside in: every petal dark at its base and
// glowing at its ruffled edge, so each layer stands out against the one behind it.
function peony(stage, rng, cx, cy, R, squash = 0.8) {
  const acts = [];
  const s = stage.s;
  const petalPoly = (a, hw, r0, r1, lift, ph) => {
    const pts = [];
    const b = [cx + Math.cos(a) * r0 * R, cy + (Math.sin(a) * r0 * squash - lift) * R];
    pts.push(b);
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const th = a - hw + 2 * hw * t;
      const edge = Math.sin(Math.PI * t);
      const r = r1 * (0.86 + 0.14 * Math.pow(edge, 0.5)) * (1 + 0.05 * Math.sin(t * 9 + ph) + 0.03 * Math.sin(t * 23 + ph * 2));
      pts.push([cx + Math.cos(th) * r * R, cy + (Math.sin(th) * r * squash - lift) * R]);
    }
    return pts;
  };
  const shade = (r0, r1, lift, dark, light) => (X, Y) => {
    const dx = (X / s - cx) / R;
    const dy = (Y / s - cy) / R + lift;
    const r = Math.hypot(dx, dy / squash);
    const t = Math.max(0, Math.min(1, (r - r0) / (r1 - r0)));
    return dark + (light - dark) * Math.pow(t, 0.75);
  };
  const layers = [
    { n: 7, r0: 0.22, r1: 1.0, hw: 0.5, lift: 0, dark: 1.5, light: 0.1, rot: 0.2 },
    { n: 7, r0: 0.16, r1: 0.8, hw: 0.46, lift: 0.08, dark: 1.6, light: 0.06, rot: 0.6 },
    { n: 6, r0: 0.1, r1: 0.6, hw: 0.5, lift: 0.15, dark: 1.7, light: 0.05, rot: 0.1 },
    { n: 5, r0: 0.05, r1: 0.4, hw: 0.56, lift: 0.21, dark: 1.8, light: 0.05, rot: 0.9 },
    { n: 4, r0: 0.02, r1: 0.24, hw: 0.7, lift: 0.26, dark: 1.9, light: 0.08, rot: 0.3 },
  ];
  for (const L of layers) {
    // Back petals first, the ones facing us last.
    const angles = Array.from({ length: L.n }, (_, i) => L.rot + (i * TAU) / L.n + rng.float(-0.12, 0.12)).sort((p, q) => Math.sin(p) - Math.sin(q));
    for (const a of angles) {
      const poly = petalPoly(a, L.hw, L.r0, L.r1 * rng.float(0.92, 1.05), L.lift, rng.float(0, 10));
      acts.push(K.reveal((st) => st.mask(poly, { feather: 1, rough: 0.2, roughScale: 0.4 }), { op: 'set', level: shade(L.r0, L.r1, L.lift, L.dark, L.light), order: 'out', duration: 0.35 + L.r1 * 0.5, rest: 0.03 }));
    }
  }
  // Golden stamens at the heart: bright specks round a dark centre.
  const [hx, hy] = [cx, cy - 0.3 * R];
  acts.push(K.reveal((st) => st.mask(ellipse(hx, hy, 0.1 * R, 0.07 * R, 0, 24), { feather: 2 }), { op: 'set', level: 2.2, order: 'out', duration: 0.3, rest: 0.03 }));
  const specks = [];
  for (let i = 0; i < 16; i++) {
    const a = rng.float(0, TAU);
    const r = rng.float(0.03, 0.12) * R;
    specks.push(ellipse(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.7, 3.2, 3.2, 0, 8));
  }
  acts.push(K.reveal((st) => st.mask(specks, { feather: 0.5 }), { op: 'carve', strength: 0.9, order: 'out', duration: 0.5, rest: 0.05 }));
  return acts;
}

// Rose in three-quarter view: a deep cup, rolled petal lips catching the light, tight spiral heart.
function rose(stage, rng, cx, cy, R) {
  const acts = [];
  const cup = [];
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * TAU;
    const top = Math.sin(a) < 0;
    const r = R * (1 + (top ? 0.07 * Math.abs(Math.sin(a * 2.5)) : 0));
    cup.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (top ? 0.72 : 0.92)]);
  }
  acts.push(K.reveal((st) => st.mask(cup, { feather: 1.2, rough: 0.15, roughScale: 0.3 }), { op: 'set', level: stage.mottle(2.0, 0.1, 0.03), order: 'out', duration: 1.6 }));
  // Heart: the tightly wrapped centre, darker, with a carved spiral.
  acts.push(K.reveal((st) => st.mask(ellipse(cx, cy - R * 0.3, R * 0.5, R * 0.3, 0, 40), { feather: 2 }), { op: 'set', level: 2.5, order: 'out', duration: 0.5, rest: 0.03 }));
  const spiral = [];
  const turns = 2.2;
  for (let a = 0; a <= TAU * turns; a += 0.1) {
    const r = R * 0.04 + (R * 0.44 * a) / (TAU * turns);
    spiral.push([cx + Math.cos(a) * r, cy - R * 0.3 + Math.sin(a) * r * 0.6]);
  }
  acts.push(K.carve(spiral, { width: 3.2, strength: 0.8, speed: 200, rim: 0.2, rest: 0.03 }));
  // Rolled lips of the outer petals, lighter where they turn to the light.
  for (const c of [
    [[-0.9, 0.04], [-0.3, 0.46], [0.36, 0.5], [0.9, 0.08]],
    [[-0.66, -0.14], [0, 0.22], [0.64, -0.1]],
    [[-0.96, 0.34], [-0.4, 0.86], [0.3, 0.9], [0.8, 0.5]],
  ]) {
    acts.push(K.carve(spline(c.map(([a, b]) => [cx + a * R, cy + b * R]), 12), { width: 5, strength: 0.7, speed: 240, rim: 0.3, taper: K.taperBoth, rest: 0.05 }));
  }
  for (const sd of [-1, 1]) {
    acts.push(K.carve(spline([[cx + sd * R * 0.96, cy - R * 0.12], [cx + sd * R * 0.8, cy - R * 0.48], [cx + sd * R * 0.42, cy - R * 0.66]], 8), { width: 3.4, strength: 0.6, speed: 220, taper: K.taperBoth, rest: 0.04 }));
  }
  return acts;
}

// A closed rosebud with its sepals.
function bud(stage, cx, cy, R) {
  const shape = spline([[cx, cy - R * 1.5], [cx + R * 0.62, cy - R * 0.4], [cx + R * 0.5, cy + R * 0.6], [cx - R * 0.5, cy + R * 0.6], [cx - R * 0.62, cy - R * 0.4]], 8, true);
  return [
    K.reveal((st) => st.mask(shape, { feather: 1 }), { op: 'set', level: stage.mottle(2.1, 0.1), order: 'up', duration: 0.8, rest: 0.03 }),
    K.carve(spline([[cx - R * 0.3, cy + R * 0.45], [cx + R * 0.12, cy - R * 0.3], [cx + R * 0.04, cy - R * 1.2]], 6), { width: 2.6, strength: 0.65, speed: 140, rest: 0.03 }),
    K.pour(spline([[cx - R * 0.46, cy + R * 0.56], [cx - R * 0.95, cy + R * 0.1], [cx - R * 1.15, cy - R * 0.3]], 5), { width: 5, amount: 2.2, speed: 120, taper: K.taperEnd, rest: 0.02 }),
    K.pour(spline([[cx + R * 0.46, cy + R * 0.56], [cx + R * 0.95, cy + R * 0.2], [cx + R * 1.12, cy - R * 0.1]], 5), { width: 5, amount: 2.2, speed: 120, taper: K.taperEnd, rest: 0.02 }),
  ];
}

// Peony leaf: three deeply cut lobes fanning from the petiole, each with a carved midrib.
function peonyLeaf(stage, x, y, angle, len, rng) {
  const polys = [];
  const ribs = [];
  for (const d of [-0.62, 0, 0.62]) {
    const a = angle + d + rng.float(-0.06, 0.06);
    const l = len * (d === 0 ? 1 : 0.78);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pts = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = l * 0.2 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 + 0.12 * Math.sin(t * 14));
      pts.push([x + c * l * t - sn * w, y + sn * l * t + c * w]);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const w = l * 0.2 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 + 0.12 * Math.sin(t * 14 + 1.5));
      pts.push([x + c * l * t + sn * w, y + sn * l * t - c * w]);
    }
    polys.push(pts);
    ribs.push([[x + c * l * 0.1, y + sn * l * 0.1], [x + c * l * 0.85, y + sn * l * 0.85]]);
  }
  const acts = [K.reveal((st) => st.mask(polys, { feather: 0.8 }), { op: 'set', level: stage.mottle(2.35, 0.1, 0.03), order: 'out', duration: 0.9, rest: 0.03 })];
  for (const r of ribs) acts.push(K.carve(r, { width: 2, strength: 0.55, speed: 300, taper: K.taperEnd, rest: 0.02 }));
  return acts;
}

// Rose leaflets: serrated ovals in fives along a petiole.
function roseLeaves(stage, x, y, angle, size, rng) {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const stemEnd = [x + c * size * 2.6, y + sn * size * 2.6];
  const polys = [];
  const ribs = [];
  for (const [t, side] of [[1, 0], [0.62, 1], [0.62, -1], [0.26, 1], [0.26, -1]]) {
    const bx = x + c * size * 2.6 * t;
    const by = y + sn * size * 2.6 * t;
    const a = angle + side * 0.95 + rng.float(-0.1, 0.1);
    const l = size * (side === 0 ? 1.15 : 0.9 - (1 - t) * 0.2);
    const lc = Math.cos(a);
    const ls = Math.sin(a);
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const along = u <= 0.5 ? u * 2 : (1 - u) * 2;
      const sideSign = u <= 0.5 ? 1 : -1;
      const w = Math.sin(along * Math.PI) * l * 0.34 * (1 + (i % 2 ? 0.14 : 0));
      pts.push([bx + lc * l * along - ls * w * sideSign, by + ls * l * along + lc * w * sideSign]);
    }
    polys.push(pts);
    ribs.push([[bx + lc * l * 0.1, by + ls * l * 0.1], [bx + lc * l * 0.8, by + ls * l * 0.8]]);
  }
  const acts = [K.pour([[x, y], stemEnd], { width: 3, amount: 2.2, speed: 240, scatter: 0, rest: 0.02 })];
  acts.push(K.reveal((st) => st.mask(polys, { feather: 0.7 }), { op: 'set', level: stage.mottle(2.3, 0.1, 0.03), order: 'out', duration: 0.8, rest: 0.03 }));
  for (const r of ribs) acts.push(K.carve(r, { width: 1.6, strength: 0.5, speed: 300, taper: K.taperEnd, rest: 0.02 }));
  return acts;
}

// A petal lying on the table, foreshortened, with its soft shadow.
function fallenPetal(stage, x, y, angle, size, level) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const r = size * (1 + 0.18 * Math.cos(a) + 0.06 * Math.sin(a * 3));
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.55;
    pts.push([x + px * Math.cos(angle) - py * Math.sin(angle), y + (px * Math.sin(angle) + py * Math.cos(angle)) * 0.5]);
  }
  return [
    K.reveal((st) => st.mask(pts.map(([px, py]) => [px + 6, py + 5]), { feather: 5 }), { op: 'add', amount: 0.35, order: 'out', duration: 0.3, rest: 0.02 }),
    K.reveal((st) => st.mask(pts, { feather: 1 }), { op: 'set', level, order: 'out', duration: 0.5, rest: 0.05 }),
  ];
}
