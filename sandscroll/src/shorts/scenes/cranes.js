import { spline, ellipse, clamp, smoothstep } from '../../core/geom.js';
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
    const mx = rng.float(508, 522);
    const my = 548;
    const mr = 96;
    const acts = [];

    // Night sky, darkest overhead, with a warm glow along the horizon behind the shores.
    const grain = stage.vgrad(1, 1, 0, H0, 0.1, off);
    const sky = (x, y) => {
      const t = clamp(y / s / H0, 0, 1);
      return (2.35 - 0.7 * t - 0.8 * smoothstep(0.74, 1, t)) * grain(x, y);
    };
    acts.push(...K.cover(stage, sky, { y0: -60, y1: H0 + 40, speed: 2000 }));
    const sea = stage.streaky(1.35, 0.2, 0.0014, 0.07, off + 5);
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1090, H0], [1090, 1930], [-10, 1930]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => sea(x, y) * (0.75 + 0.65 * Math.min(1, (y / s - H0) / 700)),
        order: 'down',
        duration: 5,
      }),
    );
    acts.push(...K.moon(stage, mx, my, mr, { halo: 2.7, glow: 0.56, duration: 5 }));
    acts.push(...K.moonPath(stage, rng, { x: mx, horizon: H0, bottom: 1760, spread: 55, count: 24 }));

    // West: a headland whose Great Wall runs down into the sea (老龙头).
    const west = crestLine(n, [[-40, 1028], [20, 1000], [92, 970], [140, 978], [190, 1022], [240, 1070], [290, 1110], [340, 1144], [390, 1164], [430, 1170]], off);
    acts.push(L.range(stage, west, { base: H0 + 3, level: 2.3, mist: 0.2, mistDepth: 36, duration: 3 }));
    acts.push(...ledges([[[112, 1012], [200, 1062], [292, 1128]], [[70, 1048], [150, 1098], [236, 1150]], [[18, 1090], [96, 1134], [160, 1162]]]));
    acts.push(...L.greatWall(stage, west, { x0: -10, x1: 352, offset: 3, thick: 14, tooth: 10, level: 2.9, towers: [peakX(west, 40, 160), 306], towerW: 52, towerH: 46, duration: 3 }));
    // East: a low headland and a suspension-bridge tower.
    const east = crestLine(n, [[600, 1172], [660, 1152], [730, 1124], [800, 1104], [880, 1092], [960, 1076], [1040, 1066], [1120, 1070]], off + 40);
    acts.push(L.range(stage, east, { base: H0 + 3, level: 2.2, mist: 0.2, mistDepth: 36, order: 'right', duration: 3 }));
    acts.push(...ledges([[[690, 1156], [790, 1134], [880, 1124]], [[930, 1112], [1010, 1100], [1090, 1098]]]));
    acts.push(...bridge({ tx: 912, top: 925, deck: 1096, anchor: 856 }, east));
    acts.push(...K.waves(stage, rng, { horizon: H0, avoid: mx, count: 5, strength: 0.7 }));

    // The crane bridge: an arch rising beside the wall, passing under the moon and gliding down
    // by the bridge, with the wingbeat rippling along the line.
    const arch = [];
    for (let i = 0; i <= 120; i++) {
      const a = 0.16 + ((Math.PI - 0.32) * i) / 120;
      arch.push([mx - 305 * Math.cos(a), 1118 - 385 * Math.sin(a)]);
    }
    for (const c of placeAlong(arch, 7, (t) => 132 + 72 * Math.sin(Math.PI * t))) {
      acts.push(...crane(stage, c.x, c.y, c.size, c.heading * 0.62, 0.02 + 0.16 * c.i));
    }

    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 966, y: 476, size: 62, mode: 'carve', strength: 0.9, perChar: 1.3 }));
    acts.push(...K.seal(stage, this.seal, 885, 858, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A hand-shaped crest line roughened with noise, sampled every 6 units for L.crestAt.
function crestLine(noise, ctrl, off) {
  const pts = spline(ctrl, 16);
  const out = [];
  for (let x = ctrl[0][0]; x <= ctrl[ctrl.length - 1][0]; x += 6) {
    let j = 1;
    while (j < pts.length - 1 && pts[j][0] < x) j++;
    const [x0, y0] = pts[j - 1];
    const [x1, y1] = pts[j];
    const y = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    out.push([x, y + 7 * noise.fbm1(off + x / 90, 4, 0.5)]);
  }
  return out;
}

function peakX(crest, x0, x1) {
  let best = x0;
  for (let x = x0; x <= x1; x += 4) if (L.crestAt(crest, x) < L.crestAt(crest, best)) best = x;
  return best;
}

// Moonlit ledges scratched into a dark headland.
function ledges(lines) {
  return lines.map((pts) => K.carve(spline(pts, 8), { width: 3, strength: 0.34, speed: 300, rim: 0.1, rest: 0.05 }));
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
  const arm = [[0.16, 0.03], [0.21, -0.28], [0.23, -0.55], [0.18, -0.8], [0.12, -1], [-0.1, -1.03], [-0.3, -0.97], [-0.47, -0.84], [-0.5, -0.52], [-0.47, -0.24], [-0.42, 0.03]];
  const bases = [[0.1, -1], [-0.02, -1.02], [-0.14, -1.01], [-0.25, -0.98], [-0.35, -0.92], [-0.44, -0.85]];
  const polys = [arm];
  bases.forEach(([bx, by], k) => {
    const a = -1.53 - 0.15 * k;
    const len = 0.44 - 0.035 * k;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy * 0.05;
    const py = dx * 0.05;
    polys.push([
      [bx - dx * 0.16 + px, by - dy * 0.16 + py],
      [bx + dx * len * 0.6 + px, by + dy * len * 0.6 + py],
      [bx + dx * len * 0.92 + px * 0.5, by + dy * len * 0.92 + py * 0.5],
      [bx + dx * len, by + dy * len],
      [bx + dx * len * 0.92 - px * 0.5, by + dy * len * 0.92 - py * 0.5],
      [bx + dx * len * 0.6 - px, by + dy * len * 0.6 - py],
      [bx - dx * 0.16 - px, by - dy * 0.16 - py],
    ]);
  });
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
    K.reveal((st) => st.mask(far.map(tf), { feather: 0.6 }), { op: 'carve', strength: 0.7, order: 'left', duration: 1, rest: 0.02 }),
    K.reveal((st) => st.mask([tf(body), ...near.map(tf)], { feather: 0.6 }), { op: 'carve', strength: 0.95, order: 'left', duration: 1.7, rest: 0.03 }),
    K.carve(neck.map(T), { width: 0.16 * u, strength: 0.95, speed: 170, rim: 0.12, taper: (t) => 1 - 0.38 * t, rest: 0.02 }),
    K.reveal((st) => st.mask(ellipse(1.17, -0.04, 0.11, 0.085, 0, 14).map(T), { feather: 0.5 }), { op: 'carve', strength: 0.96, order: 'out', duration: 0.25, rest: 0 }),
    K.carve([T([1.24, -0.03]), T([1.52, 0])], { width: 0.075 * u, strength: 0.92, speed: 130, rim: 0.1, taper: (t) => 1 - 0.75 * t, rest: 0.02 }),
    K.carve(legA.map(T), { width: 0.06 * u, strength: 0.9, speed: 200, rim: 0.1, taper: K.even, rest: 0.01 }),
    K.carve(legB.map(T), { width: 0.055 * u, strength: 0.85, speed: 200, rim: 0.1, taper: K.even, rest: 0.05 }),
    K.redDot(stage, ...T([1.16, -0.11]), Math.max(3, 0.065 * u)),
  ];
}

// A Golden Gate-style tower (stepped legs, portal struts) standing on the east headland, its
// main cable sagging toward the frame edge and a side span down to the anchorage.
function bridge({ tx, top, deck, anchor }, crest) {
  const acts = [];
  const base = L.crestAt(crest, tx) + 30;
  const h = base - top;
  const legW = 9;
  const gap = 13;
  const levels = [0.2, 0.44, 0.65, 0.84];
  for (const side of [-1, 1]) {
    const inner = tx + side * (gap / 2);
    let o = tx + side * (gap / 2 + legW);
    const pts = [[inner, base], [o, base]];
    for (const f of levels) {
      const y = base - h * f;
      pts.push([o, y]);
      o -= side * 1.2;
      pts.push([o, y]);
    }
    pts.push([o, top], [inner, top]);
    acts.push(K.reveal((st) => st.mask(pts, { feather: 0.5 }), { op: 'set', level: 2.7, order: 'up', duration: 1, jitter: 0.01, rest: 0.05 }));
  }
  for (const f of [...levels, 0.995]) {
    const y = base - h * f;
    const hh = f > 0.99 ? 8 : 6;
    const w = gap / 2 + legW + 1;
    acts.push(K.reveal((st) => st.mask([[tx - w, y - hh / 2], [tx + w, y - hh / 2], [tx + w, y + hh / 2], [tx - w, y + hh / 2]], { feather: 0.4 }), { op: 'set', level: 2.7, order: 'left', duration: 0.25, rest: 0.03 }));
  }
  acts.push(K.pour([[anchor, deck + 2], [1100, deck]], { width: 5, amount: 3, speed: 500, taper: K.even }));
  const low = 1060;
  const main = [];
  for (let x = tx; x <= 1100; x += 8) {
    const t = (x - low) / (tx - low);
    main.push([x, deck - 6 - (deck - 6 - top - 3) * t * t]);
  }
  const side = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    side.push([tx + (anchor - tx) * t, top + 3 + (deck - top - 3) * t + 12 * Math.sin(Math.PI * t)]);
  }
  const hangers = [];
  for (const c of [side, main]) {
    acts.push(K.pour(c, { width: 2.8, amount: 2.8, speed: 320, taper: K.even }));
    for (let i = 2; i < c.length - 1; i += 2) {
      const [x, y] = c[i];
      if (y < deck - 8) hangers.push([[x - 0.9, y], [x + 0.9, y], [x + 0.9, deck], [x - 0.9, deck]]);
    }
  }
  acts.push(K.reveal((st) => st.mask(hangers, { feather: 0.4 }), { op: 'set', level: 2.4, order: 'down', duration: 1, rest: 0.1 }));
  return acts;
}
