import * as K from '../../core/kit.js';

// Placeholder: replaced by the finished portrait scene.
export default {
  id: 'plum',
  music: 'plum',
  title: { cn: '梅', en: 'Plum Blossom' },
  hook: { cn: '凌寒独自开，送给熬过冬天的你', en: 'For anyone getting through a hard winter' },
  theme: '坚韧 · 希望',
  poem: {
    columns: ['墙角数枝梅', '凌寒独自开'],
    cn: '墙角数枝梅，凌寒独自开',
    en: 'A few sprays of plum by the corner of the wall bloom alone, braving the cold.',
    by: '宋 · 王安石《梅花》  ·  Wang Anshi, Song dynasty',
  },
  seal: '暗香',
  build(stage) {
    return [...K.cover(stage, stage.vgrad(0.4, 0.2, 0, 1920)), K.inscribe(stage, { columns: this.poem.columns, x: 960, y: 500, size: 64, mode: 'pour' }), ...K.seal(stage, this.seal, 880, 1000)];
  },
};
