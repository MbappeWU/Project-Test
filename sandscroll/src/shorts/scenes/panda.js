import { spline, ellipse, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import * as L from '../../core/landscape.js';

// 熊猫 · 咬定青山不放松 — a giant panda sits in a misty bamboo grove, gripping a stalk that roots in a
// broken rock and chewing its leaves: the panda holds the bamboo as the bamboo holds the rock
// (郑燮《竹石》). Portrait 1080x1920.
export default {
  id: 'panda',
  music: 'panda',
  title: { cn: '熊猫', en: 'Panda' },
  hook: { cn: '熊猫教会我的事：咬定青山不放松', en: 'Life advice from a panda: hold on and never let go' },
  theme: '坚持 · 恒心',
  poem: {
    columns: ['咬定青山不放松', '立根原在破岩中'],
    cn: '咬定青山不放松，立根原在破岩中',
    en: 'Biting firm into the green mountain, never letting go; its roots hold fast in the broken rock.',
    by: '清 · 郑燮《竹石》  ·  Zheng Xie, Qing dynasty',
  },
  seal: '恒心',
  build(stage, rng) {
    const acts = [];
    const off = rng.float(0, 100);
    const ground = 1262;
    const s = stage.s;
    // Shade under the canopy above, mist near the ground: the white head sits on the darker
    // tone, the black limbs on the lighter one.
    acts.push(...K.cover(stage, stage.vgrad(1.15, 0.62, 0, 1180, 0.1, off), { y0: -60, y1: 1980, width: 480, speed: 2600 }));
    // Far culms carved pale into the mist.
    for (const [x, w, lean] of [[224, 12, 0.02], [470, 16, 0.01], [690, 14, -0.01], [1046, 22, -0.015]]) acts.push(ghostCulm(x, ground - 30, lean, w));
    // Bank with a soft shadow under the panda, then the broken rock.
    const bank = [[-20, ground + 12]];
    for (let x = 0; x <= 1100; x += 30) bank.push([x, ground + 7 * Math.sin(x / 150 + off) + 4 * Math.sin(x / 47)]);
    bank.push([1100, 1940], [-20, 1940]);
    const soil = stage.streaky(1, 0.22, 0.003, 0.05, off);
    acts.push(K.reveal((st) => st.mask(bank, { feather: 2, rough: 0.3, roughScale: 0.1 }), { op: 'set', level: (x, y) => soil(x, y) * (0.85 + 1.05 * smoothstep(ground, 1880, y / s)), order: 'left', duration: 2 }));
    acts.push(K.reveal((st) => st.mask(ellipse(450, ground + 16, 380, 34, 0, 48), { feather: 16 }), { op: 'add', amount: 0.5, order: 'out', duration: 0.5 }));
    acts.push(...rock(stage));
    // The panda first (the hero), then the stalk it grips, growing up through its paw.
    const pd = panda(stage, rng, { x: 440, y: ground - 4, u: 100 });
    acts.push(...pd.body, ...pd.head, ...pd.twig);
    // A middle layer of paler culms, passing behind the ears.
    acts.push(...culm(stage, [[338, 600], [346, 200], [350, -80]], { w: 24, level: 1.35, nodes: [0.19, 0.44, 0.68, 0.88], quick: true, exclude: pd.ears }));
    acts.push(...culm(stage, [[589, 600], [580, 200], [576, -80]], { w: 22, level: 1.3, nodes: [0.16, 0.41, 0.66, 0.86], quick: true, exclude: pd.ears }));
    acts.push(...culm(stage, [[800, 1100], [786, 700], [772, 200], [766, -80]], { w: 36, level: 2.45, nodes: [0.15, 0.33, 0.51, 0.69, 0.87] }));
    acts.push(...pd.grip);
    // Near bamboo framing the left side.
    acts.push(...culm(stage, [[98, ground + 16], [110, 800], [128, 300], [136, -80]], { w: 42, level: 2.5, nodes: [0.1, 0.27, 0.44, 0.6, 0.76, 0.92] }));
    acts.push(...culm(stage, [[30, ground + 20], [26, 800], [16, 300], [10, -80]], { w: 26, level: 2.2, nodes: [0.16, 0.36, 0.55, 0.73, 0.9], quick: true }));
    // Canopy: a few dense clusters hanging from the stalks, paler ones further back.
    for (const [x, y, sprays, lv] of [
      [136, 300, [[0.45, 4, 185], [1.05, 3, 150], [-0.25, 3, 140]], 2.45],
      [118, 610, [[0.9, 3, 150], [1.55, 2, 120]], 2.35],
      [24, 420, [[0.7, 3, 140], [1.4, 2, 110]], 2.1],
      [776, 360, [[2.5, 4, 180], [1.95, 3, 140], [3.2, 2, 120]], 2.45],
      [770, 110, [[0.55, 3, 150], [1.2, 3, 135], [2.7, 2, 120]], 2.4],
      [780, 600, [[2.25, 3, 130]], 2.25],
      [560, 190, [[2.2, 3, 120], [1.5, 2, 100]], 1.5],
      [360, 90, [[0.8, 3, 125], [1.6, 2, 100]], 1.45],
    ]) {
      for (const [a, n, len] of sprays) acts.push(leafSpray(stage, x, y, a, n, len, rng, lv));
    }
    // Mist along the bank, grass and a few fallen leaves.
    acts.push(L.mistBand(stage, { y: ground - 30, height: 70, strength: 0.4, duration: 1.5 }));
    const grass = [];
    for (let i = 0; i < 26; i++) {
      const x = rng.float(0, 1070);
      if (x > 150 && x < 690) continue;
      const y = ground + rng.float(-2, 20);
      grass.push(bladePoly(x, y, -Math.PI / 2 + rng.float(-0.45, 0.45), rng.float(22, 50), 2.2, rng.float(-0.5, 0.5)));
    }
    acts.push(K.reveal((st) => st.mask(grass, { feather: 0.5 }), { op: 'set', level: 2.2, order: 'left', duration: 1.2 }));
    // Light falling on the ground before the panda, and fallen leaves scattered in perspective.
    acts.push(K.reveal((st) => K.radialMask(st, 470, 1380, 60, 430, 1.6), { op: 'carve', strength: 0.3, order: 'out', duration: 1 }));
    const fallen = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const y = 1300 + t * t * 420 + rng.float(-12, 12);
      const x = rng.float(80, 1000);
      const len = 60 + t * 50;
      const a = (rng.chance(0.5) ? 0 : Math.PI) + rng.float(-0.5, 0.5);
      fallen.push(bladePoly(x, y, a, len, len * 0.11, rng.float(-0.3, 0.3)).map(([px, py]) => [px, y + (py - y) * 0.45]));
    }
    acts.push(K.reveal((st) => st.mask(fallen, { feather: 0.6 }), { op: 'set', level: 2.2, order: 'down', duration: 0.8 }));
    // Moss dots (苔点) on the rock and along the bank.
    const moss = [];
    for (const [cx, cy, n, r] of [[700, 1150, 7, 26], [900, 1058, 8, 34], [1040, 1046, 6, 26], [220, 1262, 6, 30], [60, 1270, 5, 24], [980, 1270, 6, 30]]) {
      for (let i = 0; i < n; i++) moss.push(ellipse(cx + rng.gauss(0, r), cy + rng.gauss(0, r * 0.25), rng.float(3, 6.5), rng.float(2.5, 4.5), rng.float(0, 3), 12));
    }
    acts.push(K.reveal((st) => st.mask(moss, { feather: 0.8 }), { op: 'set', level: 2.7, order: 'left', duration: 0.8 }));
    acts.push(...pd.eyes);
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 950, y: 478, size: 58, mode: 'pour', amount: 1.5, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 875, 966, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Lambert shading of a bulging form lit from the upper left: `lo` on the lit side, `hi` in shade.
function bulge(stage, cx, cy, rx, ry, lo, hi, power = 2) {
  const s = stage.s;
  return (X, Y) => {
    const dx = (X / s - cx) / rx;
    const dy = (Y / s - cy) / ry;
    const dz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const lit = Math.max(0, -0.45 * dx - 0.55 * dy + 0.7 * dz);
    return lo + (hi - lo) * Math.pow(1 - Math.min(1, lit), power);
  };
}

// Closed outline around a centreline with a radius at each control point and rounded ends.
function tube(ctrl, radii, segs = 8) {
  const pts = spline(ctrl, segs);
  const n = pts.length;
  const rAt = (i) => {
    const f = (i / (n - 1)) * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(f));
    return radii[k] + (radii[k + 1] - radii[k]) * (f - k);
  };
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const r = rAt(i);
    left.push([pts[i][0] + nx * r, pts[i][1] + ny * r]);
    right.push([pts[i][0] - nx * r, pts[i][1] - ny * r]);
  }
  const cap = ([cx, cy], r, a0) => Array.from({ length: 7 }, (_, k) => [cx + Math.cos(a0 - (Math.PI * (k + 1)) / 8) * r, cy + Math.sin(a0 - (Math.PI * (k + 1)) / 8) * r]);
  const dirEnd = Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]);
  const dirStart = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  return [...left, ...cap(pts[n - 1], rAt(n - 1), dirEnd + Math.PI / 2), ...right.reverse(), ...cap(pts[0], rAt(0), dirStart - Math.PI / 2)];
}

// Fur along an outline: short tapered flicks pointing outward, laid down as one gesture.
function fringe(poly, rng, { count = 60, len = 16, width = 4, level = 2.7, spread = 0.4, keep = () => true, duration = 0.8 } = {}) {
  let area = 0;
  for (let i = 0; i < poly.length - 1; i++) area += poly[i][0] * poly[i + 1][1] - poly[i + 1][0] * poly[i][1];
  const sgn = area > 0 ? 1 : -1;
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const total = cum[cum.length - 1];
  const flicks = [];
  for (let k = 0; k < count; k++) {
    const d = ((k + rng.float(0.2, 0.8)) / count) * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const [x0, y0] = poly[i - 1];
    const [x1, y1] = poly[i];
    const seg = cum[i] - cum[i - 1] || 1;
    const px = x0 + ((x1 - x0) * (d - cum[i - 1])) / seg;
    const py = y0 + ((y1 - y0) * (d - cum[i - 1])) / seg;
    if (!keep(px, py)) continue;
    const a = Math.atan2((-(x1 - x0) / seg) * sgn, ((y1 - y0) / seg) * sgn) + rng.float(-spread, spread);
    const l = len * rng.float(0.6, 1.25);
    const w = (width * rng.float(0.7, 1.2)) / 2;
    const bx = px - Math.cos(a) * l * 0.35;
    const by = py - Math.sin(a) * l * 0.35;
    flicks.push([[bx - Math.sin(a) * w, by + Math.cos(a) * w], [px + Math.cos(a) * l, py + Math.sin(a) * l], [bx + Math.sin(a) * w, by - Math.cos(a) * w]]);
  }
  return K.reveal((st) => st.mask(flicks, { feather: 0.8 }), { op: 'set', level, order: 'out', duration, rest: 0.03 });
}

function ghostCulm(x, y, lean, w) {
  const top = -60;
  const tx = x + lean * (y - top);
  return K.reveal((st) => st.mask([[x - w / 2, y], [tx - w * 0.4, top], [tx + w * 0.4, top], [x + w / 2, y]], { feather: 4 }), { op: 'carve', strength: 0.32, order: 'up', duration: 0.45, rest: 0.02 });
}

// A bamboo culm along a gentle curve: segments with cylindrical shading, a carved gap and a
// dark ring at each node, tapering upward. `quick` lays a background culm in two gestures.
function culm(stage, ctrl, { w, level, nodes, quick = false, exclude = null }) {
  const acts = [];
  const s = stage.s;
  // Masks minus whatever stands in front of the culm.
  const cut = (st, polys, opts) => {
    const m = st.mask(polys, opts);
    if (!exclude) return m;
    const front = st.mask(exclude, { feather: 1 });
    return m.map((a, X, Y) => a * (1 - front.at(X, Y)));
  };
  const path = spline(ctrl, 16);
  const at = (t) => path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))];
  const width = (t) => w * (1 - 0.3 * t);
  const xAt = (vy) => {
    for (let i = 1; i < path.length; i++) {
      if (path[i][1] <= vy) {
        const [x0, y0] = path[i - 1];
        const [x1, y1] = path[i];
        return x0 + ((x1 - x0) * (vy - y0)) / (y1 - y0 || 1);
      }
    }
    return path[path.length - 1][0];
  };
  const tone = (X, Y) => {
    const vy = Y / s;
    const hw = width(smoothstep(ctrl[0][1], ctrl[ctrl.length - 1][1], vy)) / 2;
    return level * (0.82 + 0.3 * smoothstep(-1, 1, (X / s - xAt(vy)) / hw)) * (1 + 0.06 * stage.noise.n2(X * 0.05, Y * 0.01));
  };
  const segment = (a, b) => {
    const left = [];
    const right = [];
    for (let k = 0; k <= 8; k++) {
      const t = a + ((b - a) * k) / 8;
      const [px, py] = at(t);
      const hw = (width(t) / 2) * (1 + 0.06 * Math.pow(Math.abs(k / 4 - 1), 4));
      left.push([px - hw, py]);
      right.push([px + hw, py]);
    }
    return [...left, ...right.reverse()];
  };
  const cuts = [0, ...nodes, 1];
  const segs = cuts.slice(0, -1).map((a, i) => segment(a, cuts[i + 1]));
  if (quick) acts.push(K.reveal((st) => cut(st, segs, { feather: 0.8, rough: 0.1, roughScale: 0.3 }), { op: 'set', level: tone, order: 'up', duration: 0.9, rest: 0.03 }));
  else segs.forEach((poly, i) => acts.push(K.reveal((st) => cut(st, poly, { feather: 0.8, rough: 0.1, roughScale: 0.3 }), { op: 'set', level: tone, order: 'up', duration: 0.25 + (cuts[i + 1] - cuts[i]) * 1.6, rest: 0.02 })));
  const gaps = [];
  const rings = [];
  for (const t of nodes) {
    const [x, y] = at(t);
    const hw = width(t) / 2;
    gaps.push([[x - hw - 1, y + 1], [x + hw + 1, y + 1], [x + hw + 1, y + 3.5], [x - hw - 1, y + 3.5]]);
    rings.push(spline([[x - hw - 5, y - 5], [x, y - 1], [x + hw + 5, y - 5], [x + hw + 3, y - 1], [x, y + 2], [x - hw - 3, y - 1]], 4, true));
  }
  acts.push(K.reveal((st) => cut(st, gaps, { feather: 0.4 }), { op: 'carve', strength: 0.85, order: 'up', duration: 0.4, rest: 0.02 }));
  acts.push(K.reveal((st) => cut(st, rings, { feather: 0.5 }), { op: 'set', level: level * 1.12, order: 'up', duration: 0.4, rest: 0.03 }));
  return acts;
}

// A slender bamboo leaf (竹叶): short stalk, widest a third of the way, long pointed tip.
function bladePoly(x, y, angle, len, width, bend) {
  const left = [];
  const right = [];
  const n = 24;
  let px = x;
  let py = y;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = angle + bend * t * t;
    if (i > 0) {
      px += Math.cos(a) * (len / n);
      py += Math.sin(a) * (len / n);
    }
    const hw = width * (t < 0.3 ? Math.pow(smoothstep(0, 0.3, t), 0.7) : Math.pow((1 - t) / 0.7, 1.15));
    left.push([px - Math.sin(a) * hw, py + Math.cos(a) * hw]);
    right.push([px + Math.sin(a) * hw, py - Math.cos(a) * hw]);
  }
  return [...left, ...right.reverse()];
}

// 个 / 介 spray: a twig from the stalk with blades fanning from its tip, drooping; one gesture.
function leafSpray(stage, x, y, angle, n, len, rng, level = 2.35) {
  const s = stage.s;
  const bend = Math.cos(angle) >= 0 ? 0.3 : -0.3;
  const tx = x + Math.cos(angle) * 46;
  const ty = y + Math.sin(angle) * 46;
  const polys = [bladePoly(x, y, angle, 50, 1.8, 0)];
  for (let i = 0; i < n; i++) {
    const a = angle + (i - (n - 1) / 2) * 0.38 + rng.float(-0.08, 0.08);
    const l = len * (i === Math.floor(n / 2) ? 1.08 : rng.float(0.74, 0.95));
    polys.push(bladePoly(tx, ty, a, l, l * 0.095, bend));
  }
  return K.reveal((st) => st.mask(polys, { feather: 0.7 }), { op: 'set', level, order: (X, Y) => Math.hypot(X / s - x, Y / s - y), duration: 0.6 + n * 0.12, rest: 0.03 });
}

// 破岩: a split boulder at the right, the held stalk rooted in its crack; axe-cut facets (斧劈皴).
function rock(stage) {
  const acts = [];
  const outline = [[612, 1318], [626, 1240], [660, 1190], [712, 1144], [756, 1104], [790, 1092], [806, 1118], [826, 1070], [870, 1046], [948, 1052], [1006, 1030], [1100, 1038], [1100, 1322], [990, 1310], [870, 1320], [740, 1308]];
  acts.push(K.reveal((st) => st.mask(outline, { feather: 2, rough: 0.35, roughScale: 0.15 }), { op: 'set', level: stage.mottle(2.25, 0.14, 0.02), order: 'up', duration: 1.4 }));
  const tops = [
    [[628, 1238], [660, 1192], [712, 1146], [756, 1106], [790, 1094], [798, 1110], [764, 1128], [720, 1166], [680, 1206], [642, 1248]],
    [[828, 1072], [870, 1048], [948, 1054], [1006, 1032], [1100, 1040], [1100, 1064], [1010, 1062], [950, 1080], [884, 1076], [838, 1094]],
  ];
  acts.push(K.reveal((st) => st.mask(tops, { feather: 3, rough: 0.3, roughScale: 0.2 }), { op: 'carve', strength: 0.5, order: 'right', duration: 0.6, rest: 0.03 }));
  // The split where the bamboo roots, and axe-cut strokes down the faces.
  acts.push(K.pour(spline([[806, 1118], [812, 1166], [798, 1224], [808, 1300]], 8), { width: 6, amount: 1.6, speed: 300, scatter: 0, rest: 0.03 }));
  const cuts = [];
  for (const [x0, y0, x1, y1] of [[818, 1116, 824, 1296], [700, 1180, 668, 1256], [736, 1150, 700, 1240], [764, 1132, 740, 1200], [880, 1080, 850, 1160], [922, 1082, 896, 1170], [962, 1080, 944, 1140], [1012, 1066, 986, 1150], [1052, 1066, 1032, 1126]]) {
    cuts.push(bladePoly(x0, y0, Math.atan2(y1 - y0, x1 - x0), Math.hypot(x1 - x0, y1 - y0), 2.2, 0));
  }
  acts.push(K.reveal((st) => st.mask(cuts, { feather: 0.6 }), { op: 'carve', strength: 0.5, order: 'right', duration: 0.6, rest: 0.03 }));
  return acts;
}

// Giant panda sitting upright, front view, light from the upper left: white fur modelled soft,
// black fur with a sheen on its lit edges and furry fringes, 八-shaped eye patches. Returns phases
// so the scene can interleave them with the bamboo.
function panda(stage, rng, { x, y, u }) {
  const P = (dx, dy) => [x + dx * u, y + dy * u];
  const C = (pts, segs = 8, closed = true) => spline(pts.map(([a, b]) => P(a, b)), segs, closed);
  const T = (ctrl, radii) => tube(ctrl, radii).map(([a, b]) => P(a, b));
  const mirror = (pts) => pts.map(([a, b]) => [-a, b]);
  const fur = (poly, level, order = 'down', duration = 1.2, fr = 1.6) =>
    K.reveal((st) => st.mask(poly, { feather: fr, rough: 0.42, roughScale: 0.75 }), { op: 'set', level, order, duration, rest: 0.05 });
  const black = stage.mottle(2.75, 0.06, 0.03);
  const blackFur = (poly, order, duration, n = 200) => [fur(poly, black, order, duration), fringe(poly, rng, { count: n, len: 8, width: 3, level: 2.55, spread: 0.35 })];
  const sheen = (pts, width = 6, strength = 0.3) => K.carve(spline(pts.map(([a, b]) => P(a, b)), 8), { width, strength, speed: 240, rim: 0, taper: K.taperBoth, rest: 0.03 });
  const body = [];
  const head = [];
  const twig = [];
  const grip = [];
  const eyes = [];

  // Pear-shaped seated body: narrow at the shoulders, round belly.
  const half = [[0, -4.7], [1.05, -4.58], [1.62, -4.2], [2.08, -3.45], [2.42, -2.62], [2.7, -1.8], [2.84, -1.0], [2.5, -0.38], [1.5, -0.02], [0, 0.08]];
  const bodyPoly = C([...half, ...mirror(half).reverse().slice(1, -1)]);
  body.push(fur(bodyPoly, bulge(stage, x - 0.2 * u, y - 2.4 * u, 3.0 * u, 3.0 * u, 0.02, 0.26, 2.2), 'down', 2.2));
  body.push(K.pour(C([[2.2, -3.2], [2.44, -2.56], [2.7, -1.8]], 8, false), { width: 7, amount: 0.5, speed: 220, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // Hind legs: a round thigh at each side, the foot turned up with its sole toward us.
  for (const sd of [-1, 1]) {
    const leg = C([[1.72, -1.98], [2.4, -1.94], [2.86, -1.5], [3.0, -0.88], [2.86, -0.34], [2.5, -0.02], [2.05, 0.14], [1.52, 0.16], [1.1, 0.02], [0.96, -0.3], [1.12, -0.62], [1.46, -0.8], [1.52, -1.3], [1.6, -1.72]].map(([a, b]) => [sd * a, b]));
    body.push(...blackFur(leg, 'up', 1.3, 220));
    body.push(sheen(sd < 0 ? [[-2.2, -1.9], [-2.75, -1.55], [-2.95, -0.95]] : [[1.72, -1.9], [2.2, -1.95], [2.6, -1.75]], 8, 0.32));
    // Sole: a pale crescent above it and four toe pads.
    body.push(K.carve(C([[sd * 1.08, -0.42], [sd * 1.5, -0.66], [sd * 2.1, -0.62], [sd * 2.6, -0.34]], 8, false), { width: 4, strength: 0.4, speed: 220, rim: 0, taper: K.taperBoth, rest: 0.03 }));
    const pads = [];
    for (let k = 0; k < 4; k++) {
      const [tx, ty] = P(sd * (1.32 + k * 0.33), -0.42 - 0.12 * Math.sin(((k + 0.5) / 4) * Math.PI));
      pads.push(ellipse(tx, ty, 0.1 * u, 0.08 * u, 0, 16));
    }
    body.push(K.reveal((st) => st.mask(pads, { feather: 2 }), { op: 'carve', strength: 0.22, order: 'left', duration: 0.4, rest: 0.02 }));
  }
  // Resting arm (viewer's left): hangs from the shoulder, paw on the round belly.
  body.push(...blackFur(T([[-1.6, -4.25], [-2.25, -3.55], [-2.4, -2.62], [-2.0, -1.98], [-1.28, -1.8]], [0.72, 0.62, 0.55, 0.5, 0.45]), 'down', 1.4));
  body.push(sheen([[-1.5, -4.95], [-2.45, -4.3], [-2.95, -3.3]], 7, 0.32));
  for (const k of [0, 1, 2]) body.push(K.carve(spline([P(-0.9, -2.08 + k * 0.17), P(-1.04, -2.05 + k * 0.17), P(-1.18, -2.1 + k * 0.17)], 4), { width: 2.6, strength: 0.4, speed: 120, rest: 0.02 }));
  // Gripping arm (viewer's right): elbow low, forearm up to the stalk, paw wrapped round it.
  body.push(...blackFur(T([[1.6, -4.25], [2.3, -3.6], [2.74, -3.12], [3.2, -3.5], [3.56, -3.96]], [0.72, 0.6, 0.53, 0.48, 0.46]), 'right', 1.4));
  body.push(sheen([[1.95, -4.85], [2.62, -4.25], [3.1, -3.98], [3.5, -4.4]], 6, 0.3));
  // Ears behind the head.
  const hx = 0.02;
  const hy = -5.46;
  const W = 1.7;
  const ears = [];
  for (const sd of [-1, 1]) {
    const [ex, ey] = [hx + sd * 0.76 * W, hy - 0.7 * W];
    body.push(...blackFur(ellipse(...P(ex, ey), 0.34 * W * u, 0.32 * W * u, sd * 0.3, 40), 'out', 0.7, 90));
    ears.push(ellipse(...P(ex, ey), 0.34 * W * u + 6, 0.32 * W * u + 6, sd * 0.3, 40));
  }
  // Head: broad and round with full cheeks, tilted a touch toward the stalk.
  const tilt = 0.07;
  const R = (dx, dy) => {
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    return [hx + (dx * c - dy * sn) * W, hy + (dx * sn + dy * c) * W];
  };
  const headHalf = [[0, -0.9], [0.52, -0.84], [0.86, -0.55], [1.0, -0.1], [0.97, 0.32], [0.78, 0.62], [0.42, 0.82], [0, 0.87]];
  const headPoly = C([...headHalf, ...mirror(headHalf).reverse().slice(1, -1)].map(([a, b]) => R(a, b)));
  const [hcx, hcy] = P(hx, hy);
  head.push(fur(headPoly, bulge(stage, hcx, hcy, 1.05 * W * u, 0.95 * W * u, 0.02, 0.42, 2.6), 'out', 1.8));
  // White ruff on the cheeks, spilling over the black shoulders.
  head.push(fringe(headPoly, rng, { count: 260, len: 8, width: 3, level: 0.1, spread: 0.35, keep: (px, py) => py > hcy + 0.1 * W * u && Math.abs(px - hcx) > 0.5 * W * u }));
  head.push(K.pour(C([R(-0.62, 0.7), R(-0.3, 0.86), R(0.1, 0.9), R(0.5, 0.8), R(0.75, 0.64)], 8, false), { width: 18, amount: 0.24, speed: 240, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // Snout: a soft shadow along its lower edge reads as a quiet smile.
  head.push(K.pour(C([R(-0.4, 0.3), R(-0.3, 0.55), R(0, 0.64), R(0.3, 0.55), R(0.4, 0.3)], 8, false), { width: 16, amount: 0.22, speed: 240, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // 八-shaped eye patches: narrow at the top inner end, broad and drooping outward.
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const along = Math.sin(a);
      pts.push([Math.cos(a) * 0.16 * (1 + 0.24 * along), along * 0.29]);
    }
    const rot = sd * -0.62;
    const patch = pts.map(([a, b]) => R(sd * 0.37 + a * Math.cos(rot) - b * Math.sin(rot), 0.03 + a * Math.sin(rot) + b * Math.cos(rot)));
    head.push(fur(C(patch), stage.mottle(2.8, 0.05, 0.03), 'down', 0.6, 1.2));
  }
  // Nose with a glint, then the mouth.
  head.push(K.reveal((st) => st.mask(C([R(-0.15, 0.3), R(0, 0.27), R(0.15, 0.3), R(0.1, 0.4), R(0, 0.45), R(-0.1, 0.4)]), { feather: 0.8 }), { op: 'set', level: 2.8, order: 'down', duration: 0.4, rest: 0.05 }));
  const [gx, gy] = P(...R(-0.04, 0.32));
  head.push(K.reveal((st) => st.mask(ellipse(gx, gy, 7, 4, -0.2, 12), { feather: 1 }), { op: 'carve', strength: 0.6, order: 'out', duration: 0.2, rest: 0.02 }));
  head.push(K.pour(C([R(0, 0.44), R(0, 0.52)], 4, false), { width: 4, amount: 1.8, speed: 60, taper: K.even, scatter: 0, rest: 0.02 }));
  head.push(K.pour(C([R(-0.16, 0.52), R(-0.08, 0.57), R(0, 0.52), R(0.08, 0.57), R(0.16, 0.52)], 6, false), { width: 4, amount: 1.8, speed: 90, taper: K.taperBoth, scatter: 0, rest: 0.03 }));
  // A leafy twig clenched at the mouth corner, its leaves hanging over the white chest.
  const [mx, my] = P(...R(-0.1, 0.54));
  twig.push(K.pour(spline([[mx + 34, my - 6], [mx + 6, my], [mx - 22, my + 10]], 4), { width: 5, amount: 2.4, speed: 140, taper: (t) => 1 - 0.4 * t, scatter: 0, rest: 0.03 }));
  const leaves = [[4, 2, 1.08, 140, 0.3], [-10, 6, 1.6, 166, 0.12], [-22, 10, 2.18, 136, -0.3]].map(([dx, dy, a, len, b]) => bladePoly(mx + dx, my + dy, a, len, len * 0.1, b));
  twig.push(K.reveal((st) => st.mask(leaves, { feather: 0.7 }), { op: 'set', level: 2.5, order: 'down', duration: 0.8, rest: 0.05 }));
  // The paw closes over the stalk once it has grown past.
  grip.push(fur(T([[3.2, -3.5], [3.56, -3.96]], [0.48, 0.46]), black, 'right', 0.5));
  for (const k of [0, 1, 2]) {
    const yy = -4.12 + k * 0.2;
    grip.push(K.carve(spline([P(3.34, yy), P(3.58, yy - 0.05), P(3.8, yy + 0.02)], 4), { width: 2.6, strength: 0.4, speed: 140, rest: 0.02 }));
  }
  // Eyes: dark and glossy inside the patches, catchlights dotted last (画龙点睛).
  for (const sd of [-1, 1]) {
    const [ex, ey] = P(...R(sd * 0.3, -0.06));
    eyes.push(K.reveal((st) => st.mask(ellipse(ex, ey, 12, 13, 0, 24), { feather: 1.5 }), { op: 'carve', strength: 0.32, order: 'out', duration: 0.4, rest: 0.05 }));
    eyes.push(K.reveal((st) => st.mask(ellipse(ex - 3, ey - 4, 5.5, 5.5, 0, 12), { feather: 0.5 }), { op: 'carve', strength: 0.97, order: 'out', duration: 0.25, rest: 0.15 }));
  }
  return { body, head, twig, grip, eyes, ears };
}
