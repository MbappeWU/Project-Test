import { Stage } from './stage.js';
import { Rng, mixSeed, hashString } from './rng.js';
import { seedActions, call, wait } from './actions.js';
import { Overlay, textBlockSprite } from './overlay.js';
import { cover } from './kit.js';
import { SHORT_VIRTUAL } from './short.js';

// Loopable vertical reel for TikTok (~19 s), built for the first three seconds and for replays:
//   cold open: the table is already covered in dark sand, the hook is on screen from the first
//   frame and a guzheng glissando sounds, so the first bright stroke lands immediately;
//   drawing, including the scene's twist (drawSeconds) -> inscription (inkSeconds) -> seal ->
//   hold with the payoff line (holdSeconds) -> palm sweep back to the opening table
//   (loopSeconds), so the last frame flows into the first when TikTok replays the video.
// Hook and payoff are English-first: the reels are made for an international audience.
const SAFE = { hookTop: 150, payoffBottom: 470 };

export class ReelDirector {
  constructor({ scene, width = 1080, height = 1920, seed = 1, canvas, drawSeconds = 12, inkSeconds = 2.5, holdSeconds = 2.2, loopSeconds = 0.9 } = {}) {
    this.scene = scene;
    const st = (this.stage = new Stage({ width, height, seed, canvas, virtual: SHORT_VIRTUAL }));
    this.listeners = [];
    st.on((event, data) => this.emit(event, data));
    const sceneSeed = mixSeed(seed, hashString(scene.id));
    const opening = scene.opening ? scene.opening(st, new Rng(sceneSeed ^ 0x5eed)) : st.mottle(1.8, 0.1, 0.01, 3);
    const sweep = () => cover(st, opening, { rows: 5, speed: 2400, rate: 1, width: 440, wave: 22 });

    // The opening table is the loop sweep laid over an empty table, so the closing sweep over
    // the finished picture ends on (almost) the same frame the video starts with.
    seedActions(sceneSeed ^ 0x100b);
    st.play(sweep());
    while (st.busy) st.advance(1);
    st.time = 0;

    seedActions(sceneSeed);
    const acts = scene.build(st, new Rng(sceneSeed)).flat(Infinity).filter(Boolean);
    const ink = acts.findIndex((a) => a.tag === 'inscription');
    const nDraw = ink >= 0 ? ink : acts.length;
    const draw = acts.slice(0, nDraw);
    const inkActs = ink >= 0 ? [acts[ink]] : [];
    const tail = acts.slice(nDraw + inkActs.length);
    const hold = [
      call((s) => {
        this.completeAt = this.time;
        this.showPayoff(holdSeconds + loopSeconds);
      }),
      wait(holdSeconds),
    ];
    seedActions(sceneSeed ^ 0x100b);
    const loop = [
      call((s) => {
        s.sealOverlay?.dismiss(loopSeconds * 0.8);
        s.emit('cue', 'gliss');
      }),
      ...sweep(),
    ];

    const span = (list) => list.reduce((t, a) => t + a.duration, 0);
    const phases = [
      [draw, Math.max(1, span(draw) / drawSeconds)],
      [inkActs, inkActs.length ? Math.max(1, span(inkActs) / inkSeconds) : 1],
      [tail, 1],
      [hold, 1],
      [loop, span(loop) / loopSeconds],
    ];
    this.speeds = phases.flatMap(([list, speed]) => list.map(() => speed));
    this.duration = phases.reduce((t, [list, speed]) => t + span(list) / speed, 0);
    this.nInk = inkActs.length;
    this.total = this.speeds.length;
    st.play(phases.flatMap(([list]) => list));
    this.time = 0;
    this.started = false;
    this.completeAt = null;
    this.finishedAt = null;
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

  speed() {
    const st = this.stage;
    const idx = this.total - st.queue.length - (st.current ? 1 : 0);
    return this.speeds[Math.min(idx, this.total - 1)] ?? 1;
  }

  update(dt) {
    if (!this.started) {
      this.started = true;
      this.emit('cue', 'gliss');
    }
    this.time += dt;
    const st = this.stage;
    st.advance(dt * this.speed(), dt);
    if (!st.busy && this.finishedAt === null) this.finishedAt = this.time;
  }

  render() {
    return this.stage.render();
  }

  showHook() {
    const st = this.stage;
    const { hook } = this.scene;
    const blocks = [{ text: hook.en, size: 82, face: 'serif', leading: 0.12, color: 'rgba(255, 247, 230, 1)' }];
    if (hook.cn) blocks.push({ text: hook.cn, size: 46, face: 'brush', gap: 6, color: 'rgba(250, 226, 190, 0.95)' });
    const sprite = textBlockSprite(st, blocks, { maxWidth: 960, pad: 24, halo: 18, band: 0.45 });
    st.addOverlay(new Overlay(sprite, (st.width - sprite.w) / 2, SAFE.hookTop * st.s, { fadeIn: 0.01, hold: 2.6, fadeOut: 0.5 }));
  }

  showPayoff(seconds) {
    const st = this.stage;
    const { payoff } = this.scene;
    if (!payoff) return;
    const blocks = [{ text: payoff.en, size: 50, face: 'serif', italic: true, color: 'rgba(255, 246, 228, 0.98)' }];
    if (payoff.cn) blocks.push({ text: payoff.cn, size: 36, face: 'kai', gap: 4, color: 'rgba(250, 230, 200, 0.94)' });
    const sprite = textBlockSprite(st, blocks, { maxWidth: 960, pad: 18, halo: 16, band: 0.35 });
    const y = st.height - SAFE.payoffBottom * st.s - sprite.h;
    st.addOverlay(new Overlay(sprite, (st.width - sprite.w) / 2, y, { fadeIn: 0.3, hold: Math.max(0, seconds - 0.8), fadeOut: 0.5 }));
  }
}
