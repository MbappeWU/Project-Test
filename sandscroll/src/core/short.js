import { Stage } from './stage.js';
import { Rng, mixSeed, hashString } from './rng.js';
import { seedActions } from './actions.js';
import { Overlay, textBlockSprite, captionSprite } from './overlay.js';

// Vertical short video (9:16): one painting drawn quickly from an empty table, then its poem
// written into the sand at a readable pace, the seal, and a still hold with the poem caption.
// Timing is warped per phase so every short lands on the same rhythm regardless of how long
// the scene's gestures are:
//   lead (hook on screen) -> drawing (drawSeconds) -> inscription (inkSeconds) -> seal -> hold
export const SHORT_VIRTUAL = [1080, 1920];

// Platform safe areas on a 1080x1920 frame: TikTok / 小红书 UI covers roughly the top 140 px,
// the bottom ~22 % and a column of buttons on the right, so text stays centred and above it.
const SAFE = { hookTop: 150, captionBottom: 470 };

// Titles break after a full-width comma or colon so they sit in balanced lines.
export function hookLines(text) {
  return text.split(/(?<=[，：])/).map((t) => t.replace(/[，：]$/, '')).filter(Boolean);
}

export class ShortDirector {
  constructor({ scene, width = 1080, height = 1920, seed = 1, canvas, episode = null, drawSeconds = 30, inkSeconds = 6, holdSeconds = 7, lead = 0.6, cta = null } = {}) {
    this.scene = scene;
    this.stage = new Stage({ width, height, seed, canvas, virtual: SHORT_VIRTUAL });
    this.listeners = [];
    this.stage.on((event, data) => this.emit(event, data));
    const sceneSeed = mixSeed(seed, hashString(scene.id));
    seedActions(sceneSeed);
    const acts = scene.build(this.stage, new Rng(sceneSeed)).flat(Infinity).filter(Boolean);
    const ink = acts.findIndex((a) => a.tag === 'inscription');
    this.nDraw = ink >= 0 ? ink : acts.length;
    this.nInk = ink >= 0 ? 1 : 0;
    this.total = acts.length;
    const drawTime = acts.slice(0, this.nDraw).reduce((t, a) => t + a.duration, 0);
    const inkTime = ink >= 0 ? acts[ink].duration : 0;
    const tailTime = acts.slice(this.nDraw + this.nInk).reduce((t, a) => t + a.duration, 0);
    this.drawSpeed = Math.max(1, drawTime / drawSeconds);
    this.inkSpeed = inkTime > 0 ? Math.max(1, inkTime / inkSeconds) : 1;
    this.lead = lead;
    this.holdSeconds = holdSeconds;
    this.duration = lead + drawTime / this.drawSpeed + inkTime / this.inkSpeed + tailTime + holdSeconds;
    this.stage.play(acts);
    this.time = 0;
    this.finishedAt = null;
    this.episode = episode;
    this.cta = cta;
    this.showHook();
  }

  on(fn) {
    this.listeners.push(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners) fn(event, data);
  }

  get frame() {
    return this.stage.frame;
  }

  get activity() {
    return this.stage.activity;
  }

  // Index of the gesture being played, to pick the time warp for its phase.
  speed() {
    const st = this.stage;
    const idx = this.total - st.queue.length - (st.current ? 1 : 0);
    if (idx < this.nDraw) return this.drawSpeed;
    if (this.nInk && idx === this.nDraw) return this.inkSpeed;
    return 1;
  }

  update(dt) {
    this.time += dt;
    const st = this.stage;
    st.advance(this.time > this.lead ? dt * this.speed() : 0, dt);
    if (!st.busy && this.finishedAt === null) {
      this.finishedAt = this.time;
      this.showEnding();
    }
  }

  render() {
    return this.stage.render();
  }

  showHook() {
    const st = this.stage;
    const { hook } = this.scene;
    if (!hook) return;
    const blocks = [];
    if (this.episode) blocks.push({ text: this.episode, size: 26, face: 'kai', color: 'rgba(245, 214, 170, 0.9)' });
    hookLines(hook.cn).forEach((text, i) => blocks.push({ text, size: 76, face: 'brush', gap: i ? 0 : 6, leading: 0.2, color: 'rgba(255, 246, 228, 0.98)' }));
    if (hook.en) blocks.push({ text: hook.en, size: 36, face: 'kai', italic: true, gap: 8, color: 'rgba(255, 238, 212, 0.95)' });
    const sprite = textBlockSprite(st, blocks, { maxWidth: 960, pad: 26, halo: 18, band: 0.5 });
    const o = new Overlay(sprite, (st.width - sprite.w) / 2, SAFE.hookTop * st.s, { fadeIn: 0.25, hold: 3.6, fadeOut: 0.9 });
    st.addOverlay(o);
  }

  showEnding() {
    const st = this.stage;
    const poem = this.scene.poem;
    if (poem) {
      const sprite = captionSprite(st, poem, { maxWidth: 940, scale: 1.25 });
      const y = st.height - SAFE.captionBottom * st.s - sprite.h;
      st.addOverlay(new Overlay(sprite, (st.width - sprite.w) / 2, y, { fadeIn: 0.9, hold: 1e9, fadeOut: 1 }));
    }
    if (this.cta) {
      const sprite = textBlockSprite(
        st,
        [
          { text: this.cta.cn, size: 34, face: 'kai', color: 'rgba(255, 244, 222, 0.97)' },
          { text: this.cta.en, size: 26, face: 'kai', italic: true, gap: 2, color: 'rgba(255, 238, 212, 0.92)' },
        ],
        { maxWidth: 900, pad: 14, band: 0.42 },
      );
      st.addOverlay(new Overlay(sprite, (st.width - sprite.w) / 2, SAFE.hookTop * st.s, { delay: 1.2, fadeIn: 0.8, hold: 1e9, fadeOut: 1 }));
    }
  }
}
