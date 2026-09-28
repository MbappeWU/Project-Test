// Chinese pentatonic theory: five modes (宫商角徵羽) over 12-TET, A4 = 440 Hz.
// Melodies are written as scale-degree indices; a Mode maps them to MIDI so every
// generated pitch stays inside the pentatonic collection.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NAME_TO_PC = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6,
  Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

// Semitone offsets from each mode's own final (tonic).
export const MODES = {
  gong: [0, 2, 4, 7, 9], // 宫
  shang: [0, 2, 5, 7, 10], // 商
  jue: [0, 3, 5, 8, 10], // 角
  zhi: [0, 2, 5, 7, 9], // 徵
  yu: [0, 3, 5, 7, 10], // 羽
};

export const MODE_NAMES = Object.keys(MODES);
export const MODE_HANZI = { gong: '宫', shang: '商', jue: '角', zhi: '徵', yu: '羽' };

// Distance from the collection's 宫 (gong) note up to each mode's tonic.
const GONG_OFFSET = { gong: 0, shang: 2, jue: 4, zhi: 7, yu: 9 };

const mod = (a, n) => ((a % n) + n) % n;

export function pitchClass(name) {
  if (typeof name === 'number') return mod(name, 12);
  const pc = NAME_TO_PC[name];
  if (pc === undefined) throw new Error(`Unknown note name: ${name}`);
  return pc;
}

export function midiToName(midi) {
  return `${NOTE_NAMES[mod(midi, 12)]}${Math.floor(midi / 12) - 1}`;
}

export class Mode {
  constructor(tonic, name) {
    if (!MODES[name]) throw new Error(`Unknown mode: ${name}`);
    this.name = name;
    this.tonicPc = pitchClass(tonic);
    this.steps = MODES[name];
    this.base = 60 + this.tonicPc; // degree 0 = tonic in octave 4
    this.pcs = this.steps.map((s) => (this.tonicPc + s) % 12);
    this.gongPc = mod(this.tonicPc - GONG_OFFSET[name], 12);
    // Structural "dominant": the perfect fifth when the mode has one (jue falls back to the fourth).
    const fifth = this.steps.indexOf(7);
    this.fifth = fifth >= 0 ? fifth : this.steps.indexOf(5);
    const fourth = this.steps.indexOf(5);
    this.fourth = fourth >= 0 ? fourth : this.fifth;
  }

  get label() {
    return `${NOTE_NAMES[this.tonicPc]} ${this.name} (${MODE_HANZI[this.name]})`;
  }

  midi(deg) {
    const oct = Math.floor(deg / 5);
    return this.base + 12 * oct + this.steps[deg - oct * 5];
  }

  contains(midi) {
    return this.pcs.includes(mod(Math.round(midi), 12));
  }

  // Exact degree of an in-scale MIDI note, else null.
  degreeOf(midi) {
    const rel = midi - this.base;
    const oct = Math.floor(rel / 12);
    const idx = this.steps.indexOf(rel - oct * 12);
    return idx < 0 ? null : oct * 5 + idx;
  }

  // Nearest degree to a MIDI note (ties resolve downwards).
  nearestDegree(midi) {
    let deg = Math.floor(((midi - this.base) / 12) * 5) - 2;
    while (this.midi(deg + 1) <= midi) deg++;
    const lo = this.midi(deg);
    const hi = this.midi(deg + 1);
    return midi - lo <= hi - midi ? deg : deg + 1;
  }

  // Degree range [lo, hi] whose pitches lie inside [minMidi, maxMidi].
  degreeRange(minMidi, maxMidi) {
    let lo = this.nearestDegree(minMidi);
    if (this.midi(lo) < minMidi) lo++;
    let hi = this.nearestDegree(maxMidi);
    if (this.midi(hi) > maxMidi) hi--;
    return [lo, hi];
  }

  // Tonic degree (multiple of 5) whose pitch is closest to `midi`.
  tonicNear(midi) {
    return 5 * Math.round((midi - this.base) / 12);
  }

  // The same five pitches with a different final, e.g. B yu -> D gong (旋宫).
  sibling(name) {
    return new Mode(mod(this.gongPc + GONG_OFFSET[name], 12), name);
  }

  sameCollection(other) {
    return this.gongPc === other.gongPc;
  }

  describe() {
    return { tonic: NOTE_NAMES[this.tonicPc], mode: this.name, pcs: this.pcs.slice() };
  }
}
