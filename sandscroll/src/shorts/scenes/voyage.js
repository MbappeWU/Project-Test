import * as K from '../../core/kit.js';

// Placeholder: replaced by the finished portrait scene.
export default {
  id: 'voyage',
  music: 'voyage',
  title: { cn: '远航', en: 'Setting Sail' },
  hook: { cn: '给正在努力的你：长风破浪会有时', en: 'For everyone working toward a dream' },
  theme: '奋斗 · 梦想',
  poem: {
    columns: ['长风破浪会有时', '直挂云帆济沧海'],
    cn: '长风破浪会有时，直挂云帆济沧海',
    en: 'A day will come to ride the wind and cleave the waves, to hoist my sail and cross the boundless sea.',
    by: '唐 · 李白《行路难》  ·  Li Bai, Tang dynasty',
  },
  seal: '远航',
  build(stage) {
    return [...K.cover(stage, stage.vgrad(0.4, 0.2, 0, 1920)), K.inscribe(stage, { columns: this.poem.columns, x: 960, y: 500, size: 64, mode: 'pour' }), ...K.seal(stage, this.seal, 880, 1000)];
  },
};
