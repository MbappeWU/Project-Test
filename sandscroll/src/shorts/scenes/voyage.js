import { spline, ellipse, arc, smoothstep, clamp } from '../../core/geom.js';
import * as K from '../../core/kit.js';

// 远航 · 长风破浪 — a three-masted ship under full sail running toward the dawn, her sails glowing,
// the bow cutting a swell, gulls riding the wind. Portrait canvas 1080x1920.
export default {
  id: 'voyage',
  music: 'voyage',
  title: { cn: '远航', en: 'Setting Sail' },
  hook: { cn: '给正在努力的你：长风破浪会有时', en: 'For everyone working toward a dream' },
  theme: '奋斗 · 梦想',
  poem: {
    columns: ['长风破浪会有时', '直挂云帆济沧海'],
    cn: '长风破浪会有时，直挂云帆济沧海',
    en: 'A day will come to ride the wind and cleave the waves, to hoist my sail and cross the boundless sea.',
    by: '唐 · 李白《行路难》  ·  Li Bai, Tang dynasty',
  },
  seal: '远航',
  build(stage, rng) {
    const s = stage.s;
    const H0 = 1000;
    const off = rng.float(0, 100);
    const sunX = rng.float(96, 124);
    const ship = rig({ ox: 560, oy: 1190, k: 1, dir: -1, tilt: 0.03 });
    const acts = [];

    // Sky: storm-dark overhead, breaking into a dawn glow low on the horizon ahead of the ship,
    // with low cloud banks dark against the glow and lit from below.
    const skyGrain = stage.mottle(1, 0.08, 0.004, off);
    acts.push(...K.cover(stage, (x, y) => (0.42 + 1.75 * (1 - smoothstep(560, H0 + 30, y / s)) ** 0.8) * skyGrain(x, y), { y0: -60, y1: H0 + 20 }));
    acts.push(K.reveal((st) => K.radialMask(st, sunX, H0, 30, 720, 1.5), { op: 'carve', strength: 0.72, order: 'out', duration: 3.5, jitter: 0.06 }));
    const glow = (x) => Math.exp(-(((x - sunX) / 420) ** 2));
    for (const [x0, x1, y, thick] of [[-80, 640, 962, 11], [300, 870, 986, 9], [-80, 420, 902, 9], [560, 1140, 872, 12]]) {
      acts.push(...cloudBank(stage, rng, { x0, x1, y: y + rng.float(-8, 8), thick, glow }));
    }
    // Storm cloud rolling overhead, then the long wind: broad palm swirls tearing through it and
    // sweeping round the ship toward the dawn.
    for (const [y, x0, x1] of [[110, -120, 700], [60, 380, 1200], [300, -120, 420]]) {
      acts.push(K.pour(spline([[x0, y], [(x0 + x1) / 2, y + rng.float(-40, 40)], [x1, y + rng.float(-30, 30)]], 10), { width: 240, amount: 0.9, speed: 900, hard: 0.02, scatter: 0.02, rest: 0.05, taper: K.taperBoth }));
    }
    const winds = [
      [1340, 1420, 1060, 1.05, 1.44, 130, 0.72],
      [1400, 1300, 1230, 1.0, 1.38, 80, 0.9],
      [1250, 1500, 1400, 1.1, 1.47, 150, 0.95],
      [1500, 1250, 1180, 1.12, 1.33, 60, 0.8],
    ];
    for (const [cx, cy, r, a0, a1, w, target] of winds) {
      const pts = arc(cx + rng.float(-30, 30), cy, r, Math.PI * a0, Math.PI * a1, 40).filter(([, y]) => y < 800);
      acts.push(K.palm(pts, { width: w, speed: 620, target, rate: 0.6, streak: stage.streaks[Math.round(target * 10) % 3], hard: 0.1, rest: 0.1, taper: K.taperBoth }));
    }

    // Sea: bright under the dawn, deepening toward the viewer, with the sun's path of light.
    const sea = stage.streaky(1, 0.2, 0.0016, 0.07, off + 3);
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1090, H0], [1090, 1930], [-10, 1930]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => sea(x, y) * (0.8 + 1.1 * smoothstep(H0, 1650, y / s)) * (1 - 0.45 * Math.exp(-(((x / s - sunX) / 260) ** 2))),
        order: 'down',
        duration: 6,
      }),
    );
    acts.push(...K.moonPath(stage, rng, { x: sunX + 12, horizon: H0, spread: 60, count: 22, strength: 0.75 }));
    for (const [y, amp, lambda] of [[1030, 3, 70], [1062, 4, 90], [1100, 6, 110], [1146, 8, 140]]) acts.push(...swell(stage, rng, { y, amp, lambda, x0: rng.float(-100, 200), span: rng.float(700, 1000) }));

    acts.push(...ship.draw(stage));
    acts.push(...foreground(stage, rng, { ship, H0, sunX }));
    acts.push(...gulls());
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 986, y: 478, size: 56, mode: 'carve', strength: 0.9, perChar: 1.15 }));
    acts.push(...K.seal(stage, this.seal, 913, 958, { size: 58, seed: rng.int(1, 999) }));
    return acts;
  },
};

// A long low cloud: darker than the glowing sky behind it, ragged on top, its underside lit by
// the dawn.
function cloudBank(stage, rng, { x0, x1, y, thick, glow }) {
  const n = 24;
  const top = [];
  const under = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = x0 + (x1 - x0) * u;
    const t = Math.sin(Math.PI * u) ** 1.3 * (0.55 + 0.45 * Math.abs(Math.sin(u * 9 + x0)));
    top.push([x, y - thick * t * rng.float(0.6, 1.2)]);
    under.push([x, y + thick * 0.3 * t]);
  }
  const outline = [...spline(top, 4), ...spline(under.reverse(), 4)];
  const s = stage.s;
  return [
    K.reveal((st) => st.mask(outline, { feather: 3, rough: 0.35, roughScale: 0.15 }), { op: 'set', level: (x) => 1.05 + 0.35 * (1 - glow(x / s)), order: 'left', duration: 1.4, jitter: 0.08, rest: 0.05 }),
    K.carve(spline(under.slice().reverse().filter((_, i) => i > 1 && i < n - 1), 6), { width: 3.5, strength: 0.35 + 0.4 * glow((x0 + x1) / 2), speed: 700, rim: 0.1, rest: 0.05, taper: K.taperBoth }),
  ];
}

// Ship geometry in its own frame (x toward the bow, y down, origin at the waterline amidships),
// placed on the canvas with a scale, facing and a slight forward pitch.
function rig({ ox, oy, k, dir, tilt }) {
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const P = (x, y) => [ox + dir * (x * c - y * sn) * k, oy + (x * sn + y * c) * k];
  // Canvas (virtual) -> ship frame.
  const local = (X, Y) => {
    const rx = (dir * (X - ox)) / k;
    const ry = (Y - oy) / k;
    return [rx * c + ry * sn, -rx * sn + ry * c];
  };
  const deckAt = (x) => -62 - 34 * Math.max(0, (x - 200) / 138) ** 2 - 36 * Math.max(0, (-x - 230) / 142) ** 2;
  const masts = [
    { x: 200, h: 610, yards: [116, 104, 82, 60] },
    { x: 0, h: 668, yards: [124, 110, 88, 64] },
    { x: -200, h: 500, yards: [90, 86, 68, 50] },
  ];
  const at = (m, f) => [m.x, deckAt(m.x) - m.h * f];
  return { P, local, deckAt, masts, at, k, ox, oy, draw: (stage) => drawShip(stage, { P, local, deckAt, masts, at, k }) };
}

const YARDS = [0.3, 0.55, 0.76, 0.9];

function drawShip(stage, { P, local, deckAt, masts, at, k }) {
  const s = stage.s;
  const acts = [];
  const poly = (pts) => pts.map(([x, y]) => P(x, y));

  // Square sails, unfurling from their yards: billowing, brightest in the belly, shaded toward
  // the leeches and in the bunt under each yard.
  for (const mi of [1, 0, 2]) {
    const m = masts[mi];
    const deck = deckAt(m.x);
    for (let i = 0; i < 4; i++) {
      const hw = m.yards[i];
      const yTop = deck - m.h * YARDS[i];
      const yBot = i === 0 ? deck - 36 : deck - m.h * YARDS[i - 1] - 8;
      const bw = i === 0 ? hw * 1.04 : m.yards[i - 1] * 0.96;
      const tall = yBot - yTop;
      const belly = tall * 0.13;
      const bulge = tall * 0.03;
      const outline = [
        ...spline([[m.x - hw, yTop], [m.x + hw, yTop]], 1),
        ...spline([[m.x + hw, yTop], [m.x + (hw + bw) / 2 + bulge, yTop + tall * 0.5], [m.x + bw, yBot]], 6).slice(1),
        ...spline([[m.x + bw, yBot], [m.x + bw * 0.5, yBot + belly * 0.8], [m.x, yBot + belly], [m.x - bw * 0.5, yBot + belly * 0.8], [m.x - bw, yBot]], 6).slice(1),
        ...spline([[m.x - bw, yBot], [m.x - (hw + bw) / 2 - bulge, yTop + tall * 0.5], [m.x - hw, yTop]], 6).slice(1, -1),
      ];
      const level = (X, Y) => {
        const [lx, ly] = local(X / s, Y / s);
        const v = clamp((ly - yTop) / (tall + belly), 0, 1);
        const u = clamp((lx - m.x) / (hw + (bw - hw) * v + bulge), -1, 1);
        return 0.04 + 0.3 * u * u + 0.2 * (1 - smoothstep(0, 0.1, v)) + 0.1 * v - 0.05 * u;
      };
      acts.push(K.reveal((st) => st.mask(poly(outline), { feather: 0.7, rough: 0.08, roughScale: 0.2 }), { op: 'set', level, order: 'down', duration: 1.5 + 0.3 * (3 - i), jitter: 0.03, rest: 0.1 }));
    }
  }
  // Head sails from the foremast out to the jib-boom.
  const fore = masts[0];
  const jibs = [
    [at(fore, 0.5), [388, -112], [268, -106]],
    [at(fore, 0.68), [452, -129], [318, -120]],
    [at(fore, 0.84), [518, -146], [372, -136]],
  ];
  for (const [head, tack, clew] of jibs) {
    const leech = spline([head, [head[0] + (clew[0] - head[0]) * 0.5 - 18, head[1] + (clew[1] - head[1]) * 0.5], clew], 8);
    const foot = spline([clew, [(clew[0] + tack[0]) / 2, (clew[1] + tack[1]) / 2 + 8], tack], 4).slice(1);
    const level = (X, Y) => 0.08 + 0.42 * smoothstep(clew[0] - 20, tack[0], local(X / s, Y / s)[0]);
    acts.push(K.reveal((st) => st.mask(poly([...leech, ...foot]), { feather: 0.7 }), { op: 'set', level, order: 'down', duration: 1.6, rest: 0.1 }));
  }

  // Hull: dark, with a lit wale and its row of gunports.
  const deck = [];
  for (let x = -372; x <= 338; x += 10) deck.push([x, deckAt(x)]);
  const bottom = spline([[338, deckAt(338)], [334, -52], [306, -8], [240, 12], [0, 18], [-260, 14], [-334, 2], [-356, -40], [-372, deckAt(-372)]], 8);
  acts.push(K.reveal((st) => st.mask(poly([...deck, ...bottom]), { feather: 0.8, rough: 0.1, roughScale: 0.3 }), { op: 'set', level: stage.mottle(2.8, 0.08), order: 'left', duration: 3.5 }));
  const wale = [];
  for (let x = -352; x <= 318; x += 8) wale.push(P(x, deckAt(x) + 30));
  acts.push(K.carve(wale, { width: 11 * k, strength: 0.55, speed: 420, rim: 0.15, taper: K.taperBoth }));
  for (let x = -290; x <= 270; x += 40) {
    const y = deckAt(x) + 30;
    acts.push(K.reveal((st) => st.mask(poly([[x - 8, y - 6], [x + 8, y - 6], [x + 8, y + 6], [x - 8, y + 6]]), { feather: 0.4 }), { op: 'set', level: 2.8, order: 'up', duration: 0.12, rest: 0.02 }));
  }
  acts.push(K.carve(deck.map(([x, y]) => P(x, y + 5)), { width: 2.6, strength: 0.45, speed: 760, rim: 0.1 }));

  // Masts, yards, bowsprit.
  for (const m of masts) {
    acts.push(K.pour([P(...at(m, 0)), P(...at(m, 1))], { width: 8 * k, amount: 2.4, speed: 520, taper: (u) => 1 - 0.6 * u, scatter: 0.05 }));
    for (let i = 0; i < 4; i++) {
      const [, y] = at(m, YARDS[i]);
      acts.push(K.pour([P(m.x - m.yards[i] - 10, y), P(m.x + m.yards[i] + 10, y)], { width: 4.5 * k, amount: 2.1, speed: 700, rest: 0.03, taper: (u) => 0.55 + 0.45 * Math.sin(u * Math.PI), scatter: 0.05 }));
    }
  }
  acts.push(K.pour([P(320, deckAt(320) - 2), P(534, -152)], { width: 7 * k, amount: 2.4, speed: 300, taper: (u) => 1 - 0.6 * u }));

  // Standing rigging: stays forward, shrouds down to the channels, backstays aft.
  const main = masts[1];
  const miz = masts[2];
  const lines = [
    [at(fore, 1), [534, -152]],
    ...jibs.map(([head, tack]) => [head, tack]),
    [at(main, 1), at(fore, 0.8)],
    [at(main, 0.55), at(fore, 0.36)],
    [at(miz, 1), at(main, 0.66)],
    [at(miz, 0.55), at(main, 0.3)],
    [at(main, 1), [-150, deckAt(-150)]],
    [at(miz, 1), [-340, deckAt(-340)]],
  ];
  for (const m of masts) {
    for (const f of [0.3, 0.55]) lines.push([at(m, f), [m.x - 30, deckAt(m.x) + 4]], [at(m, f), [m.x - 58, deckAt(m.x) + 4]]);
  }
  for (const [a, b] of lines) acts.push(K.pour([P(...a), P(...b)], { width: 1.6, amount: 1.3, speed: 1500, rest: 0.01, scatter: 0, taper: K.even }));

  // Pennant streaming forward from the main truck, small flags on the others.
  const [mx, my] = at(main, 1);
  acts.push(K.pour(spline([P(mx, my), P(mx + 44, my + 10), P(mx + 88, my - 2), P(mx + 136, my + 12)], 8), { width: 7 * k, amount: 2, speed: 180, taper: (u) => 1 - 0.85 * u }));
  for (const m of [fore, miz]) {
    const [x, y] = at(m, 1);
    acts.push(K.pour(spline([P(x, y), P(x + 24, y + 7), P(x + 48, y + 2)], 6), { width: 6 * k, amount: 1.8, speed: 160, taper: (u) => 1 - 0.7 * u }));
  }
  return acts;
}

// A rolling swell: a sharp bright crest over a rounded trough (trochoid), its face in shadow.
function swell(stage, rng, { y, amp, lambda, x0, span, strength = 0.7, width = 3, shade = 0.8, speed = 700 }) {
  const ph = rng.float(0, 1);
  const crestY = (x) => y - amp * (1 - Math.abs(Math.sin(Math.PI * (x / lambda + ph))));
  const pts = [];
  for (let x = x0; x <= x0 + span; x += 5) pts.push([x, crestY(x)]);
  const depth = amp * 1.6 + 10;
  const face = [...pts, ...pts.slice().reverse().map(([x, yy]) => [x, yy + depth])];
  const s = stage.s;
  const ends = (x) => smoothstep(x0, x0 + span * 0.2, x) * smoothstep(x0 + span, x0 + span * 0.8, x);
  const shadeAt = (X, Y) => {
    const x = X / s;
    const d = clamp((Y / s - crestY(x)) / depth, 0, 1);
    return shade * ends(x) * (1 - d) ** 1.5;
  };
  if (rng.chance(0.5)) pts.reverse();
  return [
    K.reveal((st) => st.mask(face, { feather: 1 }), { op: 'add', amount: shadeAt, order: pts[0][0] < pts[1][0] ? 'left' : 'right', duration: 0.25, rest: 0.01 }),
    K.carve(pts, { width, strength, speed, rim: 0.3, rest: 0.03, taper: K.taperBoth }),
  ];
}

// The sea in front of the hull: the swell she rides, her bow wave and spray, the wake, the sails'
// glow on the water, and big rolling swells toward the viewer.
function foreground(stage, rng, { ship, H0, sunX }) {
  const { P } = ship;
  const acts = [];
  const s = stage.s;
  const sea = stage.streaky(1, 0.2, 0.002, 0.06, rng.float(0, 50));
  const [bowX, bowY] = P(330, 8);
  const [sternX] = P(-362, 8);
  const wl = ship.oy + 18 * ship.k;
  const band = [[-10, wl - 6]];
  for (let x = 0; x <= 1090; x += 10) {
    const hump = 30 * Math.exp(-(((x - bowX + 30) / 90) ** 2)) + 12 * Math.exp(-(((x - sternX - 60) / 140) ** 2));
    band.push([x, wl - 2 - hump + 6 * Math.sin(x / 47 + 1) + 3 * Math.sin(x / 15)]);
  }
  band.push([1090, 1930], [-10, 1930]);
  acts.push(
    K.reveal((st) => st.mask(band, { feather: 1, rough: 0.2, roughScale: 0.2 }), {
      op: 'set',
      level: (x, y) => sea(x, y) * (0.95 + 1.0 * smoothstep(H0, 1650, y / s)) * (1 - 0.4 * Math.exp(-(((x / s - sunX) / 220) ** 2))),
      order: 'left',
      duration: 5,
    }),
  );
  acts.push(K.carve(spline(band.slice(1, -2).filter((_, i) => i % 3 === 0), 4), { width: 4, strength: 0.6, speed: 800, rim: 0.25 }));

  // The sails' glow and the dawn glitter on the water under her.
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const y = wl + 26 + t * 160;
    const w = rng.float(40, 170) * (1 - t * 0.4);
    const x = ship.ox + rng.gauss(0, 120);
    acts.push(K.carve([[x - w / 2, y], [x + w / 2, y + rng.float(-1, 1)]], { width: 3 + t * 3, strength: 0.45 * (1 - t * 0.5), speed: 320, rest: 0.03 }));
  }
  // Bow wave, spray and wake.
  acts.push(K.carve(spline([[bowX + 30, bowY - 6], [bowX - 30, bowY + 8], [bowX - 120, bowY + 36], [bowX - 200, bowY + 70]], 8), { width: 7, strength: 0.8, speed: 300, rim: 0.3 }));
  acts.push(K.carve(spline([[bowX + 70, bowY + 18], [bowX, bowY + 36], [bowX - 100, bowY + 76]], 8), { width: 5, strength: 0.6, speed: 300, rim: 0.3 }));
  acts.push(...bowWave(rng, bowX, bowY - 6));
  for (let i = 0; i < 3; i++) {
    const spread = 16 + i * 32;
    acts.push(K.carve(spline([[sternX - 10, wl + 4], [sternX + 90, wl + 8 + spread * 0.4], [sternX + 220, wl + 12 + spread]], 10), { width: 3.5, strength: 0.45, speed: 420, rest: 0.05 }));
  }
  // Big swells rolling toward the viewer, in overlapping trains of varied length.
  for (let r = 0; r < 6; r++) {
    const y = 1262 + 95 * r + 7 * r * r;
    const amp = 12 + r * 4.5;
    for (let j = 0, x = rng.float(-300, -100); x < 1080; j++) {
      const span = rng.float(420, 760) + r * 40;
      acts.push(...swell(stage, rng, { y: y + rng.float(-14, 14), amp: amp * rng.float(0.8, 1.2), lambda: 170 + r * 50, x0: x, span, width: 4 + r * 0.9, strength: 0.72, speed: 1300 }));
      x += span * rng.float(0.55, 0.85);
    }
  }
  return acts;
}

// "A bone in her teeth": the white bow wave of a ship driving hard, heaped against the stem
// (x, y at the waterline) and curling forward, with spray flung ahead of it.
function bowWave(rng, x, y) {
  const acts = [
    K.carve(spline([[x + 170, y + 4], [x + 70, y - 2], [x + 14, y - 16], [x - 14, y - 36], [x - 52, y - 30], [x - 104, y - 8], [x - 170, y + 18]], 8), { width: 16, strength: 0.86, speed: 330, rim: 0.3, taper: K.taperBoth }),
    K.carve(spline([[x + 60, y + 14], [x - 10, y + 6], [x - 80, y + 18], [x - 170, y + 42]], 8), { width: 8, strength: 0.62, speed: 330, rim: 0.3, taper: K.taperBoth }),
  ];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI * rng.float(0.55, 0.95);
    const d0 = rng.float(18, 70);
    const len = rng.float(10, 24) * (1 - d0 / 150);
    const sx = x - 30 + Math.cos(a) * d0;
    const sy = y - 40 + Math.sin(a) * d0 * 0.7;
    acts.push(K.carve([[sx, sy], [sx + Math.cos(a) * len, sy + Math.sin(a) * len * 0.7]], { width: rng.float(3, 5), strength: 0.8, speed: 200, rest: 0.02, taper: K.taperBoth }));
  }
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * rng.float(0.5, 1.02);
    const d = 16 + Math.abs(rng.gauss(0, 56));
    const px = x - 34 + Math.cos(a) * d;
    const py = y - 40 + Math.sin(a) * d * 0.7;
    acts.push(K.carve([[px, py], [px + 0.5, py + 0.5]], { width: rng.float(2.5, 5.5) * Math.max(0.4, 1 - d / 240), strength: 0.8, speed: 100, rest: 0.005, taper: K.even }));
  }
  return acts;
}

// Seagulls riding the wind: bright M-shaped wings wiped into the sky.
function gulls() {
  const acts = [];
  for (const [x, y, w, lift] of [[122, 584, 44, 0.5], [252, 504, 32, 0.32], [58, 694, 26, 0.6]]) {
    const pts = spline([[x - w, y - w * lift], [x - w * 0.55, y - w * 0.42], [x - w * 0.12, y], [x, y + w * 0.06], [x + w * 0.12, y], [x + w * 0.55, y - w * 0.42], [x + w, y - w * lift]], 6);
    acts.push(K.carve(pts, { width: 5, strength: 0.85, speed: 220, rest: 0.1, rim: 0.2 }));
    acts.push(K.carve(ellipse(x, y + 3, 4, 2.5, 0, 8), { width: 3.5, strength: 0.75, speed: 80, rest: 0.05, taper: K.even }));
  }
  return acts;
}
