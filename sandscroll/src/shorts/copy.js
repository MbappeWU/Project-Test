// Posting copy for each episode. 小红书: title ≤ 20 characters, short body, tags.
// TikTok: English caption and hashtags. Every post discloses that the art is made with code.
const DISCLOSE_CN = '（代码生成的数字沙画，没有一粒真沙）';
const DISCLOSE_EN = 'Digital sand art, made with code.';
const TAGS_CN = ['国风', '数字艺术', 'AI创作'];
const TAGS_EN = ['sandart', 'satisfying', 'digitalart'];

export const COPY = {
  moon: {
    xhs: {
      title: '🌕画一轮中秋月，送给想念的人',
      body: [
        '海上生明月，天涯共此时。——张九龄《望月怀远》',
        '一千多年前的一轮月亮，今晚我们还在一起看。',
        '中秋快乐，愿你想念的人，也正看着同一轮月亮。',
        '今年你和谁一起赏月？评论区说说👇',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['中秋节', '海上生明月', '古诗词', '治愈系', '解压视频', ...TAGS_CN],
    },
    tiktok: {
      caption: `A Mid-Autumn moon for someone you miss 🌕 "Over the sea a bright moon rises; far apart, we share this hour." (Zhang Jiuling, 8th c.) ${DISCLOSE_EN}`,
      tags: ['midautumnfestival', 'moon', 'chineseart', 'calligraphy', 'guzheng', 'relaxing', ...TAGS_EN],
    },
  },
  panda: {
    xhs: {
      title: '🐼熊猫教会我的事：咬定青山不放松',
      body: [
        '咬定青山不放松，立根原在破岩中。——郑燮《竹石》',
        '大熊猫一天要花十多个小时吃竹子，认准了就不松口🎋',
        '想做成一件事，大概也是这样：咬住，别放。',
        '你最近在“咬定”什么目标？',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['大熊猫', '竹石', '正能量', '治愈系', '解压视频', ...TAGS_CN],
    },
    tiktok: {
      caption: `Life advice from a panda: hold on and never let go 🐼🎋 Pandas spend 10+ hours a day eating bamboo. That's commitment. PS: giant pandas Ping Ping and Fu Shuang are coming to Zoo Atlanta! ${DISCLOSE_EN}`,
      tags: ['panda', 'giantpanda', 'zooatlanta', 'motivation', 'chineseart', ...TAGS_EN],
    },
  },
  greatwall: {
    xhs: {
      title: '🧱长城不是一天建成的',
      body: [
        '志合者，不以山海为远。——葛洪《抱朴子》',
        '一块砖一块砖，一段一段地连起来，才有了万里长城。',
        '想走得远，就找到同路的人，一起慢慢来。',
        '给正在坚持的你，也给一起坚持的朋友💪',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['长城', '正能量', '坚持', '古诗词', '治愈系', ...TAGS_CN],
    },
    tiktok: {
      caption: `The Great Wall wasn't built in a day 🧱 "For those who share a purpose, no mountain and no sea is too far." (Ge Hong, 4th c.) ${DISCLOSE_EN}`,
      tags: ['greatwall', 'motivation', 'chineseart', 'calligraphy', 'history', ...TAGS_EN],
    },
  },
  voyage: {
    xhs: {
      title: '⛵给正在努力的你：长风破浪会有时',
      body: [
        '长风破浪会有时，直挂云帆济沧海。——李白《行路难》',
        '写下这句诗时，李白正仕途失意，可他依然相信：总有乘风破浪的一天。',
        '把这张帆，送给正在熬夜、正在准备、正在努力的你⛵',
        '你在为什么梦想努力？评论区给自己打个气！',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['正能量', '李白', '励志', '古诗词', '行路难', ...TAGS_CN],
    },
    tiktok: {
      caption: `For everyone working toward a dream ⛵ "A day will come to ride the wind and cleave the waves." Li Bai wrote this in the 8th century, right after a big setback. ${DISCLOSE_EN}`,
      tags: ['motivation', 'dreams', 'sailing', 'chinesepoetry', 'libai', ...TAGS_EN],
    },
  },
  pinecrane: {
    xhs: {
      title: '🌙三十秒，给心放个假',
      body: [
        '明月松间照，清泉石上流。——王维《山居秋暝》',
        '听一会儿古琴，看月光落在松树上，泉水从石头上流过。',
        '累了就停一停，深呼吸，再出发。',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['治愈系', '解压视频', '助眠', '王维', '古琴', ...TAGS_CN],
    },
    tiktok: {
      caption: `Thirty seconds of calm 🌙 "The bright moon shines between the pines; a clear spring flows over the stones." (Wang Wei, 8th c.) Guqin and guzheng. ${DISCLOSE_EN}`,
      tags: ['relaxing', 'calm', 'asmr', 'guqin', 'chineseart', ...TAGS_EN],
    },
  },
  plum: {
    xhs: {
      title: '❄️凌寒独自开，送给熬过冬天的你',
      body: [
        '墙角数枝梅，凌寒独自开。——王安石《梅花》',
        '没有人看见的时候，梅花也照样开。',
        '如果你正在经历一个很冷的冬天，请相信：花会开，春天会来🌸',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['正能量', '梅花', '王安石', '治愈系', '古诗词', ...TAGS_CN],
    },
    tiktok: {
      caption: `For anyone getting through a hard winter ❄️🌸 "A few sprays of plum by the corner of the wall bloom alone, braving the cold." (Wang Anshi, 11th c.) ${DISCLOSE_EN}`,
      tags: ['hope', 'resilience', 'plumblossom', 'chinesepoetry', 'motivation', ...TAGS_EN],
    },
  },
  cranes: {
    xhs: {
      title: '🌉朋友不怕远：天涯若比邻',
      body: [
        '海内存知己，天涯若比邻。——王勃《送杜少府之任蜀州》',
        '真正的朋友，隔着山海也像住在隔壁。',
        '一群仙鹤搭成一座桥，一边是长城，一边是金门大桥。',
        '@那个离你很远、却一直在你身边的朋友👇',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['友谊', '王勃', '天涯若比邻', '古诗词', '治愈系', ...TAGS_CN],
    },
    tiktok: {
      caption: `True friends are never far apart 🌉 Cranes build a bridge from the Great Wall to the Golden Gate. "A true friend within the four seas makes the ends of the earth feel next door." (Wang Bo, 7th c.) Tag a friend who lives far away 💛 ${DISCLOSE_EN}`,
      tags: ['friendship', 'longdistance', 'greatwall', 'goldengate', 'chinesepoetry', ...TAGS_EN],
    },
  },
  vase: {
    xhs: {
      title: '🌸牡丹遇见玫瑰：美美与共',
      body: [
        '各美其美，美人之美，美美与共，天下大同。——费孝通',
        '牡丹有牡丹的雍容，玫瑰有玫瑰的热烈，插在同一只瓶里，一样好看。',
        '欣赏自己，也欣赏别人💐',
        DISCLOSE_CN,
      ].join('\n'),
      tags: ['美美与共', '费孝通', '牡丹', '玫瑰', '治愈系', ...TAGS_CN],
    },
    tiktok: {
      caption: `When a peony meets a rose 🌸🌹 The peony, beloved in China for centuries, and the rose, national flower of the United States, in one vase. "Cherish your own beauty, admire the beauty of others." (Fei Xiaotong) ${DISCLOSE_EN}`,
      tags: ['peony', 'rose', 'harmony', 'flowers', 'chineseart', ...TAGS_EN],
    },
  },
};
