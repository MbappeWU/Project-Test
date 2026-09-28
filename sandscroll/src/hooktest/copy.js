import { REEL_COPY } from '../reels/copy.js';

// TikTok copy for the hook-test reels, in batch 2's structure: an English caption (150
// characters at most, always disclosing that the art is made with code), its Chinese meaning
// for review, and hashtags. The two remakes keep batch 2's copy word for word, so the opening
// is the only thing that differs from R01 and R02. The guessing reel's tags do not give its
// answer away.
const DISCLOSE_EN = 'Digital sand art, made with code.';
const DISCLOSE_CN = '数字沙画，由代码生成。';

export const HOOKTEST_COPY = {
  hotwater: REEL_COPY.hotwater,
  lantern: REEL_COPY.lantern,
  tea: {
    caption_en: `Chinamaxxing, tea edition 🍵 Give the cup one stir and a leaf turns into a koi. ${DISCLOSE_EN}`,
    caption_zh: `Chinamaxxing 喝茶篇🍵 轻轻一搅，一片茶叶变成一条锦鲤。${DISCLOSE_CN}`,
    hashtags: ['chinamaxxing', 'chinesetea', 'tea', 'koi', 'sandart', 'satisfying', 'chineseart', 'digitalart'],
  },
  dumpling: {
    caption_en: `Dumpling → goldfish 🥟🐠 Goldfish dumplings are a real dim sum shape. ${DISCLOSE_EN}`,
    caption_zh: `饺子变金鱼🥟🐠 金鱼饺是真实存在的点心造型。${DISCLOSE_CN}`,
    hashtags: ['chinamaxxing', 'dumplings', 'dimsum', 'goldfish', 'chinesefood', 'sandart', 'satisfying', 'digitalart'],
  },
  chopsticks: {
    caption_en: `Two chopsticks, one crane 🥢 Etiquette tip: never stand them upright in your rice. ${DISCLOSE_EN}`,
    caption_zh: `两根筷子，一只仙鹤🥢 餐桌小知识：筷子不要竖插在米饭里。${DISCLOSE_CN}`,
    hashtags: ['chinamaxxing', 'chopsticks', 'crane', 'chineseculture', 'sandart', 'satisfying', 'chineseart', 'digitalart'],
  },
  kite: {
    caption_en: `Guess what this kite becomes before the end 🪁 Comment your guess! ${DISCLOSE_EN}`,
    caption_zh: `看到最后之前，猜猜这只风筝会变成什么🪁 把答案写在评论区！${DISCLOSE_CN}`,
    hashtags: ['guessthedrawing', 'kite', 'doubleninthfestival', 'chinamaxxing', 'sandart', 'satisfying', 'chineseart', 'digitalart'],
  },
};
