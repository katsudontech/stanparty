export type PlayableGameId = 'fake-artist' | 'coyote' | 'ito';

export interface GameCatalogEntry {
  id: PlayableGameId;
  name: string;
  shortName: string;
  catchphrase: string;
  summary: string;
  description: string[];
  players: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  difficulty: string;
  mood: string;
  accent: string;
  softColor: string;
  funPoints: string[];
  goodFor: string[];
  steps: { title: string; body: string }[];
  tips: string[];
}

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  {
    id: 'fake-artist',
    name: 'エセ芸術家 ニューヨークへ行く',
    shortName: 'エセ芸術家',
    catchphrase: '一筆ずつ描いて、知らないふりを見破れ。',
    summary: 'みんなで1枚の絵を描きながら、お題を知らない「エセ芸術家」を探す正体隠匿ゲーム。',
    description: [
      '本物の芸術家は同じお題を知っていますが、エセ芸術家だけはお題を知りません。順番に一筆ずつ描き、絵を完成させながら、誰の線が怪しいかを観察します。',
      '本物は分かりやすすぎる絵を描くとお題がばれ、曖昧すぎると自分が疑われます。短い一筆に性格と駆け引きが出るゲームです。',
    ],
    players: '3〜10人',
    minPlayers: 3,
    maxPlayers: 10,
    duration: '約15分',
    difficulty: 'かんたん',
    mood: '推理・お絵描き',
    accent: '#e85d3f',
    softColor: '#f6d7c8',
    funPoints: [
      '上手な絵より「怪しくない一筆」が大事',
      '全員の線を見返すと急に犯人らしさが見えてくる',
      '見破られても、お題を当てれば逆転できる',
    ],
    goodFor: ['絵の上手さに関係なく遊びたい', '会話と推理の両方を楽しみたい', '3人以上で盛り上がりたい'],
    steps: [
      { title: '役割を確認', body: '1人がエセ芸術家になります。本物の芸術家だけがお題を確認します。' },
      { title: '一筆ずつ描く', body: '順番に一筆だけ描きます。お題を言葉で伝えてはいけません。' },
      { title: '怪しい人へ投票', body: '決められたラウンドが終わったら、エセ芸術家だと思う人へ投票します。' },
      { title: '最後の逆転', body: '見破られたエセ芸術家がお題を当てると、エセ芸術家の逆転勝利です。' },
    ],
    tips: ['本物は核心を描きすぎない', '前の人の線に自然につなげる', '描く順番と迷った時間も観察する'],
  },
  {
    id: 'coyote',
    name: 'Coyote Online Forehead',
    shortName: 'Coyote',
    catchphrase: '見えない自分の数字を、みんなの顔から読み切れ。',
    summary: 'スマホをおでこに掲げ、ほかの人のカードだけを見て場の合計を予想する度胸試し。',
    description: [
      '自分のカードだけが見えない状態で、全員の数字の合計を予想します。前の人より大きな数字を宣言するか、「それは大きすぎる」と思った瞬間にコヨーテを宣言します。',
      '数字だけでなく、ほかの人の表情や宣言の強さも大切な手がかり。スマホをおでこに掲げる姿まで含めて盛り上がります。',
    ],
    players: '2〜10人',
    minPlayers: 2,
    maxPlayers: 10,
    duration: '約10分',
    difficulty: 'ふつう',
    mood: '駆け引き・度胸',
    accent: '#d79a24',
    softColor: '#f2dfa8',
    funPoints: [
      '自分だけが知らない数字にドキドキする',
      '強気な宣言と表情の読み合いが生まれる',
      '特殊カードで予想外の合計になる',
    ],
    goodFor: ['短時間で勝負したい', 'ブラフや読み合いが好き', '立ったままでも遊びたい'],
    steps: [
      { title: 'スマホを掲げる', body: 'カウントダウン後、画面をほかの人へ見せるようにおでこへ掲げます。' },
      { title: '合計を予想', body: 'ほかの人のカードを見て、場の合計を予想します。自分の数字は見ないでください。' },
      { title: '数字を上げる', body: '順番に、直前より大きい合計値を宣言していきます。' },
      { title: 'コヨーテを宣言', body: '直前の予想が実際の合計を超えたと思ったら、画面をダブルタップします。' },
      { title: '勝敗を判定', body: '全カードを公開して合計を確認。外した人はライフを1つ失います。' },
    ],
    tips: ['見えている数字を単純に足すところから始める', '特殊カードの可能性を忘れない', '相手が急に弱気になった瞬間を見逃さない'],
  },
  {
    id: 'ito',
    name: 'ito クモノイト2.0',
    shortName: 'ito',
    catchphrase: '数字を言わずに、気持ちのものさしを合わせよう。',
    summary: '1〜100の秘密の数字を言葉でたとえ、会話だけで小さい順に並べる協力ゲーム。',
    description: [
      'それぞれが持つ1〜100の数字を、お題に沿った言葉で表現します。数字そのものは言わず、全員で相談しながらカードを小さい順に並べます。',
      '「強い動物」や「テンションが上がること」など、答えに正解がないお題だからこそ価値観の違いが見えてきます。成功しても失敗しても会話が残るゲームです。',
    ],
    players: '2〜14人',
    minPlayers: 2,
    maxPlayers: 14,
    duration: '約10分',
    difficulty: 'かんたん',
    mood: '協力・価値観',
    accent: '#3978a8',
    softColor: '#c8e1e7',
    funPoints: [
      '同じ言葉でも人によって数字の感覚が違う',
      'うまく並んだ瞬間の一体感が気持ちいい',
      '自然にお互いの価値観を知れる',
    ],
    goodFor: ['初対面でも会話を始めたい', '勝ち負けより協力を楽しみたい', '2人から大人数まで遊びたい'],
    steps: [
      { title: 'お題を選ぶ', body: 'ランダムなお題を引くか、ホストが自由にお題を入力します。' },
      { title: '秘密の数字を確認', body: '自分だけに見える1〜100の数字を確認します。' },
      { title: '言葉でたとえる', body: '数字を直接言わず、お題に沿った言葉をヒントとして入力します。' },
      { title: 'みんなで並べる', body: 'ヒントを手がかりに相談し、カードを小さいと思う順に移動します。' },
      { title: '答え合わせ', body: '準備ができたらカードを順番に公開。すべて昇順なら成功です。' },
    ],
    tips: ['両端の1と100を先にイメージする', '似たヒントは具体的な場面を聞いて比べる', '自分の感覚が普通だと決めつけない'],
  },
] as const;

export function getGameById(id: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((game) => game.id === id);
}

export function getGamePlayerCountError(gameId: string, playerCount: number): string | null {
  const game = getGameById(gameId);

  if (!game) {
    return '選択したゲームは現在プレイできません';
  }

  if (playerCount < game.minPlayers) {
    const missingPlayerCount = game.minPlayers - playerCount;
    return `${game.shortName}は${game.minPlayers}人以上で遊べます。あと${missingPlayerCount}人必要です`;
  }

  if (playerCount > game.maxPlayers) {
    return `${game.shortName}は${game.maxPlayers}人までで遊べます`;
  }

  return null;
}
