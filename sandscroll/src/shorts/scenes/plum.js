import { spline, ellipse, TAU } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 梅 · 墙角数枝梅，凌寒独自开 — the corner of a white-washed Jiangnan wall under its dark tiled
// coping, snow on the tiles, and a few plum sprays rising from behind it to bloom alone in the
// cold beneath a pale moon. Portrait canvas 1080x1920.
export default {
  id: 'plum',
  music: 'plum',
  title: { cn: '梅', en: 'Plum Blossom' },
  hook: { cn: '凌寒独自开，送给熬过冬天的你', en: 'For anyone getting through a hard winter' },
  theme: '坚韧 · 希望',
  poem: {
    columns: ['墙角数枝梅', '凌寒独自开'],
    cn: '墙角数枝梅，凌寒独自开',
    en: 'A few sprays of plum by the corner of the wall bloom alone, braving the cold.',
    by: '宋 · 王安石《梅花》  ·  Wang Anshi, Song dynasty',
  },
  seal: '暗香',
  build(stage, rng) {
    const off = rng.float(0, 100);
    const acts = [];
    acts.push(...K.cover(stage, stage.vgrad(1.6, 1.0, 0, 1080, 0.1, off), { y0: -60, y1: 1120 }));
    acts.push(...wall(stage, rng, off));
    const moon = [rng.float(256, 268), rng.float(636, 648), 104];
    acts.push(...K.moon(stage, moon[0], moon[1], moon[2], { halo: 2.1, glow: 0.32, strength: 0.86, duration: 5 }));
    acts.push(...coping(stage));
    const tree = plumTree(stage, rng);
    acts.push(...tree.acts);
    acts.push(...blossoms(rng, tree.spots, moon));
    acts.push(...snowfall(stage, rng, 150));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 968, y: 470, size: 64, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 885, 885, { size: 62, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Wall geometry: an outer corner seen from below. The long face runs off to the left almost
// square to us; the short face turns away to the right, so its lines fall more steeply.
const CX = 700;
const EY = 1090;
const eave = (x) => (x <= CX ? EY + (CX - x) * 0.055 : EY + (x - CX) * 0.19);
const copeH = (x) => (x <= CX ? 88 - (CX - x) * 0.014 : 88 - (x - CX) * 0.055);
const ridgeY = (x) => eave(x) - copeH(x) - 22 * Math.exp(-(((x - CX) / 44) ** 2));
const along = (fn, x0, x1, dy = 0, step = 8) => {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) pts.push([x, fn(x) + dy]);
  return pts;
};

function wall(stage, rng, off) {
  const s = stage.s;
  const shade = (top, bottom) => {
    const m = stage.mottle(1, 0.14, 0.01, off);
    return (x, y) => {
      const t = Math.min(1, Math.max(0, (y / s - EY) / 820));
      return (top + (bottom - top) * t) * m(x, y);
    };
  };
  const leftFace = [[-20, eave(-20)], [CX, EY], [CX, 1935], [-20, 1935]];
  const rightFace = [[CX, EY], [1100, eave(1100)], [1100, 1935], [CX, 1935]];
  const acts = [
    K.reveal((st) => st.mask(leftFace, { feather: 0.8 }), { op: 'set', level: shade(0.22, 1.05), order: 'down', duration: 4 }),
    K.reveal((st) => st.mask(rightFace, { feather: 0.8 }), { op: 'set', level: shade(0.5, 1.35), order: 'down', duration: 2 }),
    K.pour([[CX, EY + 10], [CX, 1935]], { width: 3, amount: 0.7, speed: 700, taper: K.even, scatter: 0 }),
  ];
  // Faint rain stains running down the whitewash from under the eave.
  for (const [x, len] of [[90, 260], [300, 520], [520, 200], [820, 420], [980, 240]]) {
    const sx = x + rng.float(-30, 30);
    const y0 = eave(sx) + 16;
    acts.push(K.pour([[sx, y0], [sx + rng.float(-8, 8), y0 + len * 0.5], [sx + rng.float(-10, 10), y0 + len]], { width: rng.float(60, 100), amount: rng.float(0.06, 0.1), speed: 700, taper: (u) => 1 - 0.8 * u, scatter: 0, hard: 0, rest: 0.05 }));
  }
  return acts;
}

// Dark tiled coping (瓦檐): tile body, ribs of the tile rows, round tile ends along the eave and
// the shadow the eave throws on the white wall.
function coping(stage) {
  const s = stage.s;
  const acts = [];
  const top = along(ridgeY, -20, 1100, 0);
  const bottom = along(eave, -20, 1100, 2).reverse();
  acts.push(K.reveal((st) => st.mask([...top, ...bottom], { feather: 0.8, rough: 0.1, roughScale: 0.3 }), { op: 'set', level: stage.mottle(2.55, 0.1, 0.03), order: 'left', duration: 3 }));
  acts.push(K.pour(along(ridgeY, -20, 1100, 4, 6), { width: 16, amount: 2.4, speed: 900, taper: K.even, scatter: 0.1 }));
  const ribs = [];
  const ends = [];
  for (let x = -12; x < 1100; ) {
    const y0 = ridgeY(x) + 22;
    const y1 = eave(x) - 8;
    ribs.push([[x - 1.6, y0], [x + 1.6, y0], [x + 1.6, y1], [x - 1.6, y1]]);
    ends.push(ellipse(x, eave(x) + 4, 7.5, 8, 0, 14));
    x += x < CX ? 22 : Math.max(9, 22 - (x - CX) * 0.03);
  }
  acts.push(K.reveal((st) => st.mask(ribs, { feather: 0.6 }), { op: 'carve', strength: 0.5, order: 'left', duration: 2.5 }));
  acts.push(K.reveal((st) => st.mask(ends, { feather: 0.5 }), { op: 'set', level: 2.6, order: 'left', duration: 2 }));
  // The hip where the two faces' tiles meet.
  acts.push(K.pour([[CX, ridgeY(CX) + 6], [CX, EY + 6]], { width: 7, amount: 2.4, speed: 200, taper: K.even }));
  const band = [...along(eave, -20, 1100, 10), ...along(eave, -20, 1100, 58).reverse()];
  acts.push(
    K.reveal((st) => st.mask(band, { feather: 1 }), {
      op: 'add',
      amount: (x, y) => 0.5 * Math.max(0, 1 - (y / s - eave(x / s) - 10) / 48) ** 1.5,
      order: 'left',
      duration: 1.5,
    }),
  );
  return acts;
}

// Snow lying along the ridge, a thin line along the eave, drawn after the plum so the wall top
// sits in front of the trunk.
function snowOnWall(stage) {
  const n = stage.noise;
  const cap = [];
  for (let x = -20; x <= 1100; x += 6) cap.push([x, ridgeY(x) - 16 - 10 * Math.abs(n.n1(x * 0.025 + 3))]);
  const base = along(ridgeY, -20, 1100, 7, 6).reverse();
  return [
    K.reveal((st) => st.mask([...cap, ...base], { feather: 0.8, rough: 0.2, roughScale: 0.4 }), { op: 'carve', strength: 0.9, order: 'left', duration: 2.5 }),
    K.carve(along(eave, -20, 1100, -7, 10), { width: 4, strength: 0.55, speed: 900, taper: K.even, rest: 0.05 }),
  ];
}

// Angular old plum (女字枝): a thick trunk rising from behind the wall, a main branch reaching up
// across the moon, one rising right and a low spray over the wall, with straight young shoots.
function plumTree(stage, rng) {
  const acts = [];
  const spots = [];
  const trunk = [[666, 996], [654, 944], [622, 896], [592, 862], [598, 812], [566, 770]];
  const A = [[566, 770], [520, 740], [490, 694], [436, 664], [384, 634], [334, 612], [284, 580], [232, 548], [180, 512], [130, 490]];
  const B = [[604, 842], [642, 798], [652, 740], [690, 690], [700, 630], [724, 578]];
  const C = [[622, 934], [556, 952], [486, 928], [414, 944], [338, 912], [262, 924], [186, 896], [126, 904]];
  const D = [[652, 742], [700, 744], [748, 722]];
  const limbs = [
    [trunk, 66, 0.35, 50],
    [A, 42, 0.8, 66],
    [B, 30, 0.75, 70],
    [C, 26, 0.78, 76],
    [D, 13, 0.7, 90],
  ];
  for (const [pts, w, k, speed] of limbs) acts.push(K.pour(pts, { width: w, amount: 3, speed, taper: (u) => 1 - k * u, scatter: 0.3, hard: 0.5, rest: 0.1 }));
  // Old bark: a few split lines along the trunk.
  for (const [dx, from, to] of [[-10, 0.05, 0.55], [8, 0.3, 0.9], [-4, 0.62, 1]]) {
    const seg = spline(trunk, 6).map(([x, y]) => [x + dx, y]);
    acts.push(K.carve(seg.slice(Math.round(from * (seg.length - 1)), Math.round(to * (seg.length - 1)) + 1), { width: 3, strength: 0.42, speed: 200, rest: 0.03, taper: K.taperBoth }));
  }
  // Young shoots: thin, straight, reaching upward: [limb, node, angle, length].
  const shoots = [
    [A, 2, -1.7, 120],
    [A, 4, -2.0, 100],
    [A, 6, -1.3, 90],
    [A, 8, -2.3, 80],
    [B, 1, -2.3, 100],
    [B, 3, -1.2, 110],
    [B, 5, -1.9, 90],
    [C, 2, -1.8, 110],
    [C, 3, -1.2, 80],
    [C, 4, -2.0, 100],
    [C, 6, -1.6, 90],
    [D, 2, -0.9, 60],
  ];
  for (const [br, i, a, len] of shoots) {
    const [x, y] = br[i];
    const mid = [x + Math.cos(a) * len * 0.5 + rng.float(-5, 5), y + Math.sin(a) * len * 0.5];
    const tip = [x + Math.cos(a + rng.float(-0.12, 0.12)) * len, y + Math.sin(a) * len];
    acts.push(K.pour([[x, y], mid, tip], { width: 8, amount: 2.8, speed: 120, taper: (u) => 1 - 0.8 * u, scatter: 0.1, rest: 0.05 }));
    spots.push([mid, 1], [tip, 0]);
  }
  for (const br of [A, B, C, D]) for (let i = 2; i < br.length; i++) spots.push([br[i], 2]);
  acts.push(...snowOnWall(stage));
  // Snow resting on the upper side of the older wood.
  for (const [pts, w, k] of limbs.slice(0, 4)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (Math.abs(y1 - y0) > len * 0.75) continue;
      let nx = (y1 - y0) / len;
      let ny = -(x1 - x0) / len;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const o = (w * (1 - k * ((i + 0.5) / (pts.length - 1)))) * 0.42;
      const p = (t) => [x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o];
      acts.push(K.carve([p(0.12), p(0.5), p(0.88)], { width: 3 + o * 0.25, strength: 0.75, speed: 160, rest: 0.02, taper: K.taperBoth }));
    }
  }
  return { acts, spots };
}

// Blossoms along the branches: open flowers, side views and buds. Over the bright moon they are
// laid in as pale shadows instead of carved (梅影映月).
function blossoms(rng, spots, [mx, my, mr]) {
  const acts = [];
  for (const [[x, y], kind] of spots) {
    const count = kind === 2 ? rng.int(1, 2) : 1;
    for (let k = 0; k < count; k++) {
      let bx = x + rng.float(-20, 20);
      let by = y + rng.float(-18, 18);
      const side = kind !== 0 && rng.chance(0.28);
      const r = kind === 0 ? rng.float(8, 10.5) : side ? rng.float(18, 24) : rng.float(21, 29);
      // A flower never straddles the moon's rim: it slips wholly inside (as a shadow) or outside.
      const d = Math.max(1, Math.hypot(bx - mx, by - my));
      if (Math.abs(d - mr) < r + 2) {
        const f = (d < mr ? mr - r - 2 : mr + r + 2) / d;
        bx = mx + (bx - mx) * f;
        by = my + (by - my) * f;
      }
      const shadow = d < mr;
      if (kind === 0) acts.push(...bud(bx, by, r, shadow));
      else if (side) acts.push(...sideBlossom(bx, by, r, rng.float(-2.2, -0.9), shadow));
      else acts.push(...blossom(bx, by, r, rng.float(0, TAU), shadow));
    }
  }
  return acts;
}

const petalFill = (shapes, shadow, duration) =>
  shadow
    ? K.reveal((st) => st.mask(shapes, { feather: 0.4 }), { op: 'set', level: 0.62, order: 'out', duration, rest: 0.03 })
    : K.reveal((st) => st.mask(shapes, { feather: 0.6 }), { op: 'carve', strength: 0.93, order: 'out', duration, rest: 0.03 });

// Five rounded petals, a dark calyx and stamens.
function blossom(x, y, r, rot, shadow) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * TAU) / 5;
    petals.push(ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.45, a, 16));
  }
  const acts = [petalFill(petals, shadow, 0.35)];
  acts.push(K.reveal((st) => st.mask(ellipse(x, y, r * 0.14, r * 0.14, 0, 10), { feather: 0.4 }), { op: 'set', level: 1.7, order: 'out', duration: 0.08, rest: 0 }));
  // Stamens: fine filaments ending in a ring of anther dots.
  const anthers = [];
  for (let i = 0; i < 7; i++) {
    const a = rot + 0.3 + (i * TAU) / 7;
    const d = r * (0.4 + 0.08 * Math.sin(i * 2.3));
    acts.push(K.pour([[x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16], [x + Math.cos(a) * d, y + Math.sin(a) * d]], { width: 1, amount: 0.9, speed: 120, taper: K.even, rest: 0 }));
    anthers.push(ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.07, r * 0.07, 0, 8));
  }
  acts.push(K.reveal((st) => st.mask(anthers, { feather: 0.3 }), { op: 'set', level: 1.8, order: 'out', duration: 0.08, rest: 0.02 }));
  return acts;
}

// A flower seen from the side: a cup of three petals over a dark calyx; `dir` points its face.
function sideBlossom(x, y, r, dir, shadow) {
  const petals = [-0.62, 0, 0.62].map((d) => ellipse(x + Math.cos(dir + d) * r * 0.45, y + Math.sin(dir + d) * r * 0.45, r * 0.5, r * 0.4, dir + d, 16));
  return [
    petalFill(petals, shadow, 0.3),
    K.reveal((st) => st.mask(ellipse(x - Math.cos(dir) * r * 0.12, y - Math.sin(dir) * r * 0.12, r * 0.3, r * 0.22, dir, 12), { feather: 0.4 }), { op: 'set', level: 2.5, order: 'out', duration: 0.08, rest: 0.02 }),
  ];
}

function bud(x, y, r, shadow) {
  return [
    petalFill([ellipse(x, y, r, r * 1.1, 0, 12)], shadow, 0.15),
    K.reveal((st) => st.mask(ellipse(x, y + r * 0.9, r * 0.55, r * 0.4, 0, 10), { feather: 0.4 }), { op: 'set', level: 2.5, order: 'out', duration: 0.08, rest: 0.02 }),
  ];
}

// Falling flakes carved in one soft gesture.
function snowfall(stage, rng, count) {
  const flakes = [];
  for (let i = 0; i < count; i++) {
    const r = rng.float(2.6, 5.4);
    flakes.push(ellipse(rng.float(0, 1080), rng.float(0, 1180), r, r, 0, 8));
  }
  return [K.reveal((st) => st.mask(flakes, { feather: 0.4 }), { op: 'carve', strength: 0.85, order: () => 0, jitter: 1, duration: 5 })];
}
