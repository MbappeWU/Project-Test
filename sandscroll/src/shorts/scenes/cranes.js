import { ridge, underRidge, spline, ellipse, clamp, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import * as L from '../../core/landscape.js';

// 天涯若比邻 — two far shores of a moonlit sea (the Great Wall and a Golden Gate tower) joined by
// a tall arch of luminous red-crowned cranes, a bridge of friendship (鹊桥) passing beneath the
// moon. Portrait canvas 1080x1920.
export default {
  id: 'cranes',
  music: 'finale',
  title: { cn: '天涯若比邻', en: 'Neighbours across the Ocean' },
  hook: { cn: '朋友不怕远：天涯若比邻', en: 'True friends are never far apart' },
  theme: '友谊',
  poem: {
    columns: ['海内存知己', '天涯若比邻'],
    cn: '海内存知己，天涯若比邻',
    en: 'A true friend within the four seas makes the ends of the earth feel next door.',
    by: '唐 · 王勃《送杜少府之任蜀州》  ·  Wang Bo, Tang dynasty',
  },
  seal: '和合',
  build(stage, rng) {
    const n = stage.noise;
    const s = stage.s;
    const H0 = 1165;
    const off = rng.float(0, 100);
    const mx = rng.float(525, 555);
    const my = 568;
    const mr = 108;
    const acts = [];

    // Night sky, darkest overhead, with a warm glow along the horizon behind the shores.
    const grain = stage.vgrad(1, 1, 0, H0, 0.1, off);
    const sky = (x, y) => {
      const t = clamp(y / s / H0, 0, 1);
      return (2.35 - 0.75 * t - 0.75 * smoothstep(0.72, 1, t)) * grain(x, y);
    };
    acts.push(...K.cover(stage, sky, { y0: -60, y1: H0 + 40 }));
    const sea = stage.streaky(1.35, 0.2, 0.0014, 0.07, off + 5);
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1090, H0], [1090, 1930], [-10, 1930]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => sea(x, y) * (0.85 + 0.45 * Math.min(1, (y / s - H0) / 650)),
        order: 'down',
        duration: 6,
      }),
    );
    acts.push(...K.moon(stage, mx, my, mr, { halo: 2.4, glow: 0.5, duration: 6 }));

    // West: a headland where the Great Wall runs down to the sea (老龙头).
    const west = ridge(n, -140, 470, H0 + 3, 50, { offset: off, freq: 1 / 200, peaks: [[130, 130, 170]], taper: 0.28 });
    acts.push(L.range(stage, west, { base: H0 + 3, level: 2.25, mist: 0.25, mistDepth: 40, duration: 4 }));
    acts.push(...L.greatWall(stage, west, { x0: -10, x1: 400, offset: 3, thick: 12, tooth: 8, level: 2.9, towers: [peakX(west, 60, 220), 360], towerW: 40, towerH: 34, duration: 4 }));
    // East: a low headland with a suspension-bridge tower.
    const east = ridge(n, 620, 1240, H0 + 3, 36, { offset: off + 40, freq: 1 / 220, peaks: [[1000, 50, 170]], taper: 0.3 });
    acts.push(L.range(stage, east, { base: H0 + 3, level: 2.15, mist: 0.25, mistDepth: 40, order: 'right', duration: 4 }));
    acts.push(...bridgeTower(stage, 800, H0 + 2, 220, 1115));

    acts.push(...K.moonPath(stage, rng, { x: mx, horizon: H0, spread: 60, count: 34 }));
    acts.push(...K.waves(stage, rng, { horizon: H0, avoid: mx, count: 12, strength: 0.7 }));

    // The crane bridge: a tall arch rising from the west shore, under the moon, down to the east.
    const foot0 = [230, 1085];
    const foot1 = [850, 1070];
    const apex = [mx, 752];
    const path = archPath(foot0, apex, foot1);
    const count = 9;
    for (const c of placeAlong(path, count, (t) => 108 + 70 * Math.sin(Math.PI * t))) {
      const phase = (0.15 + c.i * 0.37) % 1;
      acts.push(...crane(stage, c.x, c.y, c.size, c.heading * 0.7, phase));
    }

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 962, y: 478, size: 60, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 884, 870, { size: 60, seed: rng.int(1, 999) }));
    return acts;
  },
};

function peakX(crest, x0, x1) {
  let best = x0;
  for (let x = x0; x <= x1; x += 4) if (L.crestAt(crest, x) < L.crestAt(crest, best)) best = x;
  return best;
}

// Arch through three points: two feet and an apex, as a dense polyline.
function archPath(a, top, b) {
  const pts = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const left = t < 0.5;
    const u = left ? t * 2 : (t - 0.5) * 2;
    const [x0, y0] = left ? a : top;
    const [x1, y1] = left ? top : b;
    // Ease in to the apex (horizontal tangent there), steep at the feet.
    const k = left ? Math.sin((u * Math.PI) / 2) : 1 - Math.cos((u * Math.PI) / 2);
    pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * k]);
  }
  return pts;
}

// Places `count` birds along a path, spaced in proportion to their size.
function placeAlong(pts, count, sizeAt) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const w = [0];
  for (let i = 1; i < pts.length; i++) w.push(w[i - 1] + (cum[i] - cum[i - 1]) / sizeAt(i / (pts.length - 1)));
  const W = w[w.length - 1];
  const out = [];
  let j = 1;
  for (let i = 0; i < count; i++) {
    const target = (W * (i + 0.5)) / count;
    while (j < pts.length - 1 && w[j] < target) j++;
    const f = (target - w[j - 1]) / (w[j] - w[j - 1] || 1);
    const [xa, ya] = pts[j - 1];
    const [xb, yb] = pts[j];
    const t = (j - 1 + f) / (pts.length - 1);
    out.push({ i, x: xa + (xb - xa) * f, y: ya + (yb - ya) * f, size: sizeAt(t), heading: Math.atan2(yb - ya, xb - xa) });
  }
  return out;
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

// A crane wing pointing straight up from its root (leading edge forward, +x): a broad arm and
// a fan of long primaries (飞羽) spread like fingers at the tip. Local units: body length = 1.
function wingShape() {
  const arm = [[0.16, 0.03], [0.21, -0.28], [0.23, -0.55], [0.15, -0.86], [-0.44, -0.8], [-0.5, -0.52], [-0.47, -0.24], [-0.42, 0.03]];
  const polys = [arm];
  const F = 6;
  for (let k = 0; k < F; k++) {
    const f = k / (F - 1);
    const bx = 0.1 - 0.52 * f;
    const by = -0.8 + 0.06 * f;
    const a = -1.48 - 0.95 * f;
    const len = 0.62 - 0.24 * f;
    const w = 0.055;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy * w;
    const py = dx * w;
    polys.push([
      [bx - dx * 0.12 + px, by - dy * 0.12 + py],
      [bx + dx * len * 0.55 + px * 1.05, by + dy * len * 0.55 + py * 1.05],
      [bx + dx * len * 0.9 + px * 0.55, by + dy * len * 0.9 + py * 0.55],
      [bx + dx * len, by + dy * len],
      [bx + dx * len * 0.9 - px * 0.55, by + dy * len * 0.9 - py * 0.55],
      [bx + dx * len * 0.55 - px * 1.05, by + dy * len * 0.55 - py * 1.05],
      [bx - dx * 0.12 - px, by - dy * 0.12 - py],
    ]);
  }
  return polys;
}
const WING = wingShape();

// The canonical wing turned to angle `ang` (radians, screen coords) at `root`, scaled along
// its span by `len` (foreshortening). A lowered wing is mirrored so it still leads forward.
function wingAt(root, ang, len = 1, width = 1) {
  const down = Math.sin(ang) > 0;
  const phi = down ? ang - Math.PI / 2 : ang + Math.PI / 2;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return WING.map((poly) =>
    poly.map(([a, b]) => {
      const px = a * width;
      const py = (down ? -b : b) * len;
      return [root[0] + px * c - py * s, root[1] + px * s + py * c];
    }),
  );
}

// Wingbeat poses as [near wing angle, far wing angle] (degrees): raised high, swept back, and
// the open glide seen from below, one wing above the body and one beneath.
const POSES = [[-78, -100], [-104, -124], [-132, -150], [100, -92], [76, -112]];

function pose(phase) {
  const f = clamp(phase, 0, 1) * (POSES.length - 1);
  const i = Math.min(POSES.length - 2, Math.floor(f));
  const t = f - i;
  const [a0, b0] = POSES[i];
  const [a1, b1] = POSES[i + 1];
  // The near wing jumps from above to below between poses 2 and 3.
  const near = i === 2 ? (t < 0.5 ? a0 : a1) : a0 + (a1 - a0) * t;
  return [(near * Math.PI) / 180, ((b0 + (b1 - b0) * t) * Math.PI) / 180];
}

// A red-crowned crane (丹顶鹤) in flight, carved as light: long straight neck and bill forward,
// broad fingered wings, legs trailing past the short tail, and a touch of red on the crown.
// `size` is the length from bill tip to toes; `phase` (0..1) picks the wingbeat pose.
export function crane(stage, x, y, size, heading, phase) {
  const u = size / 2.64;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const T = ([a, b]) => [x + (a * c - b * s) * u, y + (a * s + b * c) * u];
  const [nearAng, farAng] = pose(phase);
  const body = spline([[0.52, 0], [0.36, -0.13], [0.05, -0.17], [-0.3, -0.13], [-0.55, -0.06], [-0.72, -0.02], [-0.56, 0.06], [-0.28, 0.13], [0.08, 0.16], [0.38, 0.11]], 5, true);
  const near = wingAt([0.02, -0.06], nearAng, 1, 1);
  const far = wingAt([-0.1, -0.1], farAng, 0.8, 0.85);
  const neck = spline([[0.42, -0.02], [0.78, -0.035], [1.12, -0.04]], 6);
  const legA = [[-0.36, 0.1], [-0.75, 0.115], [-1.12, 0.13]];
  const legB = [[-0.34, 0.12], [-0.72, 0.15], [-1.07, 0.18]];
  const tf = (p) => ccw(p.map(T));
  return [
    K.reveal((st) => st.mask(far.map(tf), { feather: 0.6 }), { op: 'carve', strength: 0.66, order: 'left', duration: 0.5, rest: 0.02 }),
    K.reveal((st) => st.mask([tf(body), ...near.map(tf)], { feather: 0.6 }), { op: 'carve', strength: 0.95, order: 'left', duration: 0.9, rest: 0.03 }),
    K.carve(neck.map(T), { width: 0.16 * u, strength: 0.95, speed: 220, rim: 0.12, taper: (t) => 1 - 0.38 * t, rest: 0.02 }),
    K.reveal((st) => st.mask(ellipse(1.17, -0.04, 0.11, 0.085, 0, 14).map(T), { feather: 0.5 }), { op: 'carve', strength: 0.96, order: 'out', duration: 0.2, rest: 0 }),
    K.carve([T([1.24, -0.03]), T([1.52, 0])], { width: 0.075 * u, strength: 0.92, speed: 160, rim: 0.1, taper: (t) => 1 - 0.75 * t, rest: 0.02 }),
    K.carve(legA.map(T), { width: 0.06 * u, strength: 0.9, speed: 240, rim: 0.1, taper: K.even, rest: 0.01 }),
    K.carve(legB.map(T), { width: 0.055 * u, strength: 0.85, speed: 240, rim: 0.1, taper: K.even, rest: 0.05 }),
    K.redDot(stage, ...T([1.16, -0.11]), Math.max(3, 0.065 * u)),
  ];
}

// A Golden Gate-style tower (stepped legs, portal struts) with its cables and deck.
function bridgeTower(stage, tx, baseY, h, deckY) {
  const acts = [];
  const topY = baseY - h;
  const legW = 9;
  const gap = 12;
  const levels = [0.22, 0.47, 0.68, 0.86];
  for (const side of [-1, 1]) {
    const inner = tx + side * (gap / 2);
    let o = tx + side * (gap / 2 + legW);
    const pts = [[inner, baseY], [o, baseY]];
    for (const f of levels) {
      const y = baseY - h * f;
      pts.push([o, y]);
      o -= side * 1.2;
      pts.push([o, y]);
    }
    pts.push([o, topY], [inner, topY]);
    acts.push(K.reveal((st) => st.mask(pts, { feather: 0.5 }), { op: 'set', level: 2.7, order: 'up', duration: 1.6, jitter: 0.01 }));
  }
  for (const f of [...levels, 0.995]) {
    const y = baseY - h * f;
    const hh = f > 0.99 ? 8 : 6;
    const w = gap / 2 + legW + 1;
    acts.push(K.reveal((st) => st.mask([[tx - w, y - hh / 2], [tx + w, y - hh / 2], [tx + w, y + hh / 2], [tx - w, y + hh / 2]], { feather: 0.4 }), { op: 'set', level: 2.7, order: 'left', duration: 0.3, rest: 0.03 }));
  }
  acts.push(K.pour([[tx - 150, deckY], [1100, deckY]], { width: 5, amount: 3, speed: 500, taper: K.even }));
  const main = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const xx = tx + (1100 - tx) * t;
    main.push([xx, topY + 4 + (deckY - 10 - topY) * Math.pow(t, 1.6)]);
  }
  acts.push(K.pour(main, { width: 2.6, amount: 2.8, speed: 320, taper: K.even }));
  acts.push(K.pour(spline([[tx, topY + 4], [tx - 70, topY + 70], [tx - 150, deckY]], 8), { width: 2.6, amount: 2.8, speed: 320, taper: K.even }));
  return acts;
}
