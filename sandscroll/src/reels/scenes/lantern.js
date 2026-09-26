import * as K from '../../core/kit.js';

// Placeholder: metadata is final, build() is a stand-in until the painting is done.
export default {
  id: 'lantern',
  music: 'garden',
  title: { cn: '灯火可亲', en: 'Jack-o’-Lantern to Chinese Lantern' },
  theme: '节日 · 万圣节 × 中国风',
  hook: { en: 'Halloween, but make it Chinese', cn: '万圣节，中国风' },
  payoff: { en: 'Same glow. Different story.', cn: '同一盏灯火，不同的故事' },
  inscription: { columns: ['灯火可亲'], note: '化用唐 · 韩愈《符读书城南》“灯火稍可亲”' },
  seal: '灯',
  twist: '发光的南瓜灯被掌心一抹，变成挂着流苏的红灯笼',
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
