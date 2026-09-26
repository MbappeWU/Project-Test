import * as K from '../../core/kit.js';

// Placeholder: metadata is final, build() is a stand-in until the painting is done.
export default {
  id: 'hotwater',
  music: 'bamboo',
  title: { cn: '多喝热水', en: 'Hot Water Dragon' },
  theme: '松弛 · 养生（Chinamaxxing 热点）',
  hook: { en: 'In my very Chinese era', cn: '多喝热水' },
  payoff: { en: 'Stay hydrated. Stay legendary.', cn: '多喝热水，龙马精神' },
  inscription: { columns: ['龙马精神'], note: '成语' },
  seal: '如意',
  twist: '一杯热水升起的蒸汽盘旋成一条龙',
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
