import { spline } from '../core/geom.js';
import * as K from '../core/kit.js';
import * as L from '../core/landscape.js';

// 1784 · 远航 — the Empress of China under full sail, the first American ship to reach China.
export default {
  id: 'voyage1784',
  music: 'voyage',
  opening: 0.8,
  title: { cn: '远航 · 一七八四', en: 'The Voyage of 1784' },
  poem: {
    columns: ['长风破浪会有时', '直挂云帆济沧海'],
    cn: '长风破浪会有时，直挂云帆济沧海',
    en: 'A day will come to ride the wind and cleave the waves, to hoist my sail and cross the boundless sea.',
    by: '唐 · 李白《行路难》  ·  Li Bai, Tang dynasty',
  },
  note: {
    cn: '1784年，“中国皇后号”自纽约启航，驶抵广州',
    en: 'In 1784 the Empress of China sailed from New York to Canton, the first American ship to reach China',
  },
  seal: '远航',
  build(stage, rng) {
    const H0 = 700;
    const off = rng.float(0, 100);
    const sky = stage.vgrad(1.55, 0.45, 0, H0, 0.12, off);
    const sea = stage.streaky(1.35, 0.22, 0.0015, 0.07, off + 3);
    const ox = rng.float(1120, 1220);
    const oy = 770;
    const acts = [];

    acts.push(...K.cover(stage, sky, { rows: 5, y0: -60, y1: H0 + 30, rate: 0.9 }));
    acts.push(
      K.reveal((st) => st.mask([[-10, H0], [1930, H0], [1930, 1090], [-10, 1090]], { feather: 1, rough: 0.2, roughScale: 0.2 }), {
        op: 'set',
        level: (x, y) => sea(x, y) * (0.75 + 0.35 * Math.min(1, (y / stage.s - H0) / 380)),
        order: 'down',
        duration: 7,
      }),
    );
    // Evening clouds: long soft carved streaks.
    for (let i = 0; i < 4; i++) {
      const y = rng.float(150, 560);
      const x0 = rng.float(-50, 900);
      const len = rng.float(500, 900);
      acts.push(K.carve(spline([[x0, y], [x0 + len * 0.4, y - rng.float(4, 14)], [x0 + len, y + rng.float(-6, 6)]], 12), { width: rng.float(9, 18), strength: 0.3, speed: 520, rim: 0.05 }));
    }
    acts.push(...ship(stage, rng, { ox, oy, k: 1, dir: -1 }));
    acts.push(...L.flock(stage, rng, { x: ox - 520, y: 400, count: 3, size: 12, dx: 60, dy: 30, level: 1.6, vee: false }));
    acts.push(...foreground(stage, rng, { oy, ox, dir: -1 }));
    acts.push(K.inscribe(stage, { columns: this.poem.columns, x: 330, y: 70, size: 54, mode: 'carve', strength: 0.88, perChar: 1.2 }));
    acts.push(...K.seal(stage, this.seal, 190, 520, { size: 60, seed: rng.int(1, 999) }));
    return acts;
  },
};

function ship(stage, rng, { ox, oy, k = 1, dir = -1 }) {
  const P = (x, y) => [ox + dir * x * k, oy + y * k];
  const acts = [];
  const deck = spline([[-285, -74], [-235, -62], [-100, -48], [100, -46], [230, -54], [300, -70]].map(([x, y]) => P(x, y)), 8);
  const bottom = spline([[298, -44], [262, -6], [170, 10], [-100, 14], [-232, 6], [-278, -24]].map(([x, y]) => P(x, y)), 8);
  const hull = [...deck, ...bottom];

  const masts = [
    { x: 150, h: 360, scale: 0.9 },
    { x: 8, h: 410, scale: 1 },
    { x: -152, h: 310, scale: 0.78 },
  ];
  const yardLevels = [0.2, 0.46, 0.7, 0.88];
  const yardHalf = [112, 94, 70, 46];

  // Sails first (carved light into the sky), then spars and rigging poured over them.
  for (const m of masts) {
    const deckY = -48;
    const ys = yardLevels.map((f) => deckY - m.h * f);
    const hw = yardHalf.map((w) => w * m.scale);
    for (let i = 0; i < ys.length; i++) {
      const top = ys[i];
      const bot = i === 0 ? deckY - 26 : ys[i - 1] + 6;
      const tw = hw[i];
      const bw = i === 0 ? hw[0] * 1.02 : hw[i - 1] * 0.98;
      const belly = (bot - top) * 0.16;
      const sail = [
        P(m.x - tw, top),
        P(m.x + tw, top),
        ...spline([[m.x + bw, bot], [m.x, bot + belly], [m.x - bw, bot]].map(([x, y]) => P(x, y)), 10),
      ];
      acts.push(K.reveal((st) => st.mask(sail, { feather: 1, rough: 0.12, roughScale: 0.2 }), { op: 'carve', strength: 0.86, order: 'down', duration: 1.6, jitter: 0.05, rest: 0.1 }));
      // A seam of shadow gives each sail its curve.
      acts.push(K.pour(spline([[m.x - tw * 0.8, top + (bot - top) * 0.55], [m.x, top + (bot - top) * 0.62 + belly * 0.5], [m.x + tw * 0.8, top + (bot - top) * 0.55]].map(([x, y]) => P(x, y)), 8), { width: 3, amount: 0.35, speed: 400, rest: 0.03 }));
    }
  }
  // Jibs from the foremast to the bowsprit, and the spanker aft.
  const jibs = [
    [P(150, -330), P(405, -104), P(262, -78)],
    [P(150, -250), P(352, -92), P(240, -70)],
  ];
  for (const j of jibs) acts.push(K.reveal((st) => st.mask(j, { feather: 1 }), { op: 'carve', strength: 0.82, order: 'down', duration: 1.3, rest: 0.1 }));
  const spanker = [P(-152, -290), P(-262, -236), P(-300, -92), P(-152, -92)];
  acts.push(K.reveal((st) => st.mask(spanker, { feather: 1 }), { op: 'carve', strength: 0.82, order: 'down', duration: 1.4, rest: 0.1 }));

  // Hull.
  acts.push(K.reveal((st) => st.mask(hull, { feather: 1, rough: 0.1, roughScale: 0.3 }), { op: 'set', level: stage.mottle(2.7, 0.1), order: dir < 0 ? 'left' : 'right', duration: 5 }));
  acts.push(K.carve(spline([[-270, -40], [-100, -30], [120, -29], [280, -40]].map(([x, y]) => P(x, y)), 8), { width: 5, strength: 0.6, speed: 380, rim: 0.2 }));
  for (let x = -220; x <= 220; x += 44) acts.push(K.pour([P(x - 5, -30), P(x + 5, -30)], { width: 6, amount: 1.4, speed: 200, rest: 0.02, taper: () => 1 }));

  // Masts, yards, bowsprit.
  for (const m of masts) {
    acts.push(K.pour([P(m.x, -46), P(m.x - 6, -46 - m.h)], { width: 6 * m.scale, amount: 2.4, speed: 300, taper: (u) => 1 - 0.45 * u }));
    for (let i = 0; i < yardLevels.length; i++) {
      const y = -48 - m.h * yardLevels[i];
      const w = yardHalf[i] * m.scale;
      acts.push(K.pour([P(m.x - w - 6, y), P(m.x + w + 6, y)], { width: 3.4, amount: 2, speed: 380, rest: 0.05 }));
    }
  }
  acts.push(K.pour([P(290, -64), P(432, -112)], { width: 5, amount: 2.4, speed: 260 }));
  // Stays and shrouds.
  const lines = [
    [P(144, -46 - 360), P(430, -111)],
    [P(2, -46 - 410), P(144, -46 - 360 * 0.88)],
    [P(-158, -46 - 310), P(2, -46 - 410 * 0.86)],
    [P(-158, -46 - 310), P(-282, -72)],
    [P(8, -46 - 410 * 0.46), P(-60, -50)],
    [P(8, -46 - 410 * 0.46), P(70, -50)],
    [P(150, -46 - 360 * 0.46), P(100, -50)],
    [P(150, -46 - 360 * 0.46), P(205, -52)],
  ];
  for (const l of lines) acts.push(K.pour(l, { width: 1.6, amount: 1.4, speed: 460, rest: 0.03, scatter: 0 }));
  // Pennant at the main truck.
  acts.push(K.pour(spline([P(2, -46 - 410), P(-40, -46 - 404), P(-70, -46 - 412), P(-96, -46 - 406)], 6), { width: 4, amount: 1.8, speed: 160, taper: (u) => 1 - 0.8 * u }));
  return acts;
}

// Rolling sea in front of the hull: sharp-crested swells, the sails' reflection, bow wave and wake.
function foreground(stage, rng, { oy, ox, dir }) {
  const acts = [];
  const sea = stage.streaky(1.5, 0.2, 0.002, 0.06, rng.float(0, 50));
  const band = [[-10, oy - 6]];
  for (let x = 0; x <= 1940; x += 20) band.push([x, oy - 4 + 7 * Math.sin(x / 38 + 1) + 4 * Math.sin(x / 13)]);
  band.push([1940, 1090], [-10, 1090]);
  acts.push(K.reveal((st) => st.mask(band, { feather: 1, rough: 0.2, roughScale: 0.2 }), { op: 'set', level: sea, order: 'left', duration: 6 }));
  acts.push(K.carve(spline(band.slice(1, -2).filter((_, i) => i % 2 === 0), 4), { width: 3, strength: 0.5, speed: 700 }));

  // Reflection of the lit sails.
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const y = oy + 22 + t * 150;
    const w = rng.float(40, 150) * (1 - t * 0.4);
    const x = ox + rng.gauss(0, 120);
    acts.push(K.carve([[x - w / 2, y], [x + w / 2, y + rng.float(-1, 1)]], { width: 3 + t * 3, strength: 0.6 * (1 - t * 0.5), speed: 300, rest: 0.03 }));
  }
  // Bow wave and wake.
  const bow = ox + dir * 300;
  const stern = ox - dir * 280;
  acts.push(K.carve(spline([[bow + dir * 4, oy - 2], [bow + dir * 60, oy + 10], [bow + dir * 140, oy + 34]], 8), { width: 4, strength: 0.7, speed: 260 }));
  acts.push(K.carve(spline([[bow - dir * 30, oy + 8], [bow + dir * 30, oy + 26], [bow + dir * 90, oy + 58]], 8), { width: 3, strength: 0.5, speed: 260 }));
  for (let i = 0; i < 2; i++) {
    const spread = i ? 70 : 26;
    acts.push(K.carve(spline([[stern, oy + 6], [stern - dir * 200, oy + 14 + spread * 0.5], [stern - dir * 520, oy + 20 + spread]], 10), { width: 3, strength: 0.42, speed: 380 }));
  }
  // Swells growing toward the viewer, crests sharp and troughs flat (trochoid).
  const rows = [
    [oy + 70, 5, 110, 0],
    [oy + 140, 7, 150, 1],
    [oy + 225, 9, 200, 2],
    [oy + 320, 12, 260, 3],
  ];
  for (const [y, amp, lambda, r] of rows) {
    const segs = 3 - Math.floor(r / 2);
    for (let k = 0; k < segs; k++) {
      const span = rng.float(420, 820) + r * 120;
      const x0 = rng.float(-200, 1920 - span * 0.5);
      const ph = rng.float(0, 1);
      const pts = [];
      for (let x = x0; x <= x0 + span; x += 5) {
        const t = x / lambda + ph;
        pts.push([x, y - amp * (1 - Math.abs(Math.sin(Math.PI * t)))]);
      }
      if (rng.chance(0.5)) pts.reverse();
      acts.push(K.carve(pts, { width: 2.8 + r * 1.4, strength: 0.72 + r * 0.05, speed: 420 + r * 60, rim: 0.3 }));
      acts.push(K.carve(pts.map(([x, yy]) => [x, yy + amp * 1.3 + 6]), { width: 1.6 + r * 0.8, strength: 0.3, speed: 520, rim: 0.2, rest: 0.1 }));
    }
  }
  return acts;
}
