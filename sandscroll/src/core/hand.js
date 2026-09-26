// The sand artist's right hand, filmed like a live sand-art performance from a camera above the
// light table. The back of the hand faces the camera and is lit only by the dim room, so it reads
// as a warm, low-key silhouette; where the hand passes over bright sand, the table light glows
// through its thin edges (subsurface scattering), as it does through real fingers over a
// lightbox. A dark sleeve runs off the frame toward the artist.
// The hand follows the gesture being played: the index finger carves, a loose fist trickles
// sand, the flat palm sweeps. Between strokes it lifts and travels; when nothing is being drawn
// it withdraws from the table, so held pictures are clean.

const DEG = Math.PI / 180;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Geometry in hand lengths (wrist crease to middle fingertip = 1). v runs across the back of
// the hand, negative toward the thumb; u runs along it toward the fingertips.
const FINGERS = [
  { mcp: [-0.152, 0.418], len: [0.232, 0.145, 0.112], w: [0.096, 0.075], curve: 2 },
  { mcp: [-0.05, 0.44], len: [0.258, 0.168, 0.128], w: [0.1, 0.078], curve: 0 },
  { mcp: [0.054, 0.426], len: [0.24, 0.158, 0.118], w: [0.094, 0.073], curve: -2 },
  { mcp: [0.148, 0.388], len: [0.182, 0.114, 0.098], w: [0.082, 0.064], curve: -4 },
];
const THUMB = { mcp: [-0.168, 0.13], len: [0.17, 0.15, 0.118], w: [0.13, 0.086], curve: 3 };

// Per finger: [spread, MCP, PIP, DIP] in degrees; flexion bends a segment down toward the table,
// which from above shortens it, and past ~90 degrees it curls out of sight under the hand.
const POSES = {
  point: { fingers: [[-4, 24, 12, 6], [5, 44, 72, 40], [9, 50, 74, 40], [14, 56, 76, 40]], thumb: [-16, 6, 22, 18] },
  pour: { fingers: [[-3, 52, 72, 40], [0, 56, 72, 40], [4, 60, 72, 40], [9, 64, 72, 40]], thumb: [6, 8, 24, 26] },
  palm: { fingers: [[-3, 6, 5, 2], [0, 4, 5, 2], [3, 6, 5, 2], [7, 8, 7, 3]], thumb: [-36, 0, 6, 6] },
  rest: { fingers: [[-5, 22, 26, 12], [0, 20, 28, 12], [5, 22, 30, 14], [10, 26, 32, 14]], thumb: [-30, 4, 16, 12] },
};
const NAMES = Object.keys(POSES);
const POSE_FOR = { carve: 'point', pour: 'pour', relax: 'palm', fill: 'palm' };
// Wrist bend (degrees) per pose; the palm also leans into the direction it sweeps.
const DEVIATION = { point: -12, pour: -6, palm: 0, rest: -4 };

// Surface colours before lighting; the room light and the table glow are applied per pixel.
const SKIN = [170, 120, 100];
const SLEEVE = [36, 31, 31];
const RIM = [255, 112, 52];
// Room light from the upper left, above the table (x right, y down, z toward the camera).
const LIGHT = norm3(-0.42, -0.58, 0.7);
const HALF = norm3(LIGHT[0], LIGHT[1], LIGHT[2] + 1);

export class Hand {
  // quality 'high' draws the hand at half the frame's resolution, 'low' at a third (for the
  // real-time livestream).
  constructor(stage, { quality = 'high' } = {}) {
    this.stage = stage;
    this.length = 0.38 * Math.min(stage.VW, stage.VH); // virtual px
    // The artist sits at a long side of the table: the bottom edge of a landscape frame, the right
    // edge of a vertical one (a landscape table filmed turned), so the right arm reaches in from
    // there and crosses as little of the picture as possible.
    this.pivot = stage.VW >= stage.VH ? [stage.VW * 0.6, stage.VH * 1.5] : [stage.VW * 1.32, stage.VH * 0.8];
    this.pos = null; // contact point, virtual px
    this.vel = [0, 0];
    this.lift = 1;
    this.weights = { point: 0, pour: 0, palm: 0, rest: 1 };
    this.dev = 0;
    this.time = 0;
    this.idle = 0;
    this.present = false;
    this.seen = false;
    // The hand is drawn at about half (high) or a third (low) of 1080p detail and upsampled: it is
    // closer to the camera than the table and slightly out of focus, so this costs nothing visible.
    this.q = Math.min(1, (quality === 'low' ? 1 / 3 : 0.5) / stage.s);
    // Low quality also samples the hand once per 2x2 block and skips motion blur.
    this.low = quality === 'low';
    const W = Math.ceil(stage.width * this.q) + 2;
    const H = Math.ceil(stage.height * this.q) + 2;
    this.albedo = stage.canvas.create(W, H);
    // Masks in one canvas: alpha = bare skin, blue = relief (fingers slightly inset, so touching
    // fingers keep a groove), green = glossy nails.
    this.masks = stage.canvas.create(W, H);
    // Work buffers sized for the whole frame, reused every frame.
    const n = W * H;
    this.buf = {
      cover: new Float32Array(n), skin: new Float32Array(n), bump: new Float32Array(n), hgt: new Float32Array(n),
      tSkin: new Float32Array(n), tArm: new Float32Array(n), tmp: new Float32Array(n), glow: new Float32Array(n),
      glow2: new Float32Array(n), out: new Uint8ClampedArray(n * 4), out2: new Uint8ClampedArray(n * 4),
      rowMin: new Int32Array(H), rowMax: new Int32Array(H),
      // Premultiplied colour, coverage and glow, ready for compositing.
      pr: new Float32Array(n), pg: new Float32Array(n), pb: new Float32Array(n), pa: new Float32Array(n), pe: new Float32Array(n),
    };
    // Camera grain for the hand, a fixed tile offset every frame.
    this.grain = new Float32Array(256 * 256);
    for (let i = 0; i < this.grain.length; i++) this.grain[i] = ((hash(i & 255, i >> 8, 7) & 255) / 255 - 0.5) * 6;
    this.motion = [0, 0]; // screen movement since the last frame, stage px
    this.shown = null;
    this.sprite = null;
  }

  // dt in real seconds; contact is the gesture's current point (virtual px) or null.
  update(dt, contact, kind) {
    if (dt <= 0) return;
    this.time += dt;
    const target = contact ? POSE_FOR[kind] || 'rest' : 'rest';
    const kw = 1 - Math.exp(-dt * 12);
    for (const n of NAMES) this.weights[n] += ((n === target ? 1 : 0) - this.weights[n]) * kw;

    const L = this.length;
    if (contact) {
      this.idle = 0;
      if (!this.present) {
        // The very first stroke starts with the hand already on the table (cold open); later
        // it reaches in from the artist's side.
        this.pos = this.seen ? toward(contact, this.pivot, 1.6 * L) : [...contact];
        this.vel = [0, 0];
        this.lift = this.seen ? 1 : 0;
        this.present = true;
        this.seen = true;
      }
      const d = Math.hypot(contact[0] - this.pos[0], contact[1] - this.pos[1]);
      if (d < 0.6 * L) {
        this.vel = [(contact[0] - this.pos[0]) / dt, (contact[1] - this.pos[1]) / dt];
        this.pos = [...contact];
        this.lift += (0 - this.lift) * (1 - Math.exp(-dt * 14));
      } else {
        this.spring(contact, 34, dt);
        this.lift += (0.7 - this.lift) * (1 - Math.exp(-dt * 14));
      }
    } else if (this.present) {
      this.idle += dt;
      if (this.idle > 0.35) {
        this.spring(this.pivot, 10, dt);
        this.lift += (1 - this.lift) * (1 - Math.exp(-dt * 6));
        // The fingertips lead the way back to the artist, so once the contact point is past the
        // frame edge the whole hand is out of view.
        const m = 0.15 * L;
        const [x, y] = this.pos;
        if (x < -m || y < -m || x > this.stage.VW + m || y > this.stage.VH + m) this.present = false;
      }
    }

    let devTarget = 0;
    for (const n of NAMES) devTarget += DEVIATION[n] * this.weights[n];
    devTarget += 12 * this.weights.palm * Math.max(-1, Math.min(1, this.vel[0] / (3 * L)));
    this.dev += (devTarget - this.dev) * (1 - Math.exp(-dt * 6));
  }

  // Critically damped spring toward target, solved exactly over dt so it is stable at any frame rate.
  spring(target, k, dt) {
    const e = Math.exp(-k * dt);
    for (let i = 0; i < 2; i++) {
      const d = this.pos[i] - target[i];
      const c = this.vel[i] + k * d;
      this.pos[i] = target[i] + (d + c * dt) * e;
      this.vel[i] = (this.vel[i] - k * c * dt) * e;
    }
  }

  get visible() {
    return this.present;
  }

  // Takes the hand off the table as if the performance had not started (after a silent preroll).
  reset() {
    this.present = false;
    this.seen = false;
    this.shown = null;
    this.idle = 0;
    this.pos = null;
    this.vel = [0, 0];
  }

  // Forget the last shown position once the hand has left, so it does not smear on re-entry.
  hidden() {
    this.shown = null;
  }

  // Joint angles blended across poses, plus a faint tremor so the hand never looks frozen.
  pose() {
    const w = this.weights;
    const blend = (get) => NAMES.reduce((acc, n) => acc.map((v, i) => v + get(POSES[n])[i] * w[n]), [0, 0, 0, 0]);
    const life = Math.sin(this.time * 1.9) * Math.sin(this.time * 3.1);
    return {
      fingers: FINGERS.map((_, i) => blend((p) => p.fingers[i]).map((v, j) => v + (j > 0 ? life * 2 * w.rest : 0))),
      thumb: blend((p) => p.thumb),
    };
  }

  // Lays out the hand for this frame: joint chains in hand units and the hand-to-stage transform.
  layout() {
    const st = this.stage;
    const pose = this.pose();
    const fingers = FINGERS.map((f, i) => chain(f, pose.fingers[i]));
    const thumb = chain(THUMB, pose.thumb);
    const w = this.weights;
    const index = fingers[0];
    const tip = index.pts[index.pts.length - 1];
    const tipDir = unit(sub(tip, index.pts[Math.max(0, index.pts.length - 2)]));
    const contacts = {
      point: [tip[0] - tipDir[0] * 0.018, tip[1] - tipDir[1] * 0.018],
      pour: lerp2(index.pts[Math.min(1, index.pts.length - 1)], thumb.pts[thumb.pts.length - 1], 0.5),
      palm: [0, 0.27],
      rest: lerp2(fingers[1].pts[fingers[1].pts.length - 1], [0, 0.44], 0.5),
    };
    const local = NAMES.reduce((acc, n) => [acc[0] + contacts[n][0] * w[n], acc[1] + contacts[n][1] * w[n]], [0, 0]);

    const S = this.length * st.s * (1 + 0.06 * this.lift);
    const c = [this.pos[0] * st.s, this.pos[1] * st.s];
    const p = [this.pivot[0] * st.s, this.pivot[1] * st.s];
    const jitter = 1.2 * Math.sin(this.time * 1.7) * Math.sin(this.time * 2.9);
    let angle = Math.atan2(c[1] - p[1], c[0] - p[0]);
    let wrist = c;
    for (let i = 0; i < 2; i++) {
      const a = angle + (this.dev + jitter) * DEG;
      const du = [Math.cos(a), Math.sin(a)];
      const dv = [-du[1], du[0]];
      wrist = [c[0] - (dv[0] * local[0] + du[0] * local[1]) * S, c[1] - (dv[1] * local[0] + du[1] * local[1]) * S];
      angle = Math.atan2(wrist[1] - p[1], wrist[0] - p[0]);
    }
    const a = angle + (this.dev + jitter) * DEG;
    const du = [Math.cos(a), Math.sin(a)];
    const dv = [-du[1], du[0]];
    // The sleeve runs back toward the artist until it leaves the frame.
    const exit = exitDistance(wrist, [-du[0], -du[1]], st.width, st.height) / S;
    const sleeveEnd = -Math.min(7, Math.max(1.2, exit + 0.4));
    return { fingers, thumb, S, wrist, du, dv, sleeveEnd, flexMean: pose.fingers.reduce((t, f) => t + f[1], 0) / 4 };
  }

  rect() {
    if (!this.present) return null;
    const st = this.stage;
    const g = (this.geom = this.layout());
    const pts = [
      [-0.41, g.sleeveEnd], [0.41, g.sleeveEnd], [-0.33, -0.9], [0.33, -0.9],
      [-0.3, 0.1], [0.3, 0.1], [-0.3, 0.5], [0.3, 0.5],
      ...g.fingers.flatMap((f) => f.pts), ...g.thumb.pts,
    ];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [v, u] of pts) {
      const x = g.wrist[0] + (g.dv[0] * v + g.du[0] * u) * g.S;
      const y = g.wrist[1] + (g.dv[1] * v + g.du[1] * u) * g.S;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const shown = [this.pos[0] * st.s, this.pos[1] * st.s];
    // A 120-degree shutter: the hand smears over a third of this frame's movement.
    this.motion = this.shown ? [(shown[0] - this.shown[0]) / 3, (shown[1] - this.shown[1]) / 3] : [0, 0];
    this.shown = shown;
    const m = 0.12 * g.S + Math.hypot(this.motion[0], this.motion[1]) * 0.5;
    const r = [Math.max(0, Math.floor(x0 - m)), Math.max(0, Math.floor(y0 - m)), Math.min(st.width, Math.ceil(x1 + m)), Math.min(st.height, Math.ceil(y1 + m))];
    if (r[2] <= r[0] || r[3] <= r[1]) return null;
    return r;
  }

  // Renders the hand for the rectangle returned by rect(): flat colours with details (albedo), a
  // bare-skin mask and a relief mask are drawn with the canvas, then lit in a height-field pass so
  // fingers are round, touching fingers keep a groove and nothing shows seams at the joints.
  paint(rect) {
    const g = this.geom;
    const q = this.q;
    const [bx0, by0, bx1, by1] = rect;
    const sw = Math.max(3, Math.ceil((bx1 - bx0) * q));
    const sh = Math.max(3, Math.ceil((by1 - by0) * q));
    const begin = (canvas) => {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, sw + 2, sh + 2);
      ctx.setTransform(q * g.S * g.dv[0], q * g.S * g.dv[1], q * g.S * g.du[0], q * g.S * g.du[1], q * (g.wrist[0] - bx0), q * (g.wrist[1] - by0));
      return ctx;
    };
    const ac = begin(this.albedo);
    drawSleeve(ac, g);
    drawSkin(ac, g, this.low);
    const mc = begin(this.masks);
    mc.fillStyle = 'rgb(255, 0, 0)';
    for (const path of skinPaths(g, 1)) {
      mc.beginPath();
      path(mc);
      mc.fill();
    }
    mc.globalCompositeOperation = 'lighter';
    mc.fillStyle = 'rgb(0, 0, 255)';
    for (const path of skinPaths(g, 0.82)) {
      mc.beginPath();
      path(mc);
      mc.fill();
    }
    drawNails(mc, g, () => 'rgb(0, 255, 0)');

    const alb = ac.getImageData(0, 0, sw, sh).data;
    const mat = mc.getImageData(0, 0, sw, sh).data;
    const n = sw * sh;
    const { cover, skin, bump, hgt, tSkin, tArm, tmp, glow, out, rowMin, rowMax } = this.buf;
    for (let i = 0; i < n; i++) {
      cover[i] = alb[i * 4 + 3] / 255;
      skin[i] = mat[i * 4 + 3] / 255;
      bump[i] = (mat[i * 4 + 2] / 255) * skin[i];
    }
    // Heights in sprite pixels: skin rises over about a finger's half-width, the sleeve is a
    // broader, softer tube.
    const r1 = Math.max(1, Math.round(0.03 * g.S * q));
    const r2 = Math.max(2, Math.round(0.1 * g.S * q));
    blur(bump, tSkin, tmp, sw, sh, r1);
    blur(cover, tArm, tmp, sw, sh, r2);
    for (let i = 0; i < n; i++) hgt[i] = skin[i] * tSkin[i] * r1 * 3.2 + (1 - skin[i]) * tArm[i] * r2 * 1.1;

    for (let y = 0; y < sh; y++) {
      rowMin[y] = sw;
      rowMax[y] = -1;
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        if (cover[i] <= 0) {
          out[i * 4 + 3] = 0;
          glow[i] = 0;
          continue;
        }
        if (x < rowMin[y]) rowMin[y] = x;
        rowMax[y] = x;
        const nx0 = -(hgt[x < sw - 1 ? i + 1 : i] - hgt[x > 0 ? i - 1 : i]) * 0.5;
        const ny0 = -(hgt[y < sh - 1 ? i + sw : i] - hgt[y > 0 ? i - sw : i]) * 0.5;
        const m = 1 / Math.sqrt(nx0 * nx0 + ny0 * ny0 + 1);
        const nx = nx0 * m;
        const ny = ny0 * m;
        const nz = m;
        const dif = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        let spec = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
        spec *= spec;
        spec *= spec;
        spec *= spec;
        spec *= spec;
        spec *= spec; // ^32
        const sk = skin[i];
        const shiny = (mat[i * 4 + 1] / 255) * sk;
        // Grooves between fingers and the rims of the hand get less room light (occlusion).
        const occ = 0.62 + 0.38 * smooth(0.3, 0.85, tSkin[i]);
        const lit = sk * occ * (0.26 + 0.76 * dif) + (1 - sk) * (0.45 + 0.75 * dif);
        const sheen = spec * 255 * (sk * (0.06 + 0.4 * shiny) + (1 - sk) * 0.05);
        const o = i * 4;
        out[o] = alb[o] * lit + sheen;
        out[o + 1] = alb[o + 1] * lit + sheen;
        out[o + 2] = alb[o + 2] * lit + sheen;
        out[o + 3] = alb[o + 3];
        // Thin skin lets the table light through: strongest at the edges and in the fingers.
        glow[i] = sk * (1 - smooth(0.4, 0.92, tSkin[i]));
      }
    }
    let color = out;
    let light = glow;
    const mx = this.motion[0] * q;
    const my = this.motion[1] * q;
    const taps = Math.min(8, Math.ceil(Math.hypot(mx, my) / 1.2));
    if (taps > 1 && !this.low) [color, light] = this.smear(sw, sh, mx, my, taps);
    const { pr, pg, pb, pa, pe } = this.buf;
    for (let i = 0; i < n; i++) {
      const a = color[i * 4 + 3] / 255;
      pa[i] = a;
      pr[i] = color[i * 4] * a;
      pg[i] = color[i * 4 + 1] * a;
      pb[i] = color[i * 4 + 2] * a;
      pe[i] = light[i] * a;
    }
    this.sprite = { x0: bx0, y0: by0, w: sw, h: sh, rowMin, rowMax };
  }

  // Motion blur: averages the sprite over `taps` positions along (mx, my), alpha-weighted.
  smear(sw, sh, mx, my, taps) {
    const { out, glow, out2, glow2, rowMin, rowMax } = this.buf;
    const ext = Math.ceil(Math.hypot(mx, my) / 2) + 1;
    const ox = new Int32Array(taps);
    const oy = new Int32Array(taps);
    for (let k = 0; k < taps; k++) {
      const t = k / (taps - 1) - 0.5;
      ox[k] = Math.round(mx * t);
      oy[k] = Math.round(my * t);
    }
    const min = new Int32Array(sh);
    const max = new Int32Array(sh);
    for (let y = 0; y < sh; y++) {
      let lo = sw;
      let hi = -1;
      for (let dy = -ext; dy <= ext; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= sh || rowMax[yy] < 0) continue;
        lo = Math.min(lo, rowMin[yy] - ext);
        hi = Math.max(hi, rowMax[yy] + ext);
      }
      min[y] = Math.max(0, lo);
      max[y] = Math.min(sw - 1, hi);
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        out2[i * 4 + 3] = 0;
        glow2[i] = 0;
        if (x < min[y] || x > max[y]) continue;
        let a = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let e = 0;
        for (let k = 0; k < taps; k++) {
          const sx = x - ox[k];
          const sy = y - oy[k];
          if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
          const j = sy * sw + sx;
          const aj = out[j * 4 + 3];
          if (aj === 0) continue;
          a += aj;
          r += out[j * 4] * aj;
          g += out[j * 4 + 1] * aj;
          b += out[j * 4 + 2] * aj;
          e += glow[j] * aj;
        }
        if (a === 0) continue;
        out2[i * 4] = r / a;
        out2[i * 4 + 1] = g / a;
        out2[i * 4 + 2] = b / a;
        out2[i * 4 + 3] = a / taps;
        glow2[i] = e / a;
      }
    }
    for (let y = 0; y < sh; y++) {
      rowMin[y] = min[y];
      rowMax[y] = max[y] >= min[y] ? max[y] : -1;
    }
    return [out2, glow2];
  }

  // Composites the hand over frame (already holding sand and seal) inside [x0, y0, x1, y1).
  composite(frame, W, x0, y0, x1, y1) {
    const sp = this.sprite;
    if (!sp) return;
    const q = this.q;
    const step = this.low ? 2 : 1;
    const ax0 = Math.max(x0, sp.x0);
    const ay0 = Math.max(y0, sp.y0);
    const ax1 = Math.min(x1, Math.floor(sp.x0 + sp.w / q));
    const ay1 = Math.min(y1, Math.floor(sp.y0 + sp.h / q));
    const { w, h, rowMin, rowMax } = sp;
    const { pr, pg, pb, pa, pe } = this.buf;
    const grain = this.grain;
    const shift = (this.time * 977) | 0;
    for (let by = ay0; by < ay1; by += step) {
      const fy = Math.min(h - 1.001, Math.max(0, (by + (step - 1) / 2 - sp.y0 + 0.5) * q - 0.5));
      const iy = fy | 0;
      const ty = fy - iy;
      // Only the part of the row the hand covers.
      const lo = Math.min(rowMin[iy], rowMin[iy + 1]);
      const hi = Math.max(rowMax[iy], rowMax[iy + 1]);
      if (hi < 0) continue;
      const sx0 = Math.max(ax0, Math.floor(sp.x0 + (lo - 1) / q));
      const sx1 = Math.min(ax1, Math.ceil(sp.x0 + (hi + 2) / q));
      const yEnd = Math.min(by + step, ay1);
      for (let bx = sx0; bx < sx1; bx += step) {
        const fx = Math.min(w - 1.001, Math.max(0, (bx + (step - 1) / 2 - sp.x0 + 0.5) * q - 0.5));
        const ix = fx | 0;
        const tx = fx - ix;
        const i00 = iy * w + ix;
        const i01 = i00 + w;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;
        const a = pa[i00] * w00 + pa[i00 + 1] * w10 + pa[i01] * w01 + pa[i01 + 1] * w11;
        if (a <= 0.004) continue;
        const r = pr[i00] * w00 + pr[i00 + 1] * w10 + pr[i01] * w01 + pr[i01 + 1] * w11;
        const g = pg[i00] * w00 + pg[i00 + 1] * w10 + pg[i01] * w01 + pg[i01 + 1] * w11;
        const b = pb[i00] * w00 + pb[i00 + 1] * w10 + pb[i01] * w01 + pb[i01 + 1] * w11;
        const e = pe[i00] * w00 + pe[i00 + 1] * w10 + pe[i01] * w01 + pe[i01 + 1] * w11;
        const xEnd = Math.min(bx + step, sx1);
        for (let y = by; y < yEnd; y++) {
          for (let x = bx; x < xEnd; x++) {
            const o = (y * W + x) * 4;
            // Table light glowing through thin skin, stronger over bright sand.
            let glow = 0;
            if (e > 0.002) {
              const lum = (0.3 * frame[o] + 0.59 * frame[o + 1] + 0.11 * frame[o + 2]) / 255;
              glow = e * lum * Math.sqrt(Math.sqrt(lum)) * 0.85;
            }
            const n = grain[((y & 255) << 8) | ((x + shift) & 255)] * a;
            const k = 1 - a;
            frame[o] = frame[o] * k + r + glow * RIM[0] + n;
            frame[o + 1] = frame[o + 1] * k + g + glow * RIM[1] + n;
            frame[o + 2] = frame[o + 2] * k + b + glow * RIM[2] + n;
          }
        }
      }
    }
  }
}

function chain(f, [spread, ...flex]) {
  const pts = [[f.mcp[0], f.mcp[1]]];
  const widths = [f.w[0]];
  const bends = [];
  const total = f.len.reduce((s, l) => s + l, 0);
  let acc = 0;
  let ang = spread * DEG;
  let run = 0;
  for (let i = 0; i < f.len.length; i++) {
    acc += flex[i] * DEG;
    if (acc >= 88 * DEG) break; // this part curls under the hand, out of sight
    ang += f.curve * DEG;
    const l = f.len[i] * Math.cos(acc);
    const [v, u] = pts[pts.length - 1];
    pts.push([v + Math.sin(ang) * l, u + Math.cos(ang) * l]);
    run += f.len[i];
    widths.push(f.w[0] + (f.w[1] - f.w[0]) * (run / total));
    bends.push(acc);
  }
  return { pts, widths, bends };
}

// Each finger is a row of capsules (segments with round joints), which gives rounded knuckles.
function capsules(c) {
  const out = [];
  for (let i = 0; i < c.pts.length - 1; i++) {
    const a = c.pts[i];
    const b = c.pts[i + 1];
    const ra = c.widths[i] / 2;
    const rb = c.widths[i + 1] / 2;
    out.push({ a, b, ra, rb });
  }
  if (!out.length) out.push({ a: c.pts[0], b: c.pts[0], ra: c.widths[0] / 2, rb: c.widths[0] / 2 });
  return out;
}

function capsulePath(ctx, { a, b, ra, rb }) {
  const d = unit(sub(b, a));
  const n = [-d[1], d[0]];
  const ang = Math.atan2(d[1], d[0]);
  ctx.moveTo(a[0] + n[0] * ra, a[1] + n[1] * ra);
  ctx.lineTo(b[0] + n[0] * rb, b[1] + n[1] * rb);
  ctx.arc(b[0], b[1], rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - n[0] * ra, a[1] - n[1] * ra);
  ctx.arc(a[0], a[1], ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
}

const PALM = [
  [-0.172, 0.0], [-0.192, 0.12], [-0.214, 0.25], [-0.206, 0.38], [-0.168, 0.44], [-0.1, 0.46], [-0.05, 0.47],
  [0.02, 0.463], [0.06, 0.455], [0.12, 0.43], [0.172, 0.405], [0.2, 0.36], [0.205, 0.24], [0.19, 0.11], [0.172, 0.0], [0, -0.012],
];

function smoothClosed(ctx, pts) {
  const n = pts.length;
  const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

function forearmPath(ctx) {
  ctx.moveTo(-0.172, 0.02);
  ctx.bezierCurveTo(-0.19, -0.25, -0.205, -0.6, -0.225, -0.98);
  ctx.lineTo(0.235, -0.98);
  ctx.bezierCurveTo(0.21, -0.6, 0.2, -0.25, 0.178, 0.02);
  ctx.closePath();
}

// Silhouette pieces of bare skin, as path builders in hand units; `inset` narrows the fingers.
function skinPaths(g, inset) {
  const paths = [forearmPath, (ctx) => smoothClosed(ctx, PALM)];
  for (const f of [...g.fingers, g.thumb]) {
    for (const cap of capsules(f)) paths.push((ctx) => capsulePath(ctx, { ...cap, ra: cap.ra * inset, rb: cap.rb * inset }));
  }
  return paths;
}

function rgba([r, g, b], a) {
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
}

function blob(ctx, x, y, r, [cr, cg, cb], a) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${a})`);
  grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSleeve(ctx, g) {
  const e = g.sleeveEnd;
  ctx.beginPath();
  ctx.moveTo(-0.3, -0.86);
  ctx.quadraticCurveTo(0, -0.8, 0.31, -0.86);
  ctx.lineTo(0.4, e);
  ctx.lineTo(-0.39, e);
  ctx.closePath();
  ctx.fillStyle = rgba(SLEEVE, 1);
  ctx.fill();
  // Folds and the cuff edge.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  for (const [v0, u0, v1, u1, a] of [[-0.16, -0.95, -0.02, -1.9, 0.28], [0.15, -1.0, 0.2, -2.2, 0.2], [-0.25, -1.5, -0.1, -2.7, 0.18], [0.04, -2.0, 0.12, -3.3, 0.15]]) {
    ctx.strokeStyle = `rgba(78, 68, 64, ${a})`;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(v0, u0);
    ctx.quadraticCurveTo((v0 + v1) / 2 + 0.05, (u0 + u1) / 2, v1, u1);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(96, 84, 78, 0.8)';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.29, -0.865);
  ctx.quadraticCurveTo(0, -0.805, 0.3, -0.865);
  ctx.stroke();
  ctx.restore();
}

// Flat skin colour with its natural variation (redder knuckles and fingertips, paler forearm),
// wrinkles, a vein, finger separations and nails. Lighting comes later.
function drawSkin(ctx, g, low = false) {
  ctx.fillStyle = rgba(SKIN, 1);
  for (const path of skinPaths(g, 1)) {
    ctx.beginPath();
    path(ctx);
    ctx.fill();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  blob(ctx, 0.02, -0.55, 0.45, [206, 160, 128], 0.4);
  blob(ctx, -0.02, 0.2, 0.26, [200, 146, 116], 0.3);
  for (const f of FINGERS) blob(ctx, f.mcp[0], f.mcp[1] + 0.012, 0.055, [204, 108, 94], 0.3);
  for (const f of [...g.fingers, g.thumb]) {
    for (let j = 1; j < f.pts.length; j++) {
      const tip = j === f.pts.length - 1;
      blob(ctx, f.pts[j][0], f.pts[j][1], f.widths[j] * (tip ? 0.7 : 0.55), [206, 104, 92], tip ? 0.34 : 0.26);
    }
  }
  const dark = (a) => `rgba(98, 54, 44, ${a})`;
  if (low) {
    // At a third of the frame's resolution only the nails still read.
    drawNails(ctx, g, () => 'rgb(214, 170, 158)');
    ctx.restore();
    return;
  }
  // A vein and the extensor tendons (the latter only show when the fingers stretch).
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(122, 104, 128, 0.12)';
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(0.1, -0.1);
  ctx.bezierCurveTo(0.06, 0.08, 0.1, 0.2, 0.03, 0.33);
  ctx.moveTo(0.075, 0.12);
  ctx.quadraticCurveTo(-0.03, 0.19, -0.09, 0.32);
  ctx.stroke();
  const stretch = 1 - smooth(10, 60, g.flexMean);
  ctx.strokeStyle = `rgba(214, 172, 146, ${0.04 + 0.08 * stretch})`;
  ctx.lineWidth = 0.02;
  for (const f of FINGERS) {
    ctx.beginPath();
    ctx.moveTo(f.mcp[0], f.mcp[1] - 0.025);
    ctx.quadraticCurveTo(f.mcp[0] * 0.6, 0.2, f.mcp[0] * 0.25 + 0.01, 0.03);
    ctx.stroke();
  }
  for (const f of [...g.fingers, g.thumb]) {
    // A fine line along each finger so touching fingers read as separate.
    ctx.strokeStyle = dark(0.14);
    ctx.lineWidth = 0.006;
    for (const cap of capsules(f)) {
      ctx.beginPath();
      capsulePath(ctx, cap);
      ctx.stroke();
    }
    // Wrinkles over the middle and end joints.
    for (let j = 1; j < f.pts.length - 1; j++) {
      const p = f.pts[j];
      const d = unit(sub(f.pts[j + 1], f.pts[j - 1]));
      const nrm = [-d[1], d[0]];
      const hw = f.widths[j] * 0.3;
      const lines = j === 1 ? 3 : 2;
      ctx.strokeStyle = dark(j === 1 ? 0.5 : 0.36);
      ctx.lineWidth = 0.005;
      for (let k = 0; k < lines; k++) {
        const o = (k - (lines - 1) / 2) * 0.01;
        const c = [p[0] + d[0] * o, p[1] + d[1] * o];
        ctx.beginPath();
        ctx.moveTo(c[0] - nrm[0] * hw, c[1] - nrm[1] * hw);
        ctx.quadraticCurveTo(c[0] + d[0] * 0.008, c[1] + d[1] * 0.008, c[0] + nrm[0] * hw, c[1] + nrm[1] * hw);
        ctx.stroke();
      }
    }
  }
  drawNails(ctx, g, (len) => {
    const grad = ctx.createLinearGradient(0, -len / 2, 0, len / 2);
    grad.addColorStop(0, 'rgb(214, 170, 158)');
    grad.addColorStop(0.72, 'rgb(196, 146, 136)');
    grad.addColorStop(0.86, 'rgb(236, 214, 200)');
    grad.addColorStop(1, 'rgb(240, 222, 210)');
    return grad;
  }, dark(0.4));
  ctx.restore();
}

// Nails show on end segments that face the camera; fill(len) gives the paint for one nail.
function drawNails(ctx, g, fill, outline = null) {
  for (const f of [...g.fingers, g.thumb]) {
    if (f.pts.length !== 4 || f.bends[2] >= 62 * DEG) continue;
    const a = f.pts[2];
    const b = f.pts[3];
    const d = unit(sub(b, a));
    const n = [-d[1], d[0]];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const len = Math.max(0.02, segLen * 0.6 + 0.014);
    const wid = f.widths[3] * (f === g.thumb ? 0.5 : 0.64);
    const c = [a[0] + d[0] * (segLen - len * 0.5 + 0.006), a[1] + d[1] * (segLen - len * 0.5 + 0.006)];
    ctx.save();
    ctx.transform(n[0], n[1], d[0], d[1], c[0], c[1]);
    ctx.beginPath();
    roundedRect(ctx, -wid / 2, -len / 2, wid, len, wid * 0.45);
    ctx.fillStyle = fill(len);
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 0.005;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Two box-blur passes in each direction (close to a Gaussian), from src into dst.
function blur(src, dst, tmp, w, h, r) {
  const n = w * h;
  for (let i = 0; i < n; i++) dst[i] = src[i];
  for (let pass = 0; pass < 2; pass++) {
    boxH(dst, tmp, w, h, r);
    boxV(tmp, dst, w, h, r);
  }
}

function boxH(src, dst, w, h, r) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * k;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
}

function boxV(src, dst, w, h, r) {
  const k = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += src[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * k;
      acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
    }
  }
}

function norm3(x, y, z) {
  const m = Math.hypot(x, y, z);
  return [x / m, y / m, z / m];
}

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function unit(v) {
  const m = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / m, v[1] / m];
}

function lerp2(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function toward(from, to, dist) {
  const d = unit(sub(to, from));
  return [from[0] + d[0] * dist, from[1] + d[1] * dist];
}

// How far a ray from p along dir travels before leaving the w x h frame.
function exitDistance(p, dir, w, h) {
  let t = Infinity;
  if (dir[0] > 1e-6) t = Math.min(t, (w - p[0]) / dir[0]);
  if (dir[0] < -1e-6) t = Math.min(t, -p[0] / dir[0]);
  if (dir[1] > 1e-6) t = Math.min(t, (h - p[1]) / dir[1]);
  if (dir[1] < -1e-6) t = Math.min(t, -p[1] / dir[1]);
  return Math.max(0, t);
}
