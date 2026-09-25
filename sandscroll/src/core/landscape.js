import { reveal, pour, carve, even } from './actions.js';
import { underRidge, smoothstep, spline, clamp } from './geom.js';

// Landscape vocabulary for 山水 compositions. Virtual coordinates.

function crestAt(crest, x) {
  if (x <= crest[0][0]) return crest[0][1];
  for (let i = 1; i < crest.length; i++) {
    if (crest[i][0] >= x) {
      const [x0, y0] = crest[i - 1];
      const [x1, y1] = crest[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return crest[crest.length - 1][1];
}

// A mountain range that dissolves into mist toward its base (留白 / 云雾).
export function range(stage, crest, { base, level = 1, mist = 0.8, mistDepth = 140, order = 'left', duration = 7, grain = 0.12 } = {}) {
  const s = stage.s;
  const mottle = stage.mottle(1, grain, 0.01, crest[0][1]);
  const bottom = base ?? Math.max(...crest.map((p) => p[1])) + mistDepth;
  const level2 = (x, y) => level * mottle(x, y) * (1 - mist * smoothstep(bottom - mistDepth, bottom, y / s));
  return reveal((st) => st.mask(underRidge(crest, bottom), { feather: 1.2, rough: 0.28, roughScale: 0.09 }), {
    op: 'set',
    level: level2,
    order,
    duration,
    jitter: 0.05,
  });
}

// The Great Wall snaking along a crest: battlements, walkway highlight and watchtowers.
export function greatWall(stage, crest, { x0, x1, offset = 5, thick = 15, tooth = 8, level = 2.4, towers = [], towerW = 34, towerH = 30, duration = 10, walk = true } = {}) {
  const top = [];
  const bottom = [];
  for (let x = x0; x <= x1; x += tooth / 2) {
    const y = crestAt(crest, x) + offset;
    const merlon = Math.floor((x - x0) / (tooth / 2)) % 2 === 0;
    top.push([x, y - (merlon ? tooth * 0.75 : 0)]);
    top.push([x + tooth / 2, y - (merlon ? tooth * 0.75 : 0)]);
    bottom.push([x, y + thick]);
  }
  const poly = [...top, ...bottom.reverse()];
  const acts = [
    reveal((st) => st.mask(poly, { feather: 0.6, rough: 0.12, roughScale: 0.3 }), { op: 'set', level, order: 'left', duration, jitter: 0.015 }),
  ];
  for (const tx of towers) {
    const y = crestAt(crest, tx) + offset;
    const w = towerW;
    const h = towerH;
    const t = [
      [tx - w / 2, y + thick],
      [tx - w / 2, y - h],
      [tx - w / 2 + w * 0.2, y - h],
      [tx - w / 2 + w * 0.2, y - h - 6],
      [tx - w * 0.1, y - h - 6],
      [tx - w * 0.1, y - h],
      [tx + w * 0.1, y - h],
      [tx + w * 0.1, y - h - 6],
      [tx + w / 2 - w * 0.2, y - h - 6],
      [tx + w / 2 - w * 0.2, y - h],
      [tx + w / 2, y - h],
      [tx + w / 2, y + thick],
    ];
    acts.push(reveal((st) => st.mask(t, { feather: 0.6 }), { op: 'set', level: level * 1.05, order: 'up', duration: 1.6, jitter: 0.02, rest: 0.1 }));
    const wy = y - h * 0.45;
    acts.push(reveal((st) => st.mask(archWindow(tx, wy, w * 0.26, h * 0.42), { feather: 0.5 }), { op: 'carve', strength: 0.85, order: 'up', duration: 0.8, rest: 0.1 }));
  }
  if (walk) {
    const path = [];
    for (let x = x0 + 6; x <= x1 - 6; x += 6) path.push([x, crestAt(crest, x) + offset + thick * 0.3]);
    acts.push(carve(path, { width: 2.2, strength: 0.55, speed: 520, rim: 0.1 }));
  }
  return acts;
}

function archWindow(cx, cy, w, h) {
  const pts = [
    [cx - w / 2, cy + h / 2],
    [cx - w / 2, cy - h * 0.1],
  ];
  for (let a = Math.PI; a <= Math.PI * 2 + 1e-6; a += Math.PI / 10) pts.push([cx + (Math.cos(a) * w) / 2, cy - h * 0.1 + (Math.sin(a) * w) / 2]);
  pts.push([cx + w / 2, cy + h / 2]);
  return pts;
}

// Chinese pine (黄山松 manner): a twisting trunk leaning out, branches reaching sideways and
// flat-bottomed needle clouds (松针团) with a few scratched highlights.
export function pine(stage, rng, { x, y, height = 320, lean = 0.3, level = 2.3, tiers = 4, scale = 1, dir = 1, speed = 1 } = {}) {
  const acts = [];
  const ctrl = [];
  const segs = 5;
  const phase = rng.float(0, Math.PI);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const bend = Math.sin(t * Math.PI * 1.3 + phase) * 26 * scale;
    ctrl.push([x + dir * (lean * height * t * t + bend * t), y - height * t]);
  }
  const trunk = spline(ctrl, 10);
  acts.push(pour(trunk, { width: 26 * scale, amount: 2.8, speed: 120 * speed, taper: (u) => 1 - 0.62 * u, scatter: 0.3, hard: 0.45 }));
  const at = (t) => trunk[Math.min(trunk.length - 1, Math.round(t * (trunk.length - 1)))];
  const clusters = [];
  for (let i = 0; i < tiers; i++) {
    const t = 0.42 + (0.5 * i) / Math.max(1, tiers - 1);
    const [bx, by] = at(t);
    const side = (i % 2 === 0 ? 1 : -1) * dir;
    const L = height * (0.62 - 0.32 * t) * rng.float(0.85, 1.15) * (side === dir ? 1.15 : 0.8);
    const droop = rng.float(-0.06, 0.08);
    const branch = spline([[bx, by], [bx + side * L * 0.35, by + L * droop], [bx + side * L * 0.7, by - L * 0.02], [bx + side * L, by - L * 0.12]], 8);
    acts.push(pour(branch, { width: 11 * scale * (1.1 - t * 0.4), amount: 2.5, speed: 170 * speed, taper: (u) => 1 - 0.65 * u, scatter: 0.15 }));
    for (const f of [0.55, 1]) {
      const [cx, cy] = branch[Math.round(f * (branch.length - 1))];
      const w = L * (f === 1 ? 0.78 : 0.5) * rng.float(0.9, 1.15);
      clusters.push([cx - side * w * 0.12, cy - w * 0.08, w, side]);
    }
  }
  const [tx, ty] = trunk[trunk.length - 1];
  clusters.push([tx + dir * 10, ty - 6, height * 0.42, dir]);
  for (const [cx, cy, w, side] of clusters) {
    const h = w * rng.float(0.26, 0.34);
    const seed = rng.float(0, 100);
    acts.push(
      reveal((st) => st.mask(needleCloud(cx, cy, w, h, seed), { feather: 1.2, rough: 0.5, roughScale: 0.16 }), {
        op: 'set',
        level: stage.mottle(level, 0.16, 0.035, seed),
        order: side > 0 ? 'left' : 'right',
        duration: 1.8 * (w / 150),
        jitter: 0.1,
        rest: 0.15,
      }),
    );
    const strokes = Math.max(3, Math.round(w / 28));
    for (let k = 0; k < strokes; k++) {
      const u = (k + 0.5) / strokes - 0.5;
      const sx = cx + u * w * 0.8;
      const sy = cy + h * 0.18;
      acts.push(carve([[sx, sy], [sx + u * 10 + rng.float(-3, 3), sy - h * rng.float(0.35, 0.55)]], { width: 2.2 * scale, strength: 0.45, speed: 200, rest: 0.03, rim: 0.2 }));
    }
  }
  return acts;
}

function needleCloud(cx, cy, w, h, seed) {
  const pts = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const top = Math.sin(a) < 0;
    const bump = 1 + (top ? 0.16 * Math.abs(Math.sin(a * 4.5 + seed)) + 0.07 * Math.sin(a * 11 + seed * 2) : 0.04 * Math.sin(a * 7 + seed));
    const sy = top ? 1 : 0.42;
    pts.push([cx + Math.cos(a) * (w / 2) * bump, cy + Math.sin(a) * (h / 2) * bump * sy]);
  }
  return pts;
}

// Distant flock (V or loose line) of poured bird marks.
export function flock(stage, rng, { x, y, count = 7, size = 14, dx = 44, dy = 16, level = 1.4, vee = true } = {}) {
  const acts = [];
  for (let i = 0; i < count; i++) {
    const side = vee ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) : i;
    const bx = x + (vee ? Math.abs(side) : side) * dx * (vee ? -1 : 1) + rng.float(-8, 8);
    const by = y + (vee ? side : Math.sin(i) * 0.6) * dy + rng.float(-5, 5);
    const sz = size * rng.float(0.8, 1.15) * (1 - Math.abs(side) * 0.04);
    const lift = rng.float(0.25, 0.55);
    const pts = spline([[bx - sz, by - sz * lift], [bx - sz * 0.45, by - sz * 0.3], [bx, by], [bx + sz * 0.5, by - sz * 0.32], [bx + sz * 1.05, by - sz * lift]], 6);
    acts.push(pour(pts, { width: 3.2, amount: level, speed: 160, rest: 0.1, scatter: 0.1 }));
  }
  return acts;
}

export function mistBand(stage, { y, height = 60, x0 = 0, x1 = 1920, strength = 0.5, duration = 3 } = {}) {
  const s = stage.s;
  return reveal(
    (st) => {
      const m = st.mask([[x0, y - height], [x1, y - height], [x1, y + height], [x0, y + height]]);
      const n = st.noise;
      const edge = Math.min(160, (x1 - x0) / 4);
      return m.map((a, X, Y) => {
        const t = 1 - Math.abs(Y / s - y) / height;
        const vx = X / s;
        const ends = (x0 <= 0 ? 1 : smoothstep(x0, x0 + edge, vx)) * (x1 >= 1920 ? 1 : smoothstep(x1, x1 - edge, vx));
        return a * ends * clamp(t * t * (1.1 + 0.6 * n.fbm2(vx * 0.006, (Y / s) * 0.03, 3)), 0, 1);
      });
    },
    { op: 'carve', strength, order: 'left', duration, jitter: 0.1 },
  );
}

export function leaf(x, y, angle, len, width) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tip = [x + c * len, y + s * len];
  const mid = [x + c * len * 0.45, y + s * len * 0.45];
  const nx = -s * width;
  const ny = c * width;
  const poly = spline([[x, y], [mid[0] + nx, mid[1] + ny], tip, [mid[0] - nx * 0.6, mid[1] - ny * 0.6], [x, y]], 8);
  return [reveal((st) => st.mask(poly, { feather: 0.6 }), { op: 'set', level: 2.3, order: 'out', duration: 0.5, rest: 0.04 })];
}


// Vertical bamboo stalks with nodes and clusters of leaves (个字叶).
export function bambooGrove(stage, rng, { x, top, bottom, count = 3, lean = 0 }) {
  const acts = [];
  for (let i = 0; i < count; i++) {
    const bx = x + (i - (count - 1) / 2) * rng.float(55, 85);
    const w = rng.float(14, 22) * (1 - i * 0.15);
    const tilt = lean + rng.float(-0.03, 0.03);
    const seg = rng.float(90, 130);
    for (let y = bottom; y > top; y -= seg) {
      const y1 = Math.max(top, y - seg + 6);
      const x0 = bx + (bottom - y) * tilt;
      const x1 = bx + (bottom - y1) * tilt;
      acts.push(pour([[x0, y], [x1, y1]], { width: w, amount: 2.2 - i * 0.35, speed: 240, taper: (u) => 1 - 0.08 * Math.sin(u * Math.PI), rest: 0.04, scatter: 0.1 }));
      acts.push(carve([[x1 - w * 0.55, y1 + 2], [x1 + w * 0.55, y1 + 2]], { width: 2.4, strength: 0.7, speed: 90, rest: 0.02, taper: even }));
    }
    const clusters = rng.int(2, 3);
    for (let k = 0; k < clusters; k++) {
      const cy = rng.float(top + 80, bottom - 400);
      const cx = bx + (bottom - cy) * tilt;
      const dir = rng.chance(0.5) ? 1 : -1;
      for (let j = 0; j < 3; j++) {
        const ang = (dir > 0 ? 0.35 : Math.PI - 0.35) + dir * (j - 1) * 0.45 + rng.float(-0.1, 0.1);
        acts.push(...leaf(cx, cy, ang, rng.float(80, 120), rng.float(11, 15)));
      }
    }
  }
  return acts;
}

export { crestAt };
