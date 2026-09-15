export interface FakeArtistTopicCategory {
  name: string;
  starterExamples: readonly string[];
  challengeExamples: readonly string[];
}

/**
 * Candidates for the manual topic setting. The automatic mode has its own
 * built-in topic list; these examples are intentionally a little more
 * specific so a group can choose a difficulty that fits its members.
 */
export const FAKE_ARTIST_TOPIC_CATEGORIES: readonly FakeArtistTopicCategory[] = [
  {
    name: '動物',
    starterExamples: ['犬', '猫'],
    challengeExamples: ['雨宿りするカメ', '寝坊したペンギン', '水族館のイルカ'],
  },
  {
    name: '食べ物',
    starterExamples: ['りんご', 'ピザ'],
    challengeExamples: ['溶けかけのアイス', '具だくさんのおにぎり', '湯気の立つラーメン'],
  },
  {
    name: '乗り物',
    starterExamples: ['車', '飛行機'],
    challengeExamples: ['駅に入る新幹線', '荷物を運ぶトラック', '出発前のロケット'],
  },
  {
    name: '場所',
    starterExamples: ['公園', '学校'],
    challengeExamples: ['雨の日の公園', '本を探す図書館', '魚が泳ぐ水族館'],
  },
  {
    name: '職業',
    starterExamples: ['先生', '医者'],
    challengeExamples: ['虫眼鏡を持つ探偵', 'ケーキを作るシェフ', '手品をするマジシャン'],
  },
  {
    name: '日用品',
    starterExamples: ['傘', '時計'],
    challengeExamples: ['開いたままの傘', '充電中のスマートフォン', '音の鳴る目覚まし時計'],
  },
  {
    name: '自然',
    starterExamples: ['太陽', '虹'],
    challengeExamples: ['雲の間から出る虹', '夜空の流れ星', '雨上がりの水たまり'],
  },
  {
    name: '身につけるもの',
    starterExamples: ['帽子', '靴'],
    challengeExamples: ['風で飛びそうな帽子', '片方だけの手袋', '光るヘルメット'],
  },
  {
    name: '楽器',
    starterExamples: ['ピアノ', 'ギター'],
    challengeExamples: ['舞台のピアノ', 'ケースに入ったバイオリン', '息を吹き込むトランペット'],
  },
  {
    name: '文房具',
    starterExamples: ['鉛筆', 'ノート'],
    challengeExamples: ['削りたての鉛筆', 'ページいっぱいのノート', 'インクの出る万年筆'],
  },
  {
    name: '家具',
    starterExamples: ['机', '椅子'],
    challengeExamples: ['本が並ぶ本棚', 'クッションの積まれたソファ', 'カーテンの閉じた窓'],
  },
] as const;
