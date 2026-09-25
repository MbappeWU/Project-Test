import * as K from '../../core/kit.js';

// Placeholder: replaced by the finished portrait scene.
export default {
  id: 'cranes',
  music: 'finale',
  title: { cn: '天涯若比邻', en: 'Neighbours across the Ocean' },
  hook: { cn: '朋友不怕远：天涯若比邻', en: 'True friends are never far apart' },
  theme: '友谊',
  poem: {
    columns: ['海内存知己', '天涯若比邻'],
    cn: '海内存知己，天涯若比邻',
    en: 'A true friend within the four seas makes the ends of the earth feel next door.',
    by: '唐 · 王勃《送杜少府之任蜀州》  ·  Wang Bo, Tang dynasty',
  },
  seal: '和合',
  build(stage) {
    return [...K.cover(stage, stage.vgrad(0.4, 0.2, 0, 1920)), K.inscribe(stage, { columns: this.poem.columns, x: 960, y: 500, size: 64, mode: 'pour' }), ...K.seal(stage, this.seal, 880, 1000)];
  },
};
