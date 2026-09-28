import { ellipse } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import hotwater, { PEARL } from '../../reels/scenes/hotwater.js';

// H1 · R01 (hot water to dragon, the best of batch 2) with only the opening changed: the cut
// starts as the dragon's body sweeps out of the steam coil (variant B). The pearl is vermilion.
export default {
  ...hotwater,
  variant: 'B',
  hookMark: 'dragon',
  hookOffset: 0.2,
  // The head is drawn from about 2.4 s, right under the caption: clear it by then.
  hookHold: 2,
  hook: { en: 'Hot water → DRAGON', lines: ['Hot water →', 'DRAGON'], cn: '多喝热水' },
  trend: 'Chinamaxxing / “becoming Chinese” (hot water, 养生); remake of R01, batch 2’s most played reel',
  accent: '龙珠 (the dragon’s pearl)',
  description: '一杯冒热气的热水（杯里漂着枸杞），蒸汽被掌心盘成一条龙，龙追着一颗朱红的龙珠，最后点睛。',
  remakeOf: 'R01-hotwater',
  build(stage, rng) {
    const acts = hotwater.build.call(this, stage, rng).flat(Infinity).filter(Boolean);
    const at = acts.findIndex((a) => a.mark === 'pearl');
    const [x, y, r] = PEARL;
    acts.splice(at, 0, K.tint(stage, [ellipse(x, y, r + 4, r + 4, 0, 48)], { fadeIn: 0.6 }));
    return acts;
  },
};
