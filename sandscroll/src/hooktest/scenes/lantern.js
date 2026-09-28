import { ellipse } from '../../core/geom.js';
import * as K from '../../core/kit.js';
import lantern, { LANTERN } from '../../reels/scenes/lantern.js';

// H2 · R02 (jack-o'-lantern to Chinese lantern, batch 2's second best) with only the opening
// changed: the finished red lantern flashes first, rewinds, then is drawn (variant A). The
// lantern body and its tassel are vermilion; the caps stay gold.
export default {
  ...lantern,
  variant: 'A',
  hookTop: 205,
  hook: { en: 'Pumpkin → RED LANTERN', lines: ['Pumpkin →', 'RED LANTERN'], cn: '万圣节，中国风' },
  trend: 'Halloween (Oct 31) × Chinamaxxing; remake of R02, batch 2’s second most played reel',
  accent: '灯笼 (lantern body and tassel)',
  remakeOf: 'R02-lantern',
  build(stage, rng) {
    const acts = lantern.build.call(this, stage, rng).flat(Infinity).filter(Boolean);
    const at = acts.findIndex((a) => a.mark === 'lantern');
    const { cx, cy, rx, ry } = LANTERN;
    const body = ellipse(cx, cy, rx + 2, ry + 2, 0, 96);
    const tassel = [[cx - 30, cy + ry + 40], [cx + 30, cy + ry + 40], [cx + 42, cy + ry + 250], [cx - 42, cy + ry + 250]];
    acts.splice(at, 0, K.tint(stage, [body, tassel], { fadeIn: 1.2 }));
    return acts;
  },
};
