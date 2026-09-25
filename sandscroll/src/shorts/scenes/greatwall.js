import { ridge, spline, underRidge, smoothstep } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import * as L from '../../core/landscape.js';

// 长城 — the Great Wall climbing a knife-edge ridge from the lower left to a watchtower on the
// summit (the Jinshanling / Simatai view), the dawn sun behind it, misty ranges and geese.
// Portrait canvas 1080x1920.
export default {
  id: 'greatwall',
  music: 'wall',
  title: { cn: '长城', en: 'The Great Wall' },
  hook: { cn: '长城不是一天建成的', en: "The Great Wall wasn't built in a day" },
  theme: '坚持 · 同心',
  poem: {
    columns: ['志合者', '不以山海为远'],
    cn: '志合者，不以山海为远',
    en: 'For those who share a purpose, no mountain and no sea is too far.',
    by: '晋 · 葛洪《抱朴子》  ·  Ge Hong, Jin dynasty',
  },
  seal: '山海',
  build(stage, rng) {
    const n = stage.noise;
    const s = stage.s;
    const off = rng.float(0, 200);
    const sunX = rng.float(680, 705);
    const sunY = rng.float(575, 592);
    const acts = [];

    // Dawn sky: deep amber overhead, glowing low; the sun rises behind the summit.
    acts.push(...K.cover(stage, stage.vgrad(1.15, 0.26, 0, 1150, 0.1, off), { y0: -60, y1: 1620 }));
    acts.push(...K.moon(stage, sunX, sunY, 104, { halo: 3.1, glow: 0.5, strength: 0.95, duration: 5 }));
    acts.push(K.pour(spline([[sunX - 130, sunY + 36], [sunX - 20, sunY + 26], [sunX + 150, sunY + 32]], 10), { width: 5, amount: 0.2, speed: 520, scatter: 0.05 }));
    acts.push(K.pour(spline([[sunX - 70, sunY + 62], [sunX + 40, sunY + 56], [sunX + 120, sunY + 60]], 10), { width: 4, amount: 0.16, speed: 520, scatter: 0.05 }));

    // Far ranges, lightest first; the wall runs on into the distance along the right one.
    const farR1 = ridge(n, 640, 1160, 900, 120, { offset: off + 11, freq: 1 / 300, peaks: [[rng.float(920, 960), 70, 110]], taper: 0.2 });
    const farR2 = ridge(n, 760, 1160, 1070, 90, { offset: off + 17, freq: 1 / 240, peaks: [[1060, 50, 90]], taper: 0.2 });
    acts.push(L.range(stage, farR1, { level: 0.46, mist: 0.9, mistDepth: 130, order: 'right', duration: 4 }));
    acts.push(...L.greatWall(stage, farR1, { x0: 850, x1: 1100, offset: 3, thick: 5, tooth: 4, level: 1.05, towers: [peakOf(farR1, 900, 1060)], towerW: 12, towerH: 11, duration: 2, walk: false }));
    acts.push(L.range(stage, farR2, { level: 0.74, mist: 0.9, mistDepth: 120, order: 'right', duration: 3 }));
    const far1 = ridge(n, -80, 720, 1010, 130, { offset: off + 23, freq: 1 / 320, peaks: [[rng.float(120, 220), 90, 130]] });
    const far2 = ridge(n, -80, 600, 1140, 110, { offset: off + 41, freq: 1 / 260, peaks: [[rng.float(300, 380), 60, 110]] });
    const far3 = ridge(n, -80, 460, 1270, 90, { offset: off + 67, freq: 1 / 220, peaks: [[rng.float(40, 120), 50, 90]] });
    acts.push(L.range(stage, far1, { level: 0.46, mist: 0.9, mistDepth: 130, duration: 4 }));
    acts.push(L.range(stage, far2, { level: 0.72, mist: 0.88, mistDepth: 120, duration: 4 }));
    acts.push(L.range(stage, far3, { level: 1.0, mist: 0.8, mistDepth: 110, duration: 4 }));

    // The wall's mountain: a steep flight from the near landing to the summit, then a sheer drop
    // into the valley mist. Darker toward the viewer, dissolving into cloud at its far foot.
    const crest = crestLine([
      [-80, 1590], [0, 1492], [60, 1446], [118, 1436], [180, 1372], [248, 1280], [300, 1238], [365, 1228],
      [412, 1186], [462, 1086], [512, 956], [560, 834], [604, 738], [640, 694], [668, 684], [698, 689],
      [735, 710], [785, 758], [830, 830], [872, 930], [912, 1040], [960, 1140], [1030, 1220], [1160, 1280],
    ]);
    const peakX = 668;
    const grain = stage.mottle(1, 0.12, 0.012, off);
    acts.push(
      K.reveal((st) => st.mask(underRidge(crest, 1940), { feather: 1.2, rough: 0.2, roughScale: 0.1 }), {
        op: 'set',
        level: (x, y) => {
          const vx = x / s;
          const vy = y / s;
          const mist = smoothstep(1040, 1330, vy) * smoothstep(360, 660, vx);
          return (1.3 + 1.0 * smoothstep(700, 1600, vy)) * grain(x, y) * (1 - 0.82 * mist);
        },
        order: 'up',
        duration: 7,
      }),
    );
    // Rock facets falling away from the crest on the lit side.
    for (let i = 0; i < 7; i++) {
      const x = 250 + i * 60 + rng.float(-12, 12);
      const y = L.crestAt(crest, x) + 60 + i * 4;
      const len = rng.float(110, 190);
      acts.push(K.carve(spline([[x, y], [x + len * 0.22, y + len * 0.42], [x + len * 0.5, y + len]], 8), { width: 3, strength: 0.26, speed: 360, rest: 0.04, rim: 0.15 }));
    }
    acts.push(L.mistBand(stage, { y: 1215, height: 120, x0: 380, x1: 1080, strength: 0.5, duration: 3 }));
    const near = ridge(n, 380, 1160, 1500, 150, { offset: off + 89, freq: 1 / 260, peaks: [[1090, 110, 220]], taper: 0.3 });
    acts.push(K.reveal((st) => st.mask(underRidge(near, 1940), { feather: 1.2, rough: 0.28, roughScale: 0.09 }), { op: 'set', level: stage.mottle(2.25, 0.1, 0.012, off + 5), order: 'right', duration: 4 }));

    // The wall, laid from the foreground up the flight to the summit, then over and down.
    const scale = (x) => ramp(x, [[-80, 1], [peakX, 0.34], [880, 0.24]]);
    const tone = (x) => ramp(x, [[-80, 2.85], [peakX, 2.65], [740, 2.45], [880, 1.35]]);
    acts.push(wall(stage, crest, { x0: -80, x1: peakX + 30, scale, tone, duration: 11 }));
    acts.push(wall(stage, crest, { x0: peakX + 30, x1: 880, scale, tone, duration: 2 }));
    acts.push(...tower(stage, crest, 88, { w: 96, h: 84, level: 2.9, windows: 3 }));
    acts.push(...tower(stage, crest, 330, { w: 64, h: 56, level: 2.8, windows: 2 }));
    acts.push(...tower(stage, crest, peakX, { w: 64, h: 54, level: 2.75, windows: 2, roof: true }));
    // Dawn light catching the walkway.
    const walk = [];
    for (let x = -70; x <= 860; x += 4) walk.push([x, L.crestAt(crest, x) + 0.3 * thickAt(crest, x, scale)]);
    acts.push(K.carve(walk, { width: 3.4, strength: 0.52, speed: 600, rim: 0.1, taper: (u) => 1 - 0.65 * u }));

    acts.push(...L.flock(stage, rng, { x: rng.float(490, 515), y: rng.float(515, 540), count: 7, size: 17, dx: 44, dy: 17, level: 1.5 }));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 214, y: 486, size: 66, mode: 'pour', amount: 1.5, perChar: 1.35 }));
    acts.push(...K.seal(stage, this.seal, 128, 968, { size: 62, seed: rng.int(1, 999) }));
    return acts;
  },
};

// Highest point of a crest between two x positions (for placing a tower).
function peakOf(crest, x0, x1) {
  let best = x0;
  for (let x = x0; x <= x1; x += 4) if (L.crestAt(crest, x) < L.crestAt(crest, best)) best = x;
  return best;
}

// Piecewise-linear interpolation through [x, value] stops.
function ramp(x, stops) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, v1] = stops[i];
    if (x <= x1) {
      const [x0, v0] = stops[i - 1];
      return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0);
    }
  }
  return stops[stops.length - 1][1];
}

// Smooth crest through control points, resampled every 4 units of x.
function crestLine(ctrl) {
  const sp = spline(ctrl, 16);
  const out = [];
  for (let x = ctrl[0][0]; x <= ctrl[ctrl.length - 1][0]; x += 4) out.push([x, L.crestAt(sp, x)]);
  return out;
}

// Vertical thickness of the wall at x: constant across the slope, so steep flights stay solid.
function thickAt(crest, x, scale) {
  const slope = (L.crestAt(crest, x + 3) - L.crestAt(crest, x - 3)) / 6;
  return (34 * scale(x)) * Math.min(2.3, Math.hypot(1, slope));
}

// The wall along a crest, shrinking with distance (scale(x) = 1 in the foreground): a parapet
// band with merlons spaced along the slope, so steep flights keep their battlements.
function wall(stage, crest, { x0, x1, scale, tone, duration }) {
  const top = [];
  const bottom = [];
  let phase = 0;
  let prev = null;
  for (let x = x0; x <= x1; x += 1) {
    const y = L.crestAt(crest, x);
    const k = scale(x);
    const slope = (L.crestAt(crest, x + 3) - L.crestAt(crest, x - 3)) / 6;
    if (prev) phase += Math.hypot(x - prev[0], y - prev[1]) / Math.max(6, 24 * k);
    prev = [x, y];
    const merlon = phase % 1 < 0.55;
    top.push([x, y - (merlon ? Math.max(3, 12 * k * Math.sqrt(Math.min(2.3, Math.hypot(1, slope)))) : 0)]);
    bottom.push([x, y + thickAt(crest, x, scale)]);
  }
  const poly = [...top, ...bottom.reverse()];
  const level = (x) => tone(x / stage.s) * (1 + 0.06 * stage.noise.n2(x * 0.05, 3.1));
  return K.reveal((st) => st.mask(poly, { feather: 0.6, rough: 0.1, roughScale: 0.3 }), { op: 'set', level, order: 'left', duration, jitter: 0.01 });
}

// A watchtower astride the wall: crenellated top, arched windows; the summit one carries a
// small hipped roof.
function tower(stage, crest, x, { w, h, level, windows = 2, roof = false }) {
  const yl = L.crestAt(crest, x - w / 2);
  const yr = L.crestAt(crest, x + w / 2);
  const top = Math.min(yl, yr) - h;
  const bot = Math.max(yl, yr) + h * 0.45;
  const t = Math.max(2, h * 0.13);
  const body = [[x - w / 2, bot], [x - w / 2, top - t]];
  const teeth = 7;
  for (let i = 0; i < teeth; i++) {
    const xa = x - w / 2 + (w * i) / teeth;
    const xb = x - w / 2 + (w * (i + 1)) / teeth;
    const y = i % 2 === 0 ? top - t : top;
    body.push([xa, y], [xb, y]);
  }
  body.push([x + w / 2, top - t], [x + w / 2, bot]);
  const acts = [K.reveal((st) => st.mask(body, { feather: 0.5 }), { op: 'set', level, order: 'up', duration: 1.4, jitter: 0.02, rest: 0.1 })];
  if (roof) {
    const rh = h * 0.62;
    const eave = top - t - rh * 0.34;
    const hall = [[x - w * 0.27, top - t + 1], [x - w * 0.27, eave], [x + w * 0.27, eave], [x + w * 0.27, top - t + 1]];
    const tiles = [
      [x - w * 0.5, eave - rh * 0.16],
      ...spline([[x - w * 0.4, eave + 1], [x, eave + 2], [x + w * 0.4, eave + 1]], 6),
      [x + w * 0.5, eave - rh * 0.16],
      ...spline([[x + w * 0.3, eave - rh * 0.3], [x + w * 0.2, eave - rh * 0.56], [x + w * 0.14, eave - rh * 0.66]], 6),
      [x - w * 0.14, eave - rh * 0.66],
      ...spline([[x - w * 0.2, eave - rh * 0.56], [x - w * 0.3, eave - rh * 0.3]], 6),
    ];
    acts.push(K.reveal((st) => st.mask(hall, { feather: 0.5 }), { op: 'set', level, order: 'up', duration: 0.6, rest: 0.05 }));
    acts.push(K.reveal((st) => st.mask(tiles, { feather: 0.5 }), { op: 'set', level, order: 'up', duration: 0.9, rest: 0.1 }));
  }
  const wy = top + h * 0.42;
  for (let i = 0; i < windows; i++) {
    const wx = x + (windows === 1 ? 0 : (i / (windows - 1) - 0.5) * w * 0.52);
    acts.push(K.reveal((st) => st.mask(arch(wx, wy, w * 0.13, h * 0.3), { feather: 0.5 }), { op: 'carve', strength: 0.8, order: 'up', duration: 0.5, rest: 0.05 }));
  }
  return acts;
}

function arch(cx, cy, w, h) {
  const pts = [[cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2 + w / 2]];
  for (let a = Math.PI; a <= Math.PI * 2 + 1e-6; a += Math.PI / 8) pts.push([cx + (Math.cos(a) * w) / 2, cy - h / 2 + w / 2 + (Math.sin(a) * w) / 2]);
  pts.push([cx + w / 2, cy + h / 2]);
  return pts;
}
