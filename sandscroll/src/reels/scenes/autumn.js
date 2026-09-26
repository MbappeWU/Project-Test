import * as K from '../../core/kit.js';

// Placeholder: metadata is final, build() is a stand-in until the painting is done.
export default {
  id: 'autumn',
  music: 'plum',
  title: { cn: '一叶知秋', en: 'Autumn in One Leaf' },
  theme: '季节 · 秋天（#FallVibes）',
  hook: { en: 'Autumn, in one leaf', cn: '一叶知秋' },
  payoff: { en: 'Let it fall. Watch it fly.', cn: '叶落，雁南飞' },
  inscription: { columns: ['一叶知秋'], note: '出自《淮南子》“见一叶落而知岁之将暮”' },
  seal: '秋',
  twist: '飘落的枫叶化作一行南飞的大雁',
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
