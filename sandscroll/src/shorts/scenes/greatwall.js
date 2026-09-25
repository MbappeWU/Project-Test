import * as K from '../../core/kit.js';

// Placeholder: replaced by the finished portrait scene.
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
  build(stage) {
    return [...K.cover(stage, stage.vgrad(0.4, 0.2, 0, 1920)), K.inscribe(stage, { columns: this.poem.columns, x: 960, y: 500, size: 64, mode: 'pour' }), ...K.seal(stage, this.seal, 880, 1000)];
  },
};
