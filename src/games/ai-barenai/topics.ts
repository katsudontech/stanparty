import 'server-only';

export interface AiBarenaiTopic {
  answer: string;
  aliases: string[];
}

/** Server-only presets. Add one object per topic; multiple aliases are supported. */
export const AI_BARENAI_TOPICS = [
  // Places and landmarks
  { answer: '富士山', aliases: ['ふじさん'] },
  { answer: '東京タワー', aliases: ['とうきょうタワー'] },
  { answer: '東京スカイツリー', aliases: ['スカイツリー'] },
  { answer: '大阪城', aliases: ['おおさか城'] },
  { answer: '北海道', aliases: ['ほっかいどう'] },
  { answer: '沖縄', aliases: ['おきなわ'] },
  { answer: '京都', aliases: ['きょうと'] },
  { answer: 'パリ', aliases: ['Paris'] },
  { answer: 'ニューヨーク', aliases: ['New York', 'NYC'] },
  { answer: '遊園地', aliases: ['テーマパーク'] },
  { answer: '公園', aliases: ['こうえん'] },
  { answer: '学校', aliases: ['がっこう'] },
  { answer: '病院', aliases: ['びょういん'] },
  { answer: 'コンビニ', aliases: ['コンビニエンスストア'] },
  { answer: 'ホテル', aliases: ['宿泊施設'] },

  // Food
  { answer: 'りんご', aliases: ['林檎', 'リンゴ'] },
  { answer: 'バナナ', aliases: ['banana'] },
  { answer: 'カレーライス', aliases: ['カレー'] },
  { answer: 'ラーメン', aliases: ['らーめん'] },
  { answer: 'おにぎり', aliases: ['おむすび'] },
  { answer: '寿司', aliases: ['すし'] },
  { answer: 'ハンバーガー', aliases: ['バーガー'] },
  { answer: 'ピザ', aliases: ['pizza'] },
  { answer: 'たい焼き', aliases: ['たいやき'] },
  { answer: 'プリン', aliases: ['ぷりん'] },
  { answer: 'ショートケーキ', aliases: ['苺のショートケーキ'] },
  { answer: 'たこ焼き', aliases: ['たこやき'] },

  // Animals
  { answer: '猫', aliases: ['ねこ', 'ネコ'] },
  { answer: '犬', aliases: ['いぬ', 'イヌ'] },
  { answer: 'ライオン', aliases: ['獅子'] },
  { answer: 'トラ', aliases: ['虎'] },
  { answer: '象', aliases: ['ぞう', 'ゾウ'] },
  { answer: 'キリン', aliases: ['麒麟'] },
  { answer: 'パンダ', aliases: ['ジャイアントパンダ'] },
  { answer: 'ペンギン', aliases: ['ぺんぎん'] },
  { answer: 'イルカ', aliases: ['海豚'] },
  { answer: 'クジラ', aliases: ['鯨'] },
  { answer: 'うさぎ', aliases: ['兎', 'ウサギ'] },
  { answer: 'カメ', aliases: ['亀'] },
  { answer: 'サル', aliases: ['猿'] },
  { answer: 'キツネ', aliases: ['狐'] },
  { answer: 'たぬき', aliases: ['狸'] },
  { answer: 'フクロウ', aliases: ['梟'] },
  { answer: 'ハチ', aliases: ['蜂'] },
  { answer: 'チョウ', aliases: ['蝶'] },
  { answer: 'カブトムシ', aliases: ['かぶと虫'] },

  // Characters
  { answer: 'ドラえもん', aliases: [] },
  { answer: 'ピカチュウ', aliases: ['ピカチュー', 'Pikachu'] },
  { answer: 'アンパンマン', aliases: ['あんぱんまん'] },
  { answer: 'マリオ', aliases: ['スーパーマリオ'] },
  { answer: 'モンキー・D・ルフィ', aliases: ['ルフィ'] },
  { answer: '孫悟空', aliases: ['悟空'] },
  { answer: '江戸川コナン', aliases: ['コナン', '名探偵コナン'] },
  { answer: 'ミッキーマウス', aliases: ['ミッキー'] },
  { answer: 'ハローキティ', aliases: ['キティちゃん', 'キティ'] },
  { answer: 'となりのトトロ', aliases: ['トトロ'] },

  // Activities and games
  { answer: 'サッカー', aliases: ['フットボール'] },
  { answer: '野球', aliases: ['ベースボール'] },
  { answer: 'バスケットボール', aliases: ['バスケ'] },
  { answer: 'テニス', aliases: ['tennis'] },
  { answer: '水泳', aliases: ['スイミング'] },
  { answer: '将棋', aliases: ['しょうぎ'] },
  { answer: 'トランプ', aliases: ['プレイングカード'] },
  { answer: 'かくれんぼ', aliases: ['隠れんぼ'] },

  // Objects and vehicles
  { answer: 'スマートフォン', aliases: ['スマホ'] },
  { answer: 'パソコン', aliases: ['PC', 'コンピューター'] },
  { answer: 'テレビ', aliases: ['TV'] },
  { answer: 'カメラ', aliases: ['写真機'] },
  { answer: '時計', aliases: ['とけい'] },
  { answer: '傘', aliases: ['かさ', 'アンブレラ'] },
  { answer: '靴', aliases: ['くつ'] },
  { answer: '帽子', aliases: ['ぼうし'] },
  { answer: '眼鏡', aliases: ['メガネ', 'めがね'] },
  { answer: '自転車', aliases: ['チャリ', 'バイシクル'] },
  { answer: '電車', aliases: ['列車'] },
  { answer: '飛行機', aliases: ['航空機'] },
  { answer: '船', aliases: ['ふね'] },
  { answer: '車', aliases: ['自動車', 'クルマ'] },
  { answer: 'ロボット', aliases: ['robot'] },
  { answer: '冷蔵庫', aliases: ['れいぞうこ'] },
  { answer: '電子レンジ', aliases: ['レンジ'] },
  { answer: '歯ブラシ', aliases: ['はブラシ'] },
  { answer: '鉛筆', aliases: ['えんぴつ'] },
  { answer: '消しゴム', aliases: ['けしごむ'] },
  { answer: '本', aliases: ['書籍', 'book'] },

  // Nature
  { answer: '月', aliases: ['つき', 'お月さま'] },
  { answer: '太陽', aliases: ['おひさま'] },
  { answer: '星', aliases: ['ほし'] },
  { answer: '虹', aliases: ['にじ'] },
  { answer: '雪だるま', aliases: ['ゆきだるま'] },
  { answer: '桜', aliases: ['さくら', 'サクラ'] },
  { answer: 'ひまわり', aliases: ['向日葵'] },
  { answer: '海', aliases: ['うみ'] },
  { answer: '山', aliases: ['やま'] },
  { answer: '川', aliases: ['かわ'] },
] satisfies readonly AiBarenaiTopic[];

export function pickAiBarenaiTopic(random: () => number = Math.random): AiBarenaiTopic {
  const normalizedRandom = Math.max(0, Math.min(0.999999, random()));
  return AI_BARENAI_TOPICS[Math.floor(normalizedRandom * AI_BARENAI_TOPICS.length)];
}
