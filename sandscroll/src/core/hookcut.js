import { ReelDirector, payoffOverlay } from './reel.js';
import { Overlay, hookSprite } from './overlay.js';
import { VERMILION } from './kit.js';
import { MusicEngine } from '../music/engine.js';
import { softClip } from '../music/dsp.js';

// Hook-test cut of a reel (8-12 s). The first two batches lost most viewers in the first one or
// two seconds, on a nearly empty opening frame, so the first frame here is readable at a glance:
//   A: the finished picture flashes for 0.3 s, rewinds to the empty table and is drawn from the
//      start; the video ends on the finished picture, so a replay runs straight into the flash.
//   B: the reel's cycle (draw, ink, seal, hold, sweep back) is rotated to start at the scene's
//      most striking moment (scene.hookMark); the last frame is the one just before the first.
// The same performance is rendered twice where needed (it is deterministic), so every seam,
// picture and music alike, joins frames that really follow each other. A scene may move the
// caption (hookTop, virtual px) or shorten it (hookHold, at least 2 s) to keep its subject clear.
export const HOOK_TIMING = { drawSeconds: 6.5, inkSeconds: 1.2, tailSeconds: 0.6, holdSeconds: 1.8, loopSeconds: 0.8 };
const FLASH = 0.3;
const REWIND = 0.5;
const HOOK_HOLD = 2.7;
const HOOK_FADE = 0.35;
const HOOK_TOP = 250;
const RING = 0.8; // seconds a finished music voice rings on under the next one
const SEAL_RED = `rgb(${VERMILION.join(', ')})`;

export class HookCut {
  constructor({ scene, width = 1080, height = 1920, seed = 1, canvas, fps = 30, sampleRate = 48000, music = true }) {
    this.scene = scene;
    this.variant = scene.variant;
    this.opts = { scene, seed, canvas, ui: false, loop: scene.variant === 'B', sealColor: SEAL_RED, ...HOOK_TIMING, ...scene.timing };
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.sampleRate = sampleRate;
    this.spf = sampleRate / fps;
    this.withMusic = music;
    this.musicSeed = seed + scene.id.length;
    this.plan = this.makePlan();
  }

  director(width = this.width, height = this.height) {
    return new ReelDirector({ ...this.opts, width, height });
  }

  // Frame indices of the cut, from a quick low-resolution run: the performance's timing does
  // not depend on resolution.
  makePlan() {
    const { fps, scene } = this;
    const d = this.director(108, 192);
    const n = Math.ceil(d.duration * fps);
    let complete = null;
    let hook = null;
    for (let f = 0; f < n; f++) {
      d.update(1 / fps);
      if (complete === null && d.completeAt !== null) complete = f;
      if (hook === null && scene.hookMark && d.marks[scene.hookMark] !== undefined) hook = f + Math.round((scene.hookOffset || 0) * fps);
    }
    if (complete === null) throw new Error(`${scene.id}: the painting never completes`);
    const plan = { n, complete, marks: { ...d.marks } };
    if (this.variant === 'A') {
      plan.flash = Math.round(FLASH * fps);
      const k = Math.round(REWIND * fps);
      // Rewind from the finished picture to the empty table, easing in and out.
      plan.rewind = Array.from({ length: k }, (_, j) => Math.round(complete * (1 - smooth(j / k))));
      plan.lead = plan.flash + k;
      plan.total = plan.lead + n;
      plan.out = (f) => plan.lead + f;
    } else {
      if (hook === null) throw new Error(`${scene.id}: variant B needs scene.hookMark`);
      if (hook <= 0 || hook >= complete) throw new Error(`${scene.id}: the hook moment must fall while the picture is being drawn`);
      plan.hook = hook;
      plan.total = n;
      plan.out = (f) => (f >= hook ? f - hook : n - hook + f);
    }
    plan.payoffStart = plan.out(complete);
    // Cover: the finished picture with its closing line, or for a guessing reel the frame the
    // scene names (a half-drawn picture that gives nothing away).
    if (scene.cover && plan.marks[scene.cover.mark] === undefined) throw new Error(`${scene.id}: no act is marked ${scene.cover.mark}`);
    const coverFrame = scene.cover ? Math.round((plan.marks[scene.cover.mark] + (scene.cover.offset || 0)) * fps) : complete + Math.round(0.8 * fps);
    plan.coverFrame = Math.min(coverFrame, n - 1);
    plan.cover = plan.out(plan.coverFrame);
    return plan;
  }

  get seconds() {
    return this.plan.total / this.fps;
  }

  get coverTime() {
    return Math.round((this.plan.cover / this.fps) * 10) / 10;
  }

  musicFor(d) {
    if (!this.withMusic) return null;
    const m = new MusicEngine({ sampleRate: this.sampleRate, seed: this.musicSeed, mood: this.scene.music });
    d.on((event, data) => event === 'cue' && m.cue(data));
    return m;
  }

  // Advances director and music by one frame; returns that frame's interleaved audio.
  step(d, m) {
    if (d) {
      d.update(1 / this.fps);
      d.render();
    }
    if (!m) return null;
    const L = new Float32Array(this.spf);
    const R = new Float32Array(this.spf);
    m.setSandActivity(d ? d.activity : 0);
    m.renderInto(L, R);
    const pcm = new Float32Array(this.spf * 2);
    for (let i = 0; i < this.spf; i++) {
      pcm[2 * i] = L[i];
      pcm[2 * i + 1] = R[i];
    }
    return pcm;
  }

  // Renders the cut, calling `emit(rgba, index)` for each output frame in order (captions
  // composited; awaited, so it can write to an encoder). Afterwards `this.audio` holds the
  // interleaved stereo track when music is on, and `this.seam` the mean difference between the
  // last and the first frame's sand.
  async render(emit) {
    const { plan } = this;
    const audio = this.withMusic ? new Float32Array(plan.total * this.spf * 2) : null;
    const put = (pcm, frame, gain = 1) => {
      if (!pcm || frame < 0 || frame >= plan.total) return;
      const o = frame * pcm.length;
      for (let i = 0; i < pcm.length; i++) audio[o + i] += pcm[i] * gain;
    };
    const ring = Math.round(RING * this.fps);
    const ringGain = (i) => 1 - smooth(i / ring);
    let mixed = 0;
    let first = null;
    let last = null;
    const out = async (raw, index) => {
      if (index === 0) first = Uint8ClampedArray.from(raw);
      if (index === plan.total - 1) last = raw;
      await emit(this.caption(raw, index), index);
    };

    if (this.variant === 'A') {
      // Pass 1 (silent): the finished picture and the frames the rewind runs back through.
      const d1 = this.director();
      this.captions = this.makeCaptions(d1.stage);
      const keep = new Map(plan.rewind.map((f) => [f, null]));
      let finished = null;
      for (let f = 0; f < plan.n; f++) {
        this.step(d1, null);
        if (keep.has(f)) keep.set(f, Uint8ClampedArray.from(d1.frame));
      }
      finished = Uint8ClampedArray.from(d1.frame);
      for (let i = 0; i < plan.flash; i++) await out(finished, i);
      for (const [j, f] of plan.rewind.entries()) await out(keep.get(f), plan.flash + j);
      keep.clear();
      // Pass 2: the performance from the start, with its music.
      const d2 = this.director();
      const m2 = this.musicFor(d2);
      for (let f = 0; f < plan.n; f++) {
        put(this.step(d2, m2), plan.lead + f);
        await out(d2.frame, plan.lead + f);
      }
      // The music runs on past the end into the flash and rewind, so the replay seam is
      // continuous, and rings out under the new start of the music.
      mixed = plan.lead;
      for (let i = 0; m2 && i < plan.lead + ring; i++) {
        const pcm = this.step(null, m2);
        if (i < plan.lead) put(pcm, i);
        else put(pcm, i, ringGain(i - plan.lead));
      }
    } else {
      const d1 = this.director();
      this.captions = this.makeCaptions(d1.stage);
      const m1 = this.musicFor(d1);
      for (let f = 0; f < plan.n; f++) {
        const pcm = this.step(d1, m1);
        if (f < plan.hook) continue;
        put(pcm, f - plan.hook);
        await out(d1.frame, f - plan.hook);
      }
      const wrap = plan.n - plan.hook;
      mixed = wrap;
      for (let i = 0; m1 && i < ring; i++) put(this.step(null, m1), wrap + i, ringGain(i));
      const d2 = this.director();
      const m2 = this.musicFor(d2);
      for (let f = 0; f < plan.hook; f++) {
        put(this.step(d2, m2), wrap + f);
        await out(d2.frame, wrap + f);
      }
    }
    // Two voices overlap where one rings out: keep that stretch under the engine's ceiling.
    if (audio) for (let i = mixed * this.spf * 2; i < Math.min(audio.length, (mixed + ring) * this.spf * 2); i++) audio[i] = softClip(audio[i], 0.708, 0.89);
    this.audio = audio;
    this.seam = sandDiff(first, last, this.width, this.height);
    return plan;
  }

  makeCaptions(st) {
    const { scene, fps, plan } = this;
    const hook = new Overlay(hookSprite(st, hookLines(scene)), 0, (scene.hookTop ?? HOOK_TOP) * st.s);
    hook.x = Math.round((this.width - hook.sprite.w) / 2);
    const payoff = payoffOverlay(st, scene.payoff, {});
    // Opacity of each caption for an output frame.
    const t = (i) => i / fps;
    const hold = scene.hookHold ?? HOOK_HOLD;
    const hookAt = (i) => (t(i) <= hold ? 1 : 1 - smooth((t(i) - hold) / HOOK_FADE));
    const p0 = plan.payoffStart;
    const { holdSeconds, loopSeconds } = this.opts;
    const payoffAt =
      this.variant === 'A'
        ? (i) => (i < p0 ? 0 : Math.min(smooth((i - p0) / (0.3 * fps)), smooth((plan.total - 1 - i) / (0.3 * fps))))
        : (i) => {
            const u = t(i - p0);
            const end = holdSeconds + loopSeconds;
            return i < p0 ? 0 : Math.min(smooth(u / 0.3), smooth((end - u) / 0.5));
          };
    return [
      [hook, hookAt],
      [payoff, payoffAt],
    ].filter(([o]) => o);
  }

  // A copy of the frame with the captions for output frame `index` composited on top.
  caption(raw, index) {
    const live = this.captions.map(([o, at]) => [o, at(index)]).filter(([, a]) => a > 0.002);
    if (!live.length) return raw;
    const frame = Uint8ClampedArray.from(raw);
    for (const [o, a] of live) {
      o.opacity = Math.min(1, a);
      o.composite(frame, this.width, 0, 0, this.width, this.height);
    }
    return frame;
  }
}

// Caption lines: strings in scene.hook.lines, the last (the payoff word) set larger.
export function hookLines(scene) {
  const all = scene.hook.lines;
  return all.map((l, i) => (typeof l === 'string' ? { text: l, size: i === all.length - 1 && all.length > 1 ? 150 : 116 } : l));
}

function smooth(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// Mean absolute difference of the sand below the hook band, between two RGBA frames.
export function sandDiff(a, b, W, H) {
  let sum = 0;
  let n = 0;
  for (let y = Math.round(H * 0.3); y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      n += 3;
    }
  }
  return sum / n;
}
