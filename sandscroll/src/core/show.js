import { Stage } from './stage.js';
import { Rng, mixSeed, hashString } from './rng.js';
import * as K from './kit.js';
import { seedActions } from './actions.js';
import { SCENES, PROGRAM } from '../scenes/index.js';

// The director: plays scenes from the program forever. Each scene opens with a palm wash that
// dissolves the previous picture, is drawn gesture by gesture, then rests with its poem caption.
// Seeds change every cycle so no two performances of a scene are identical.
export class Show {
  constructor({ width = 1280, height = 720, seed = 2026, canvas, program = PROGRAM, hold = 24, start = 0, notes = {}, pace = 0.85 } = {}) {
    this.stage = new Stage({ width, height, seed, canvas });
    this.seed = seed;
    this.program = program.filter((id) => SCENES[id]);
    if (!this.program.length) throw new Error('program has no known scenes');
    this.hold = hold;
    this.notes = notes;
    // Below 1 the artist draws more slowly than the scenes are authored (calmer for 24/7 viewing).
    this.pace = pace;
    this.index = start;
    this.scene = null;
    this.listeners = [];
    this.stage.on((event, data) => this.emit(event, data));
  }

  on(fn) {
    this.listeners.push(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners) fn(event, data);
  }

  get cycle() {
    return Math.floor(this.index / this.program.length);
  }

  queueNext() {
    const id = this.program[this.index % this.program.length];
    const scene = SCENES[id];
    const sceneSeed = mixSeed(this.seed, this.cycle * 1009 + hashString(id));
    const rng = new Rng(sceneSeed);
    const st = this.stage;
    seedActions(sceneSeed);
    this.scene = scene;
    // program.json may add a note to any scene, replace the default, or hide it with null.
    const note = id in this.notes ? this.notes[id] : scene.note;
    st.play([
      K.clearOverlays(),
      K.call(() => this.emit('scene', scene)),
      // An empty table needs no dissolving gesture.
      ...(st.time > 0 ? K.wash(st, rng, { level: scene.opening ?? 0.5 }) : []),
      ...scene.build(st, rng),
      scene.poem ? K.caption(st, scene.poem, { hold: this.hold }) : null,
      note ? K.note(st, note, { hold: this.hold, delay: 1.5 }) : null,
      K.wait(this.hold + 5),
    ]);
    this.index++;
  }

  update(dt) {
    if (!this.stage.busy) this.queueNext();
    this.stage.advance(dt * this.pace);
  }

  render() {
    return this.stage.render();
  }

  get frame() {
    return this.stage.frame;
  }

  get activity() {
    return this.stage.activity;
  }
}
