import * as K from '../../core/kit.js';

// Placeholder: replaced by the finished portrait scene.
export default {
  id: 'pinecrane',
  music: 'pine',
  title: { cn: '松鹤', en: 'Pine and Crane' },
  hook: { cn: '三十秒，给心放个假', en: 'Thirty seconds of calm' },
  theme: '宁静 · 松弛',
  poem: {
    columns: ['明月松间照', '清泉石上流'],
    cn: '明月松间照，清泉石上流',
    en: 'The bright moon shines between the pines; a clear spring flows over the stones.',
    by: '唐 · 王维《山居秋暝》  ·  Wang Wei, Tang dynasty',
  },
  seal: '松风',
  build(stage) {
    return [...K.cover(stage, stage.vgrad(0.4, 0.2, 0, 1920)), K.inscribe(stage, { columns: this.poem.columns, x: 960, y: 500, size: 64, mode: 'pour' }), ...K.seal(stage, this.seal, 880, 1000)];
  },
};
