export type PlayableGameId = 'fake-artist' | 'coyote' | 'ito' | 'ai-barenai' | 'ai-barenai-drawing';

export interface GameCatalogEntry {
  id: PlayableGameId;
  name: string;
  officialPublisher?: string;
  officialProductUrl?: string;
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
    officialPublisher: 'オインクゲームズ',
    officialProductUrl: 'https://oinkgames.com/ja/games/analog/a-fake-artist-goes-to-new-york/',
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
    officialPublisher: 'ニューゲームズオーダー',
    officialProductUrl: 'https://www.newgamesorder.jp/games/coyote',
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
    officialPublisher: 'アークライトゲームズ',
    officialProductUrl: 'https://arclightgames.jp/product/705rainbow/',
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
  {
    id: 'ai-barenai', name: 'AIにバレるな！', shortName: 'AIにバレるな！',
    catchphrase: 'ヒントだけで、お題をAIに悟らせるな。',
    summary: 'みんなでヒントを出し、AIより先にお題を当てる協力型の読み合いゲーム。',
    description: ['1人だけがお題を知らない回答者。ほかの人はお題を直接言わずにヒントを出し、AIに悟られないようにします。', 'ヒントが揃ったら人間とAIがそれぞれ回答。AIが正解すれば、どれだけ惜しくてもAIの勝利です。'],
    players: '2〜14人', minPlayers: 2, maxPlayers: 14, duration: '約10分', difficulty: 'かんたん', mood: '協力・AI推理',
    accent: '#8b5cf6', softColor: '#e4d8fa',
    funPoints: ['AIに伝わるギリギリのヒントを考える', '回答者とヒント担当の役割がはっきりしている', 'AIが正解した瞬間の悔しさも盛り上がる'],
    goodFor: ['AIとの読み合いを遊びたい', '短い言葉で表現するのが好き', '2人から大人数まで遊びたい'],
    steps: [{title: '担当を決める', body: '1人が回答者になり、残りの人が順番にヒントを出します。'}, {title: 'ヒントを出す', body: 'お題を直接言わず、担当者だけが1つずつヒントを入力します。'}, {title: '回答する', body: 'ヒントが揃ったら、人間とAIがそれぞれお題を予想します。'}, {title: '結果を見る', body: 'AIが正解すればAIの勝利。AIが外して人間だけ正解なら人間の勝利です。'}],
    tips: ['固有名詞をそのまま書かない', 'AIにも人間にも伝わる具体性を狙う', 'ヒント担当の順番を活かして情報を積み上げる'],
  },
  {
    id: 'ai-barenai-drawing', name: 'AIにバレるな！お絵かき版', shortName: 'AIにバレるな！お絵かき版',
    catchphrase: '人間には伝わる、AIにはまだ伝わらない絵を描け。',
    summary: '1人が絵を描き、AIと人間の回答者が同時にお題を推測するゲーム。',
    description: ['描く人だけがお題を知り、Canvasに絵を描きます。ほかのプレイヤーは絵からお題を推測します。', '人間が正解する前にAIに見破られないよう、絵を足すタイミングを見極めましょう。'],
    players: '2〜14人', minPlayers: 2, maxPlayers: 14, duration: '約10分', difficulty: 'かんたん', mood: '協力・お絵かき',
    accent: '#ef6c4d', softColor: '#f8ded3',
    funPoints: ['人間には伝わるギリギリを狙う', '絵が変わるたびAIの推理も変わる', '描く人の判断が勝負を決める'],
    goodFor: ['絵の上手さに関係なく遊びたい', 'AIとの読み合いを遊びたい', '短時間で盛り上がりたい'],
    steps: [{title:'描く人を決める',body:'1人が描く人になり、お題を確認します。'}, {title:'絵を描く',body:'描く人がCanvasに自由に絵を描きます。'}, {title:'判定する',body:'描く人が好きなタイミングで判定します。'}, {title:'同時に回答',body:'人間とAIの回答を公開し、結果を確認します。'}],
    tips: ['最初は特徴を1つだけ描く', 'リセットで今の絵を描き直す', 'AIの確信度を見ながら描き足す'],
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
