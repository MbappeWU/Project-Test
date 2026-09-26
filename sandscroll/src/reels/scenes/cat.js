import * as K from '../../core/kit.js';

// Placeholder: metadata is final, build() is a stand-in until the painting is done.
export default {
  id: 'cat',
  music: 'panda',
  title: { cn: '狸奴', en: 'Guess the Cat' },
  theme: '互动 · 猜画',
  hook: { en: 'Guess what this becomes', cn: '猜猜我在画什么' },
  payoff: { en: 'Did you guess the cat?', cn: '你猜对了吗？' },
  inscription: { columns: ['我与狸奴不出门'], note: '宋 · 陆游《十一月四日风雨大作》' },
  seal: '狸奴',
  twist: '看似抽象的几道弧线，最后变成屋脊上蜷着睡觉的猫',
  build(stage) {
    const pts = [];
    for (let i = 0; i <= 64; i++) pts.push([540 + 260 * Math.cos((i / 64) * Math.PI * 2), 960 + 260 * Math.sin((i / 64) * Math.PI * 2)]);
    return [
      K.carve(pts, { width: 10 }),
      K.inscribe(stage, { columns: this.inscription.columns, x: 950, y: 500, size: 56 }),
      ...K.seal(stage, this.seal, 880, 1000, { size: 60 }),
    ];
  },
};
