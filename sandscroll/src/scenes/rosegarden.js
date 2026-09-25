import { spline, ellipse, TAU } from '../core/geom.js';
import * as K from '../core/kit.js';

// 美美与共 — a peony and a rose sharing one porcelain vase.
export default {
  id: 'rosegarden',
  music: 'garden',
  opening: 0.15,
  title: { cn: '美美与共', en: 'Peony and Rose' },
  poem: {
    columns: ['各美其美', '美人之美', '美美与共', '天下大同'],
    cn: '各美其美，美人之美，美美与共，天下大同',
    en: 'Cherish your own beauty, admire the beauty of others; beauty shared makes the world one.',
    by: '费孝通  ·  Fei Xiaotong',
  },
  note: { cn: '牡丹素有“国色天香”之誉，玫瑰是美国国花', en: 'The peony, long hailed in China as “national beauty”; the rose, national flower of the United States' },
  seal: '美美与共',
  build(stage, rng) {
    const acts = [];
    const vx = 900;
    const base = 930;
    acts.push(...K.cover(stage, stage.vgrad(0.34, 0.14, 0, 1080, 0.1, rng.float(0, 40)), { rows: 5, y0: -60, y1: 1140, rate: 0.85 }));
    // Table edge and the vase's soft shadow.
    acts.push(K.reveal((st) => st.mask([[-10, base], [1930, base], [1930, 1090], [-10, 1090]], { feather: 2 }), { op: 'set', level: stage.streaky(0.62, 0.2, 0.002, 0.05), order: 'left', duration: 4 }));
    acts.push(K.reveal((st) => st.mask(ellipse(vx + 40, base + 8, 190, 16), { feather: 8 }), { op: 'add', amount: 0.35, order: 'out', duration: 1.5 }));
    acts.push(...vase(stage, rng, { x: vx, base, H: 390 }));

    const mouth = base - 390;
    // Stems first, then leaves, then the blooms on top.
    const peonyC = [vx - 150, mouth - 170];
    const roseC = [vx + 170, mouth - 120];
    const budC = [vx + 300, mouth - 250];
    acts.push(K.pour(spline([[vx - 10, mouth + 6], [vx - 60, mouth - 60], [peonyC[0] + 20, peonyC[1] + 90]], 10), { width: 9, amount: 2.3, speed: 180 }));
    acts.push(K.pour(spline([[vx + 8, mouth + 6], [vx + 80, mouth - 40], [roseC[0] - 10, roseC[1] + 70]], 10), { width: 7, amount: 2.3, speed: 180 }));
    acts.push(K.pour(spline([[vx + 70, mouth - 36], [vx + 200, mouth - 140], [budC[0], budC[1] + 40]], 10), { width: 5, amount: 2.2, speed: 180 }));
    for (const [x, y, a, s] of [[vx - 230, mouth - 70, 2.6, 1], [vx - 60, mouth - 110, -0.5, 0.9], [vx - 280, mouth - 190, 3.3, 0.8]]) {
      acts.push(...peonyLeaf(x, y, a, s * 120));
    }
    for (const [x, y, a] of [[vx + 110, mouth - 60, -0.2], [vx + 250, mouth - 100, -0.9], [vx + 40, mouth - 20, 3.6]]) {
      acts.push(...roseLeaves(x, y, a, 44, rng));
    }
    acts.push(...peony(stage, rng, peonyC[0], peonyC[1], 125));
    acts.push(...rose(stage, rng, roseC[0], roseC[1], 84));
    acts.push(...bud(budC[0], budC[1], 30));
    // Fallen petals on the table (落花).
    for (const [px, py, a] of [[vx + 330, base + 40, 0.3], [vx + 420, base + 70, -0.5], [vx + 250, base + 86, 1.2]]) {
      acts.push(K.reveal((st) => st.mask(ellipse(px, py, 22, 11, a, 24), { feather: 1, rough: 0.2, roughScale: 0.3 }), { op: 'set', level: 1.9, order: 'out', duration: 0.8 }));
      acts.push(K.carve([[px - 12 * Math.cos(a), py - 12 * Math.sin(a)], [px + 12 * Math.cos(a), py + 12 * Math.sin(a)]], { width: 1.6, strength: 0.5, speed: 100 }));
    }

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 1720, y: 120, size: 52, colGap: 1.32, mode: 'pour', amount: 1.5, perChar: 1.1 }));
    acts.push(...K.seal(stage, this.seal, 1435, 440, { size: 68, seed: rng.int(1, 999) }));
    return acts;
  },
};

// 玉壶春瓶 (pear-shaped vase): dark glaze, carved bands, a scroll frieze and a glaze highlight.
function vase(stage, rng, { x, base, H }) {
  const acts = [];
  const half = [[0.15, 1], [0.13, 0.965], [0.078, 0.86], [0.072, 0.77], [0.105, 0.64], [0.2, 0.47], [0.265, 0.33], [0.25, 0.17], [0.185, 0.06], [0.17, 0]];
  const right = half.map(([w, h]) => [x + w * H, base - h * H]);
  const left = half.map(([w, h]) => [x - w * H, base - h * H]).reverse();
  const outline = [...spline(right, 8), ...spline(left, 8)];
  acts.push(K.reveal((st) => st.mask(outline, { feather: 1 }), { op: 'set', level: stage.mottle(1.9, 0.08), order: 'up', duration: 5 }));
  const widthAt = (h) => {
    for (let i = 1; i < half.length; i++) {
      if (half[i][1] <= h) {
        const [w0, h0] = half[i - 1];
        const [w1, h1] = half[i];
        return w0 + ((w1 - w0) * (h - h0)) / (h1 - h0);
      }
    }
    return half[half.length - 1][0];
  };
  const band = (h, width = 3) => {
    const w = widthAt(h) * H * 0.96;
    const y = base - h * H;
    const pts = [];
    for (let a = 0.05; a <= Math.PI - 0.05; a += 0.1) pts.push([x - Math.cos(a) * w, y + Math.sin(a) * w * 0.08]);
    return K.carve(pts, { width, strength: 0.72, speed: 260, rim: 0.2, rest: 0.08 });
  };
  for (const h of [0.93, 0.8, 0.6, 0.44, 0.12]) acts.push(band(h));
  // Scroll frieze on the shoulder (缠枝纹): a running wave of curls.
  const y0 = base - 0.52 * H;
  const w = widthAt(0.52) * H * 0.85;
  const scroll = [];
  for (let t = 0; t <= 1; t += 0.01) {
    const px = x - w + 2 * w * t;
    scroll.push([px, y0 + 9 * Math.sin(t * TAU * 3.5)]);
  }
  acts.push(K.carve(scroll, { width: 2.4, strength: 0.6, speed: 260, rim: 0.1 }));
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    const cx = x - w + 2 * w * t;
    const pts = [];
    for (let a = 0; a < TAU * 0.9; a += 0.25) pts.push([cx + Math.cos(a) * 7 * (1 - a / 7), y0 - 14 * (i % 2 ? -1 : 1) + Math.sin(a) * 7 * (1 - a / 7)]);
    acts.push(K.carve(pts, { width: 2, strength: 0.55, speed: 160, rest: 0.03 }));
  }
  // Glaze highlight.
  acts.push(K.carve(spline([[x - 0.16 * H, base - 0.24 * H], [x - 0.2 * H, base - 0.36 * H], [x - 0.13 * H, base - 0.56 * H]], 10), { width: 9, strength: 0.4, speed: 200, rim: 0 }));
  return acts;
}

// Full, ruffled peony: dark silhouette, nested cupped petal edges carved in light.
function peony(stage, rng, cx, cy, R) {
  const acts = [];
  const ph = rng.float(0, 10);
  const sil = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU;
    const r = R * (1 + 0.07 * Math.sin(a * 9 + ph) + 0.04 * Math.sin(a * 17 + ph * 2));
    const squash = Math.sin(a) > 0 ? 0.72 : 0.9;
    sil.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash]);
  }
  acts.push(K.reveal((st) => st.mask(sil, { feather: 1.2, rough: 0.2, roughScale: 0.25 }), { op: 'set', level: stage.mottle(1.75, 0.12, 0.03), order: 'out', duration: 4 }));
  for (let k = 0; k < 5; k++) {
    const r = R * (0.92 - k * 0.16);
    const oy = cy - k * R * 0.1 + R * 0.05;
    const pts = [];
    for (let a = 0.12 * Math.PI; a <= 0.88 * Math.PI; a += 0.04) {
      const wob = 1 + 0.05 * Math.sin(a * 13 + k * 2 + ph);
      pts.push([cx + Math.cos(a) * r * wob, oy + Math.sin(a) * r * 0.55 * wob - r * 0.18]);
    }
    if (k % 2) pts.reverse();
    acts.push(K.carve(pts, { width: 3.8 - k * 0.35, strength: 0.86, speed: 240, rim: 0.25, rest: 0.1 }));
  }
  // Petal separations and a few stamens at the heart.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.18 + (0.64 * i) / 8);
    const r0 = R * rng.float(0.3, 0.5);
    const r1 = R * rng.float(0.65, 0.85);
    acts.push(K.carve([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.5 - R * 0.1], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.55 - R * 0.05]], { width: 2, strength: 0.5, speed: 220, rest: 0.03 }));
  }
  for (let i = 0; i < 14; i++) {
    const a = rng.float(0, TAU);
    const r = R * rng.float(0, 0.16);
    const x = cx + Math.cos(a) * r;
    const y = cy - R * 0.3 + Math.sin(a) * r * 0.5;
    acts.push(K.carve([[x, y], [x + 1, y - 2]], { width: 4, strength: 0.8, speed: 60, rest: 0.02 }));
  }
  return acts;
}

// Rose in three-quarter view: cupped outer petals and the tight inner spiral.
function rose(stage, rng, cx, cy, R) {
  const acts = [];
  const sil = [];
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * TAU;
    const top = Math.sin(a) < 0;
    const r = R * (1 + (top ? 0.08 * Math.abs(Math.sin(a * 2.5)) : 0));
    sil.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (top ? 0.78 : 0.95)]);
  }
  acts.push(K.reveal((st) => st.mask(sil, { feather: 1.2, rough: 0.15, roughScale: 0.25 }), { op: 'set', level: stage.mottle(2.05, 0.1, 0.03), order: 'out', duration: 3 }));
  // Inner spiral.
  const spiral = [];
  const turns = 2.1;
  for (let a = 0; a <= TAU * turns; a += 0.1) {
    const r = R * 0.05 + (R * 0.42 * a) / (TAU * turns);
    spiral.push([cx + Math.cos(a) * r, cy - R * 0.28 + Math.sin(a) * r * 0.62]);
  }
  acts.push(K.carve(spiral, { width: 3, strength: 0.85, speed: 180, rim: 0.2 }));
  // Cupped outer petals: bowl-shaped edges nesting inside the silhouette.
  const cups = [
    [[-0.84, 0.02], [0, 0.6], [0.84, 0.04]],
    [[-0.58, -0.14], [0, 0.3], [0.6, -0.1]],
    [[-0.9, 0.3], [-0.2, 0.84], [0.5, 0.72]],
  ];
  for (const c of cups) {
    acts.push(K.carve(spline(c.map(([a, b]) => [cx + a * R, cy + b * R]), 12), { width: 3.4, strength: 0.85, speed: 220, rim: 0.25, rest: 0.1 }));
  }
  for (const s of [-1, 1]) {
    acts.push(K.carve(spline([[cx + s * R * 0.95, cy - R * 0.2], [cx + s * R * 0.78, cy - R * 0.5], [cx + s * R * 0.45, cy - R * 0.62]], 8), { width: 2.4, strength: 0.6, speed: 200, rest: 0.05 }));
  }
  return acts;
}

function bud(cx, cy, R) {
  const shape = spline([[cx, cy - R * 1.4], [cx + R * 0.7, cy - R * 0.2], [cx + R * 0.5, cy + R * 0.7], [cx - R * 0.5, cy + R * 0.7], [cx - R * 0.7, cy - R * 0.2]], 8, true);
  return [
    K.reveal((st) => st.mask(shape, { feather: 1 }), { op: 'set', level: 2.1, order: 'up', duration: 1.5 }),
    K.carve(spline([[cx - R * 0.35, cy + R * 0.5], [cx + R * 0.1, cy - R * 0.2], [cx + R * 0.05, cy - R * 1.1]], 6), { width: 2, strength: 0.6, speed: 120 }),
    K.pour(spline([[cx - R * 0.5, cy + R * 0.6], [cx - R * 0.9, cy + R * 0.2], [cx - R * 1.1, cy - R * 0.1]], 5), { width: 4, amount: 2, speed: 100 }),
    K.pour(spline([[cx + R * 0.5, cy + R * 0.6], [cx + R * 0.9, cy + R * 0.25], [cx + R * 1.05, cy]], 5), { width: 4, amount: 2, speed: 100 }),
  ];
}

// Three-lobed peony leaf fanning from a point.
function peonyLeaf(x, y, angle, len) {
  const acts = [];
  for (const d of [-0.55, 0, 0.55]) {
    const a = angle + d;
    const L = len * (d === 0 ? 1 : 0.78);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const w = L * 0.2;
    const tip = [x + c * L, y + s * L];
    const mid = [x + c * L * 0.5, y + s * L * 0.5];
    const poly = spline([[x, y], [mid[0] - s * w, mid[1] + c * w], tip, [mid[0] + s * w, mid[1] - c * w], [x, y]], 8);
    acts.push(K.reveal((st) => st.mask(poly, { feather: 0.8 }), { op: 'set', level: 2.2, order: 'out', duration: 0.9, rest: 0.05 }));
    acts.push(K.carve([[x + c * L * 0.1, y + s * L * 0.1], [x + c * L * 0.85, y + s * L * 0.85]], { width: 1.8, strength: 0.6, speed: 260, rest: 0.03 }));
  }
  return acts;
}

// Rose leaflets: small serrated ovals in threes along a petiole.
function roseLeaves(x, y, angle, size, rng) {
  const acts = [];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const end = [x + c * size * 2.2, y + s * size * 2.2];
  acts.push(K.pour([[x, y], end], { width: 3, amount: 2, speed: 200, rest: 0.03 }));
  const spots = [[1, 0], [0.55, 1], [0.55, -1]];
  for (const [t, side] of spots) {
    const bx = x + c * size * 2.2 * t;
    const by = y + s * size * 2.2 * t;
    const a = angle + side * 0.9;
    const L = size * (side === 0 ? 1.1 : 0.9);
    const lc = Math.cos(a);
    const ls = Math.sin(a);
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const along = u <= 0.5 ? u * 2 : (1 - u) * 2;
      const sideSign = u <= 0.5 ? 1 : -1;
      const width = Math.sin(along * Math.PI) * L * 0.32 * (1 + (i % 2 ? 0.12 : 0));
      const px = bx + lc * L * along - ls * width * sideSign;
      const py = by + ls * L * along + lc * width * sideSign;
      pts.push([px, py]);
    }
    acts.push(K.reveal((st) => st.mask(pts, { feather: 0.7 }), { op: 'set', level: 2.25, order: 'out', duration: 0.6, rest: 0.03 }));
    acts.push(K.carve([[bx + lc * L * 0.1, by + ls * L * 0.1], [bx + lc * L * 0.8, by + ls * L * 0.8]], { width: 1.5, strength: 0.55, speed: 240, rest: 0.02 }));
  }
  return acts;
}
