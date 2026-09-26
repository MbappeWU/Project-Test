import * as K from '../../core/kit.js';

// Placeholder: metadata is final, build() is a stand-in until the painting is done.
export default {
  id: 'koi',
  music: 'river',
  title: { cn: '年年有余', en: 'Two Koi' },
  theme: '和谐 · 好运',
  hook: { en: 'Wait for the circle to close', cn: '两条锦鲤，一个圆' },
  payoff: { en: 'Two koi. One balance.', cn: '年年有余' },
  inscription: { columns: ['年年有余'], note: '吉语' },
  seal: '有余',
  twist: '两条追逐的锦鲤首尾相接，合成一个太极圆',
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
