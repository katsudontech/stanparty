// ポータル・ルーム共通の型定義
export interface Player {
  userId: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  color: string;
  isOnline: boolean;
}

export interface RoomState {
  id: string;
  host_id: string;
  game_type: 'fake-artist' | 'werewolf' | 'coyote';
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  game_state: any;
  created_at: string;
}

export interface GameEvent<T = any> {
  id: string;
  room_id: string;
  event_type: string;
  payload: T;
  created_at: string;
}


// -----------------------------
// イベントペイロード（Event）
// -----------------------------
