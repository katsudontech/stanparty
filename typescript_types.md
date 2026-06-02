# TypeScript データ型定義（JSONBスキーマ設計）

データベースの `JSONB` カラムに保存するデータの厳密な型定義です。
ポータル側（共通）のデータと、各ゲーム側（固有）のデータを完全に分離する設計になっています。

---

## 1. ポータル・ルーム共通の型定義

全ゲームで共通して使用する純粋な「参加者情報」です。
`rooms` テーブルの `players` カラム（JSONBの配列）に保存されます。

```typescript
// プレイヤーの基本情報（どのゲームでも変わらない不変の情報）
interface Player {
  userId: string;       // ユーザーID (Supabase Auth)
  name: string;         // 表示名
  avatarUrl: string;    // アイコン画像URL
  isHost: boolean;      // 部屋のホストかどうか
  color: string;        // ロビーで選択した自分のテーマカラー
  isOnline: boolean;    // 現在オンラインかどうか
  // ※ ここには役職や手札などの「ゲーム固有のデータ」は一切含めません
}

// rooms テーブル全体の型イメージ
interface Room {
  id: string;
  host_id: string;
  game_type: 'fake-artist' | 'werewolf';
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];                // 上記の配列
  game_state: any;                  // 各ゲーム固有のState（下記参照）
  created_at: string;
}
```

---

## 2. エセ芸術家固有の型定義（State）

`rooms` テーブルの `game_state` カラム（JSONB）に保存する、エセ芸術家の進行状況です。

```typescript
// ゲームの進行フェーズ
type FakeArtistPhase = 
  | 'role_assignment' 
  | 'theme_selection' 
  | 'drawing'         
  | 'voting'          
  | 'guessing'        
  | 'result';         

// ★ プレイヤーごとの「エセ芸術家専用」のステータス
interface FakeArtistPlayerState {
  role: 'questioner' | 'artist' | 'fake_artist' | null; // 役職
  score: number; // 総合得点
}

// game_state の中身
interface FakeArtistGameState {
  phase: FakeArtistPhase;
  
  // ★ ユーザーIDをキーにして、各プレイヤーの役職などを管理する
  playerStates: Record<string, FakeArtistPlayerState>; 
  
  // お題情報
  themeGenre: string | null;  // ジャンル
  theme: string | null;       // お題
  
  // ターン管理
  currentTurnPlayerId: string | null; // 現在絵を描く人のID
  turnOrder: string[];                // ターンが回る順番（Player IDの配列）
  currentLap: number;                 // 現在何周目か（1 or 2）
  
  // 投票・結果管理
  votes: Record<string, string>;      // 誰が誰に投票したか
  fakeArtistGuess: string | null;     // エセ芸術家の回答
  winner: 'artists' | 'fake_artist' | null; 
}
```

---

## 3. アクションイベントの型定義（Event）

`game_events` テーブルの `payload` カラム（JSONB）に保存するアクションデータです。

```typescript
// game_events テーブル自体の型
interface GameEvent<T = any> {
  id: string;
  room_id: string;
  event_type: 'draw_line' | 'chat_message' | 'send_stamp';
  payload: T;
  created_at: string;
}

// -----------------------------
// payload の具体的な中身（event_type ごとに定義）
// -----------------------------

// 1. 線の描画イベント (event_type: 'draw_line')
interface Point {
  x: number;
  y: number;
}

interface DrawLinePayload {
  playerId: string;
  color: string;       // 線の色
  strokeWidth: number; // 線の太さ
  points: Point[];     // なぞった座標の配列
}

// 2. チャットイベント (event_type: 'chat_message')
interface ChatMessagePayload {
  senderId: string;
  message: string;
}
```
