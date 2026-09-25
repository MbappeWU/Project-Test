import * as K from '../../core/kit.js';

// Placeholder: replaced by the finished portrait scene.
export default {
  id: 'vase',
  music: 'garden',
  title: { cn: '美美与共', en: 'Peony and Rose' },
  hook: { cn: '牡丹遇见玫瑰：美美与共', en: 'When a peony meets a rose' },
  theme: '和谐 · 包容',
  poem: {
    columns: ['各美其美', '美人之美', '美美与共', '天下大同'],
    cn: '各美其美，美人之美，美美与共，天下大同',
    en: 'Cherish your own beauty, admire the beauty of others; beauty shared makes the world one.',
    by: '费孝通  ·  Fei Xiaotong',
  },
  seal: '美美与共',
  build(stage) {
    return [...K.cover(stage, stage.vgrad(0.4, 0.2, 0, 1920)), K.inscribe(stage, { columns: this.poem.columns, x: 960, y: 500, size: 64, mode: 'pour' }), ...K.seal(stage, this.seal, 880, 1000)];
  },
};
