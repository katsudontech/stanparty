export type PlayableGameId = 'fake-artist' | 'coyote' | 'ito' | 'ai-barenai' | 'ai-barenai-drawing' | 'pinch-hint' | 'carbonated-shake';

export interface GameSeoCopy {
  title: string;
  description: string;
  heading: string;
  intro: string;
  ctaLabel: string;
}

export interface GameCatalogEntry {
  id: PlayableGameId;
  name: string;
  seo: GameSeoCopy;
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
    seo: {
      title: 'エセ芸術家 Web版｜ブラウザで遊べるお絵描き推理ゲーム',
      description: '「エセ芸術家 ニューヨークへ行く」をスマホのブラウザで遊べます。3〜10人対応、登録やアプリは不要。1人だけお題を知らない状態で一筆ずつ描き、投票でエセ芸術家を探します。',
      heading: 'エセ芸術家（Web版）',
      intro: 'スマホのブラウザですぐに遊べます。アプリのインストールもアカウント登録もいりません。',
      ctaLabel: 'エセ芸術家',
    },
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
    seo: {
      title: 'コヨーテ Web版｜ブラウザで遊べるカードゲーム',
      description: 'カードゲーム「コヨーテ」をスマホのブラウザで遊べます。2〜10人対応、登録やアプリは不要。見えない自分のカードを読み合い、数字を宣言してコヨーテを狙います。',
      heading: 'コヨーテ（Web版）',
      intro: 'コヨーテはスマホのブラウザで遊べます。アプリのインストールやアカウント登録は不要です。',
      ctaLabel: 'コヨーテ',
    },
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
    seo: {
      title: 'ito Web版｜スマホ・ブラウザで友達と遊べる',
      description: 'カードゲーム「ito」をスマホのブラウザで遊べます。2〜14人対応、アカウント登録不要。数字を言葉にして、みんなで小さい順に並べよう。',
      heading: 'ito',
      intro: 'itoはスマホのブラウザで楽しめます。インストールもアカウント登録もなく、集まったらすぐ始められます。',
      ctaLabel: 'ito',
    },
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
    seo: {
      title: 'AIにバレるな！ Web版｜スマホ・ブラウザで友達と遊べる',
      description: '「AIにバレるな！」をスマホのブラウザで遊べます。2〜14人対応、アカウント登録不要。ヒントを出して、AIより先にお題を当てよう。',
      heading: 'AIにバレるな！',
      intro: 'スマホのブラウザだけで遊べる、AIとの読み合いゲームです。アプリもアカウント登録も必要ありません。',
      ctaLabel: 'AIにバレるな！',
    },
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
    seo: {
      title: 'AIにバレるな！お絵かき版｜Webで友達と遊べる',
      description: '「AIにバレるな！お絵かき版」をスマホのブラウザで遊べます。2〜14人対応、アカウント登録不要。絵を描いて、人間とAIの推理を楽しもう。',
      heading: 'AIにバレるな！お絵かき版',
      intro: 'お絵かき版もスマホのブラウザでプレイできます。面倒なインストールやアカウント登録なしで始められます。',
      ctaLabel: 'AIにバレるな！お絵かき版',
    },
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
  {
    id: 'pinch-hint', name: 'ピンチにひらめき！', shortName: 'ピンチにひらめき！',
    seo: {
      title: 'ピンチにひらめき！ Web版｜スマホ・ブラウザで友達と遊べる',
      description: '「ピンチにひらめき！」をスマホのブラウザで遊べます。2〜10人対応、アカウント登録不要。アイテムを使った解決策を発表して、みんなのアリを勝ち取ろう。',
      heading: 'ピンチにひらめき！',
      intro: 'ピンチにひらめき！はスマホのブラウザですぐ遊べます。アイテムを選び、順番に公開しながら解決策を発表します。',
      ctaLabel: 'ピンチにひらめき！',
    },
    catchphrase: 'ひらめきを順番に公開して、ピンチを切り抜けろ。',
    summary: '限られたアイテムでピンチの解決策を発表し、みんなでアリかナシかを決めるゲーム。',
    description: [
      '回答者は手札から指定されたアイテムを選び、使う順番を決めてから、ひとつずつ公開しながら解決策を説明します。',
      'ほかのプレイヤーは説明を聞いてアリかナシかを投票。アリが多ければポイントを獲得します。',
    ],
    players: '2〜10人', minPlayers: 2, maxPlayers: 10, duration: '約15分', difficulty: 'かんたん', mood: '発想・プレゼン',
    accent: '#e85d3f', softColor: '#f6d7c8',
    funPoints: ['公開のたびに解決策が広がる', '同じ手札でも発想の違いが出る', '短い説明でみんなを納得させる'],
    goodFor: ['会話で盛り上がりたい', '自由な発想を楽しみたい', '2人から遊びたい'],
    steps: [
      { title: 'ピンチを確認', body: '全員に今回のピンチと、使うアイテムの数が表示されます。' },
      { title: '手札を選ぶ', body: '回答者はアイテムを選び、使う順番を決めて回答を開始します。' },
      { title: 'ひとつずつ発表', body: '説明しながら画面をタップ。選んだアイテムが全員に公開されます。' },
      { title: 'アリかナシか投票', body: '回答者以外が投票し、アリが多ければ1ポイントです。' },
    ],
    tips: ['順番に意味が生まれるように話す', '意外なアイテムほど説明で輝かせる', '同数は失敗なので最後まで説得する'],
  },
  {
    id: 'carbonated-shake', name: '炭酸シェイク！', shortName: '炭酸シェイク！',
    seo: {
      title: '炭酸シェイク！ Web版｜スマホを振って遊ぶパーティーゲーム',
      description: '「炭酸シェイク！」をスマホのブラウザで遊べます。2〜14人対応、登録やアプリは不要。振るほど得点が伸びる炭酸を、吹き出さないように順番に振ろう。',
      heading: '炭酸シェイク！（Web版）',
      intro: 'スマホのブラウザだけで遊べる、振って盛り上がるチキンレースゲームです。',
      ctaLabel: '炭酸シェイク！',
    },
    catchphrase: '欲張って振るか、ここで止めるか。炭酸の限界を読み切れ。',
    summary: 'みんなで1本の炭酸を順番に振り、得点と吹き出しの恐怖を競うチキンレース。',
    description: [
      '自分のターンではHOLD TO SHAKEを押しながらスマホを振ります。振るほど得点は伸びますが、共通の炭酸値も増えていきます。',
      'ターンを終えた本人だけが、炭酸の危険度を一瞬だけ確認できます。どこまで振ったかを話すか、ブラフするかは自由です。',
    ],
    players: '2〜14人', minPlayers: 2, maxPlayers: 14, duration: '約10分', difficulty: 'かんたん', mood: '度胸・ブラフ',
    accent: '#e95735', softColor: '#ffe0a6',
    funPoints: ['振れば振るほど得点効率が上がる', '次の人へ秘密の危険度を残す', '吹き出した瞬間に全員で盛り上がる'],
    goodFor: ['スマホを使ったゲームで遊びたい', '度胸試しとブラフが好き', '2人からみんなで盛り上がりたい'],
    steps: [
      { title: '順番を確認', body: 'ゲーム開始時に決まったターン順で、同じジュースを回します。' },
      { title: '押しながら振る', body: 'HOLD TO SHAKEを押し続けてスマホを振ります。指を離すと得点が確定します。' },
      { title: '危険度を受け取る', body: '無事に止められたら、本人だけが炭酸の危険度を一瞬確認します。' },
      { title: '限界を超えたら終了', body: '炭酸が限界を超えた瞬間に吹き出し、そのプレイヤーは-999点になります。' },
    ],
    tips: ['少しだけ振って安全に止めるか、最大得点を狙うか決める', '前の人の話はヒントにもブラフにもなる', 'モーションセンサーが使えないときは代替操作を使う'],
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
