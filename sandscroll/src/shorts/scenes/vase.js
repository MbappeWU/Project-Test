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
    const table = 1278;
    const vx = 430;
    const H = 588;
    const mouth = table - H;
    // A warm mid-toned wall.
    acts.push(...K.cover(stage, stage.vgrad(1.15, 0.8, 0, table, 0.08, off), { y0: -60, y1: 1980, width: 480, speed: 2600 }));
    const v = vase(stage, { x: vx, base: table, H });
    const peonyC = [296, 606];
    const roseC = [582, 716];
    const budC = [600, 492];
    // A polished table top with a dark front edge.
    const grain = stage.streaky(1, 0.25, 0.0025, 0.08, off + 7);
    acts.push(K.reveal((st) => st.mask([[-20, table - 34], [1100, table - 34], [1100, table + 76], [-20, table + 76]], { feather: 1.5 }), { op: 'set', level: (x, y) => grain(x, y) * (0.42 + 0.25 * smoothstep(table - 34, table + 76, y / s)), order: 'left', duration: 1.6 }));
    acts.push(K.reveal((st) => st.mask([[-20, table + 76], [1100, table + 76], [1100, 1940], [-20, 1940]], { feather: 1.5 }), { op: 'set', level: (x, y) => grain(x, y) * (1.9 + 0.4 * smoothstep(table + 76, 1900, y / s)), order: 'left', duration: 1.6 }));
    acts.push(K.carve([[-20, table + 74], [1100, table + 74]], { width: 5, strength: 0.6, speed: 1400, taper: K.even, rim: 0.2, rest: 0.03 }));
    // The apron below the top, its lower edge cut in a 壸门 curve over the shadow under the table.
    const apron = [[-20, table + 160]];
    for (let x = -20; x <= 1100; x += 10) {
      const u = (x - 60) / 960;
      const arch = u > 0 && u < 1 ? Math.pow(Math.sin(Math.PI * u), 0.6) * (1 + 0.35 * Math.cos(u * TAU * 3)) : 0;
      apron.push([x, table + 176 + 60 * arch]);
    }
    apron.push([1100, 1940], [-20, 1940]);
    acts.push(K.reveal((st) => st.mask(apron, { feather: 2 }), { op: 'set', level: (x, y) => grain(x, y) * 3, order: 'down', duration: 1.2 }));
    acts.push(K.carve([[-20, table + 106], [1100, table + 106]], { width: 3, strength: 0.4, speed: 1400, taper: K.even, rim: 0.3, rest: 0.03 }));
    acts.push(K.carve(apron.slice(1, -2).map(([x, y]) => [x, y - 10]), { width: 3, strength: 0.4, speed: 1400, taper: K.even, rim: 0.3, rest: 0.03 }));
    acts.push(K.reveal((st) => st.mask(ellipse(vx + 80, table + 4, 250, 22, 0, 48), { feather: 12 }), { op: 'add', amount: 0.5, order: 'out', duration: 0.5 }));
    // The vase glows first, its blue-and-white decoration follows; a faint reflection in the top.
    acts.push(...v.body, ...v.decor);
    acts.push(K.reveal((st) => st.mask(v.outline.filter(([, py]) => py > table - 70).map(([px, py]) => [px, 2 * table - py + 6]), { feather: 5 }), { op: 'carve', strength: 0.2, order: 'down', duration: 0.5 }));
    // Stems from the vase mouth, leaves behind, then the two blooms and the bud.
    const stems = [
      [[vx - 10, mouth + 12], [vx - 40, mouth - 50], [peonyC[0] + 50, peonyC[1] + 90]],
      [[vx + 10, mouth + 12], [vx + 70, mouth - 30], [roseC[0] - 40, roseC[1] + 50]],
      [[vx + 16, mouth + 8], [vx + 110, mouth - 120], [budC[0] - 6, budC[1] + 46]],
    ];
    for (const [i, pts] of stems.entries()) acts.push(K.pour(spline(pts, 12), { width: [11, 8, 6][i], amount: 2.4, speed: 360, scatter: 0.1, rest: 0.02 }));
    acts.push(...peonyLeaf(stage, 170, 700, 2.45, 190, rng, 2.2));
    acts.push(...peonyLeaf(stage, 206, 500, -2.4, 165, rng, 2.1));
    acts.push(...roseLeaves(stage, 470, 610, -0.95, 38, rng));
    acts.push(...roseLeaves(stage, 646, 792, 0.95, 40, rng));
    acts.push(...peony(stage, rng, peonyC[0], peonyC[1], 194));
    acts.push(...rose(stage, roseC[0], roseC[1], 114));
    acts.push(...bud(stage, budC[0], budC[1], 38));
    acts.push(...peonyLeaf(stage, 404, 736, 0.55, 170, rng, 2.4));
    // A rose spray trailing out over the vase's shoulder toward the table.
    acts.push(K.pour(spline([[vx + 22, mouth + 14], [vx + 150, mouth + 40], [vx + 280, mouth + 140], [vx + 360, mouth + 290]], 12), { width: 6, amount: 2.3, speed: 360, scatter: 0.1, rest: 0.02 }));
    acts.push(...roseLeaves(stage, vx + 196, mouth + 66, 0.45, 34, rng));
    acts.push(...roseLeaves(stage, vx + 300, mouth + 180, 0.2, 36, rng));
    acts.push(...bud(stage, vx + 364, mouth + 318, 24, Math.PI));
    // Last, the lamp: the arrangement's soft shadow falls on the wall to the right.
    const shadow = [v.outline.map(([px, py]) => [px + 74 + (table - py) * 0.04, py - 8]), ellipse(peonyC[0] + 86, peonyC[1] + 14, 190, 150, 0, 40), ellipse(roseC[0] + 80, roseC[1] + 16, 110, 96, 0, 32)];
    acts.push(K.reveal((st) => {
      const m = st.mask(shadow, { feather: 26 });
      const front = st.mask([v.outline, ellipse(peonyC[0], peonyC[1] - 10, 205, 176, 0, 48)], { feather: 2 });
      return m.map((a, X, Y) => a * (1 - front.at(X, Y)) * (1 - smoothstep(table - 60, table - 34, Y / s)));
    }, { op: 'add', amount: 0.26, order: 'right', duration: 1.2 }));
    // Petals fallen on the table (落英).
    for (const [px, py, a, lv, sz] of [[676, 1286, 1.1, 0.08, 66], [808, 1300, 2.1, 0.12, 58], [600, 1312, 1.6, 1.9, 46]]) {
      acts.push(...fallenPetal(stage, px, py, a, sz, lv));
    }
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 964, y: 486, size: 52, colGap: 1.25, mode: 'carve', strength: 0.9, perChar: 1.1 }));
    acts.push(...K.seal(stage, this.seal, 769, 770, { size: 56, seed: rng.int(1, 999) }));
    return acts;
  },
};

// 玉壶春瓶: flared mouth, slender neck, pear belly sagging low, ring foot. Glowing white glaze
// with cylindrical shading and 青花 decoration poured on: banana leaves, a scroll band, lotus panels.
function vase(stage, { x, base, H }) {
  const acts = [];
  const decor = [];
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
  acts.push(K.reveal((st) => st.mask(body, { feather: 1 }), { op: 'set', level: glaze, order: 'up', duration: 3 }));
  // Open mouth: the dark interior seen over the rim.
  acts.push(K.reveal((st) => st.mask(ellipse(x, base - H + 2, 0.132 * H, 0.132 * H * 0.22, 0, 40), { feather: 1 }), { op: 'set', level: 2.2, order: 'out', duration: 0.5 }));
  const band = (h, width = 3, amount = 1.6) => {
    const pts = [];
    for (let phi = -1.45; phi <= 1.45; phi += 0.05) pts.push(at(phi, h));
    return K.pour(pts, { width, amount, speed: 900, taper: K.taperBoth, scatter: 0, rest: 0.01 });
  };
  for (const h of [0.985, 0.955, 0.655, 0.625, 0.505, 0.23, 0.205, 0.045]) decor.push(band(h, h > 0.9 || h < 0.1 ? 4.5 : 3.4));
  // Banana leaves (蕉叶纹) climbing the neck.
  for (const phi0 of [-1.05, -0.35, 0.35, 1.05]) {
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.1) pts.push(at(phi0 - 0.3 * (1 - t), 0.665 + 0.26 * t));
    for (let t = 1; t >= -0.001; t -= 0.1) pts.push(at(phi0 + 0.3 * (1 - t), 0.665 + 0.26 * t));
    decor.push(K.pour(pts, { width: 3.2, amount: 1.6, speed: 700, taper: K.even, scatter: 0, rest: 0.01 }));
    const vein = [];
    for (let t = 0; t <= 1.001; t += 0.1) vein.push(at(phi0, 0.665 + 0.24 * t));
    decor.push(K.pour(vein, { width: 2, amount: 1.4, speed: 700, taper: K.taperEnd, scatter: 0, rest: 0.01 }));
  }
  // Scroll band on the shoulder (缠枝纹): a running vine with curls.
  const vine = [];
  for (let phi = -1.4; phi <= 1.4; phi += 0.03) vine.push(at(phi, 0.565 + 0.028 * Math.sin(phi * 6.5)));
  decor.push(K.pour(vine, { width: 3.2, amount: 1.6, speed: 900, taper: K.taperBoth, scatter: 0, rest: 0.01 }));
  for (let i = 0; i < 8; i++) {
    const phi0 = -1.25 + (i * 2.5) / 7;
    const up = i % 2 ? 1 : -1;
    const curl = [];
    for (let a = 0; a < TAU * 0.85; a += 0.3) curl.push(at(phi0 + 0.05 * Math.cos(a) * (1 - a / 7), 0.565 + up * 0.03 + 0.022 * Math.sin(a) * (1 - a / 7)));
    decor.push(K.pour(curl, { width: 2.8, amount: 1.5, speed: 500, taper: K.taperEnd, scatter: 0, rest: 0.01 }));
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
      decor.push(K.pour(pts, { width: inset ? 2.4 : 3.2, amount: 1.5, speed: 700, taper: K.even, scatter: 0, rest: 0.01 }));
    }
  }
  // Glaze highlights.
  decor.push(K.carve(spline([at(-0.62, 0.13), at(-0.67, 0.26), at(-0.6, 0.43)], 10), { width: 12, strength: 0.72, speed: 500, rim: 0, taper: K.taperBoth, rest: 0.02 }));
  decor.push(K.carve(spline([at(-0.45, 0.18), at(-0.49, 0.27), at(-0.45, 0.36)], 10), { width: 4, strength: 0.5, speed: 500, rim: 0, taper: K.taperBoth, rest: 0.02 }));
  decor.push(K.reveal((st) => st.mask(ellipse(...at(-0.5, 0.53), 9, 5, -0.5, 16), { feather: 2 }), { op: 'carve', strength: 0.8, order: 'out', duration: 0.2, rest: 0.02 }));
  decor.push(K.carve(spline([at(-0.6, 0.7), at(-0.62, 0.82), at(-0.55, 0.93)], 10), { width: 4, strength: 0.45, speed: 500, rim: 0, taper: K.taperBoth, rest: 0.02 }));
  return { body: acts, decor, outline: body };
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
  for (const ring of layers) {
    // Back petals first, the ones facing us last.
    const angles = Array.from({ length: ring.n }, (_, i) => ring.rot + (i * TAU) / ring.n + rng.float(-0.12, 0.12)).sort((p, q) => Math.sin(p) - Math.sin(q));
    for (const a of angles) {
      const poly = petalPoly(a, ring.hw, ring.r0, ring.r1 * rng.float(0.92, 1.05), ring.lift, rng.float(0, 10));
      acts.push(K.reveal((st) => st.mask(poly, { feather: 1, rough: 0.2, roughScale: 0.4 }), { op: 'set', level: shade(ring.r0, ring.r1, ring.lift, ring.dark, ring.light), order: 'out', duration: 0.35 + ring.r1 * 0.5, rest: 0.03 }));
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

// Rose in three-quarter view, built from the back: arching back petals, a tight dark heart with
// its spiral, then cupped petals whose rolled lips catch the light, each lower and wider.
function rose(stage, cx, cy, R) {
  const acts = [];
  const s = stage.s;
  const Q = (pts) => pts.map(([a, b]) => [cx + a * R, cy + b * R]);
  // Level from `top` at the petal's upper edge to `bottom` at its lower edge.
  const grade = (y0, y1, top, bottom) => (X, Y) => top + (bottom - top) * smoothstep(cy + y0 * R, cy + y1 * R, Y / s);
  const fill = (pts, level, dur = 0.5) => K.reveal((st) => st.mask(spline(Q(pts), 8, true), { feather: 1, rough: 0.15, roughScale: 0.35 }), { op: 'set', level, order: 'up', duration: dur, rest: 0.03 });
  const lip = (pts, width = 5, strength = 0.75) => K.carve(spline(Q(pts), 10), { width, strength, speed: 240, rim: 0.25, taper: K.taperBoth, rest: 0.03 });
  // Back petals: their inner faces, dark below and lighter toward the rim.
  acts.push(fill([[-1.0, 0.12], [-0.94, -0.46], [-0.6, -0.86], [-0.16, -0.9], [0.1, -0.5], [0, 0.1]], grade(-0.9, 0.1, 1.5, 2.45), 0.7));
  acts.push(fill([[0, 0.1], [-0.1, -0.56], [0.22, -0.92], [0.66, -0.86], [0.96, -0.46], [1.0, 0.12]], grade(-0.9, 0.1, 1.6, 2.5), 0.7));
  acts.push(lip([[-0.97, -0.28], [-0.82, -0.68], [-0.44, -0.92], [-0.1, -0.86]]));
  acts.push(lip([[0.04, -0.86], [0.42, -0.94], [0.82, -0.72], [0.98, -0.3]]));
  // The heart: wrapped petals in a tight spiral.
  acts.push(K.reveal((st) => st.mask(ellipse(cx + 0.02 * R, cy - 0.44 * R, 0.36 * R, 0.24 * R, -0.1, 40), { feather: 1.5 }), { op: 'set', level: 2.6, order: 'out', duration: 0.4, rest: 0.03 }));
  const spiral = [];
  for (let a = 1.2; a <= TAU * 1.55; a += 0.1) {
    const r = (0.05 + (0.3 * a) / (TAU * 1.55)) * R;
    spiral.push([cx + 0.02 * R + Math.cos(a) * r, cy - 0.46 * R + Math.sin(a) * r * 0.6]);
  }
  acts.push(K.carve(spiral, { width: 3.4, strength: 0.72, speed: 220, rim: 0.2, taper: K.taperBoth, rest: 0.03 }));
  // Cupped petals from the inside out; each lip a smile-shaped curve with a small notch.
  const cups = [
    { lip: [[-0.46, -0.52], [-0.18, -0.3], [0.02, -0.33], [0.2, -0.3], [0.42, -0.54]], bottom: 0.2 },
    { lip: [[-0.74, -0.36], [-0.42, -0.06], [-0.2, -0.02], [0.02, -0.06], [0.18, -0.22]], bottom: 0.5 },
    { lip: [[-0.06, -0.16], [0.3, 0.04], [0.5, 0.02], [0.7, -0.06], [0.88, -0.38]], bottom: 0.55 },
    { lip: [[-0.98, -0.06], [-0.64, 0.3], [-0.34, 0.4], [-0.02, 0.38], [0.3, 0.26]], bottom: 0.88 },
    { lip: [[-0.36, 0.32], [0.12, 0.54], [0.36, 0.52], [0.72, 0.34], [0.99, -0.02]], bottom: 0.96 },
  ];
  for (const c of cups) {
    const [l, r] = [c.lip[0], c.lip[c.lip.length - 1]];
    const lo = Math.max(...c.lip.map((p) => p[1]));
    const body = [...c.lip, [r[0] - 0.02, (r[1] + c.bottom) / 2], [(l[0] + r[0]) / 2 + 0.1, c.bottom], [l[0] + 0.04, (l[1] + c.bottom) / 2]];
    acts.push(fill(body, grade(lo - 0.14, c.bottom, 1.4, 2.35), 0.45));
    acts.push(lip(c.lip, 5.5, 0.78));
  }
  // Rolled-back tips at the sides of the outer petals.
  for (const sd of [-1, 1]) acts.push(lip([[sd * 0.97, 0.0], [sd * 1.08, -0.1], [sd * 1.03, -0.22]], 4.5, 0.65));
  return acts;
}

// A closed rosebud with its sepals, pointing along `dir` (up by default).
function bud(stage, cx, cy, R, dir = 0) {
  const c = Math.cos(dir);
  const sn = Math.sin(dir);
  const Q = (pts) => pts.map(([a, b]) => [cx + (a * c - b * sn) * R, cy + (a * sn + b * c) * R]);
  const shape = spline(Q([[0, -1.5], [0.62, -0.4], [0.5, 0.6], [-0.5, 0.6], [-0.62, -0.4]]), 8, true);
  return [
    K.reveal((st) => st.mask(shape, { feather: 1 }), { op: 'set', level: stage.mottle(2.2, 0.1), order: 'up', duration: 0.8, rest: 0.03 }),
    K.carve(spline(Q([[-0.3, 0.45], [0.12, -0.3], [0.04, -1.2]]), 6), { width: 2.8, strength: 0.65, speed: 140, rest: 0.03 }),
    K.pour(spline(Q([[-0.46, 0.56], [-0.95, 0.1], [-1.15, -0.3]]), 5), { width: 5, amount: 2.2, speed: 120, taper: K.taperEnd, rest: 0.02 }),
    K.pour(spline(Q([[0.46, 0.56], [0.95, 0.2], [1.12, -0.1]]), 5), { width: 5, amount: 2.2, speed: 120, taper: K.taperEnd, rest: 0.02 }),
  ];
}

// A lanceolate peony leaflet along `angle`, bending as it goes; the terminal one has a pointed
// lobe on each side, the lateral ones a single lobe on their outer side.
function leafletPoly(x, y, angle, len, bend, lobes) {
  const lobed = [[0, 0], [0.1, 0.08], [0.3, 0.15], [0.48, 0.18], [0.6, 0.17], [0.72, 0.21], [0.67, 0.1], [0.84, 0.07], [1, 0]];
  const plain = [[0, 0], [0.12, 0.09], [0.35, 0.15], [0.6, 0.13], [0.8, 0.07], [1, 0]];
  const upper = lobes === 0 ? plain : lobed;
  const lower = lobes === 2 || lobes === -1 ? lobed : plain;
  const local = [...(lobes === -1 ? plain : upper), ...lower.slice(1, -1).reverse().map(([u, v]) => [u, -v])];
  return spline(local.map(([u, v]) => {
    const a = angle + bend * u * u;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return [x + c * len * u - sn * len * v, y + sn * len * u + c * len * v];
  }), 5, true);
}

// A thin tapering stalk between two points.
function stalkPoly(x0, y0, x1, y1, w) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const nx = -Math.sin(a) * w;
  const ny = Math.cos(a) * w;
  return [[x0 + nx, y0 + ny], [x1 + nx * 0.6, y1 + ny * 0.6], [x1 - nx * 0.6, y1 - ny * 0.6], [x0 - nx, y0 - ny]];
}

// Tree-peony leaf: a petiole forking into three drooping leaflets with gaps between them; the
// end leaflet on its own short stalk.
function peonyLeaf(stage, x, y, angle, len, rng, level = 2.3) {
  const polys = [];
  const ribs = [];
  const droop = Math.cos(angle) >= 0 ? 0.3 : -0.3;
  const jx = x + Math.cos(angle) * len * 0.26;
  const jy = y + Math.sin(angle) * len * 0.26;
  const tx = jx + Math.cos(angle) * len * 0.12;
  const ty = jy + Math.sin(angle) * len * 0.12;
  polys.push(stalkPoly(x, y, tx, ty, 3));
  for (const [ox, oy, d, l, lobes] of [[tx, ty, 0, 0.72, 2], [jx, jy, -1.0, 0.56, 1], [jx, jy, 1.0, 0.56, -1]]) {
    const a = angle + d + rng.float(-0.08, 0.08);
    const L = len * l;
    polys.push(leafletPoly(ox, oy, a, L, droop, lobes));
    const rib = [];
    for (let u = 0.05; u <= 0.86; u += 0.08) {
      const aa = a + droop * u * u;
      rib.push([ox + Math.cos(aa) * L * u, oy + Math.sin(aa) * L * u]);
    }
    ribs.push(rib);
  }
  const acts = [K.reveal((st) => st.mask(polys, { feather: 0.8, rough: 0.12, roughScale: 0.4 }), { op: 'set', level: stage.mottle(level, 0.1, 0.03), order: 'out', duration: 0.75, rest: 0.02 })];
  for (const r of ribs) acts.push(K.carve(r, { width: 2.2, strength: 0.5, speed: 600, taper: K.taperEnd, rest: 0.01 }));
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
  const acts = [K.pour([[x, y], stemEnd], { width: 3, amount: 2.2, speed: 400, scatter: 0, rest: 0.01 })];
  acts.push(K.reveal((st) => st.mask(polys, { feather: 0.7 }), { op: 'set', level: stage.mottle(2.3, 0.1, 0.03), order: 'out', duration: 0.6, rest: 0.02 }));
  acts.push(K.reveal((st) => st.mask(ribs.map(([[x0, y0], [x1, y1]]) => stalkPoly(x0, y0, x1, y1, 0.8)), { feather: 0.5 }), { op: 'carve', strength: 0.5, order: 'out', duration: 0.3, rest: 0.02 }));
  return acts;
}

// A petal lying on the table, foreshortened: a narrow claw fanning out to a wavy, notched margin,
// deeper toward the base, its far edge curled up to the light, and a soft shadow.
function fallenPetal(stage, x, y, angle, size, level) {
  const s = stage.s;
  const fan = 0.85;
  const local = [[-size * 0.08, 0]];
  for (let i = 0; i <= 24; i++) {
    const th = -fan + (2 * fan * i) / 24;
    const r = size * (0.78 + 0.22 * Math.cos((th / fan) * Math.PI * 0.5)) * (1 - 0.12 * Math.exp(-Math.pow(th / 0.12, 2))) * (1 + 0.05 * Math.sin(th * 13 + size));
    local.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  const place = ([u, v], k = 1) => [x + (u * Math.cos(angle) - v * Math.sin(angle)) * k, y + (u * Math.sin(angle) + v * Math.cos(angle)) * 0.62 * k];
  const pts = local.map((p) => place(p));
  const rim = local.slice(4, 22).map((p) => place(p, 0.94));
  const depth = (X, Y) => level + (level > 1 ? 0.3 : 0.45) * (1 - Math.min(1, Math.hypot(X / s - x, (Y / s - y) / 0.62) / size));
  return [
    K.reveal((st) => st.mask(pts.map(([px, py]) => [px + 8, py + 5]), { feather: 5 }), { op: 'add', amount: 0.35, order: 'out', duration: 0.3, rest: 0.02 }),
    K.reveal((st) => st.mask(pts, { feather: 1 }), { op: 'set', level: depth, order: 'out', duration: 0.5, rest: 0.03 }),
    K.carve(rim, { width: 3, strength: level > 1 ? 0.55 : 0.8, speed: 200, taper: K.taperBoth, rest: 0.03 }),
  ];
}
