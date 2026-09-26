import moon from './scenes/moon.js';
import panda from './scenes/panda.js';
import greatwall from './scenes/greatwall.js';
import voyage from './scenes/voyage.js';
import pinecrane from './scenes/pinecrane.js';
import plum from './scenes/plum.js';
import cranes from './scenes/cranes.js';
import vase from './scenes/vase.js';

// 「一沙一世界 · A World in a Grain of Sand」— vertical digital sand-art shorts for TikTok and
// 小红书. The series name comes from William Blake ("To see a World in a Grain of Sand"), whose
// line is known in Chinese as 一沙一世界. Episodes are listed in posting order.
export const SERIES = { cn: '一沙一世界', en: 'A World in a Grain of Sand' };

export const CTA = { cn: '下一幅画什么？评论区告诉我', en: 'What should I paint next? Tell me in the comments' };

export const SHORTS = [moon, panda, greatwall, voyage, pinecrane, plum, cranes, vase];

export const SHORT_SCENES = Object.fromEntries(SHORTS.map((s) => [s.id, s]));

export function episodeLabel(index) {
  return `${SERIES.cn} · 数字沙画 EP.${String(index + 1).padStart(2, '0')}`;
}
