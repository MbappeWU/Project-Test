// Path helpers. A path is an array of [x, y] points in scene units (1920x1080 virtual canvas).

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Cumulative arc length table, used to walk a path at a given distance.
export function measure(pts) {
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return { pts, cum, length: cum[pts.length - 1] || 0 };
}

// Point and unit tangent at arc length s on a measured path.
export function pointAt(m, s) {
  const { pts, cum } = m;
  const n = pts.length;
  if (n === 1) return [pts[0][0], pts[0][1], 1, 0];
  s = clamp(s, 0, m.length);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1e-9;
  const t = (s - cum[lo]) / seg;
  const [x0, y0] = pts[lo];
  const [x1, y1] = pts[hi];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dl = Math.hypot(dx, dy) || 1;
  return [x0 + dx * t, y0 + dy * t, dx / dl, dy / dl];
}

// Centripetal-ish Catmull-Rom spline through control points.
export function spline(ctrl, segs = 10, closed = false) {
  const n = ctrl.length;
  if (n < 3) return ctrl.map((p) => [p[0], p[1]]);
  const out = [];
  const get = (i) => {
    if (closed) return ctrl[(i + n) % n];
    return ctrl[clamp(i, 0, n - 1)];
  };
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (closed) out.push([out[0][0], out[0][1]]);
  else out.push([ctrl[n - 1][0], ctrl[n - 1][1]]);
  return out;
}

export function arc(cx, cy, r, a0 = 0, a1 = TAU, n = 64) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function ellipse(cx, cy, rx, ry, rot = 0, n = 72) {
  const out = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = (TAU * i) / n;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

// Fractal ridge line from x0 to x1: returns points along the crest.
// `taper` (0..0.5) lowers both ends smoothly to baseY so ranges don't end in cliffs.
export function ridge(noise, x0, x1, baseY, amp, { step = 6, octaves = 5, freq = 1 / 420, offset = 0, peaks = null, taper = 0 } = {}) {
  const out = [];
  const span = x1 - x0 || 1;
  for (let x = x0; x <= x1 + 0.001; x += step) {
    let h = amp * (0.5 + 0.5 * noise.fbm1(offset + x * freq, octaves, 0.52));
    if (peaks) {
      for (const [px, ph, pw] of peaks) {
        const d = (x - px) / pw;
        h += ph * Math.exp(-d * d);
      }
    }
    if (taper > 0) {
      const u = (x - x0) / span;
      h *= smoothstep(0, taper, u) * smoothstep(1, 1 - taper, u);
    }
    out.push([x, baseY - h]);
  }
  return out;
}

// Closes a crest line into a polygon down to bottomY.
export function underRidge(crest, bottomY) {
  const first = crest[0];
  const last = crest[crest.length - 1];
  return [[first[0], bottomY], ...crest, [last[0], bottomY]];
}

