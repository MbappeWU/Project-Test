import * as K from '../../core/kit.js';

// Placeholder: metadata is final, build() is a stand-in until the painting is done.
export default {
  id: 'chrysanthemum',
  music: 'pine',
  title: { cn: '采菊', en: 'Chrysanthemum Bloom' },
  theme: '节日 · 重阳（10 月 18 日）',
  hook: { en: 'Watch a flower bloom in sand', cn: '一朵菊花，慢慢开' },
  payoff: { en: '…and now it’s tea.', cn: '重阳节，喝一杯菊花茶' },
  inscription: { columns: ['采菊东篱下'], note: '晋 · 陶渊明《饮酒·其五》' },
  seal: '重阳',
  twist: '层层绽放的菊花原来漂在一杯菊花茶里',
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
