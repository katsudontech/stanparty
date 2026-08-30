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
  game_type: 'fake-artist' | 'werewolf' | 'coyote' | 'word-wolf' | 'ito' | 'ai-barenai' | 'ai-barenai-drawing' | 'blocks' | 'one-night-werewolf';
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  game_state: unknown;
  created_at: string;
}

export interface GameEvent<T = unknown> {
  id: string;
  room_id: string;
  event_type: string;
  payload: T;
  actor_id?: string | null;
  created_at: string;
}


// -----------------------------
// イベントペイロード（Event）
// -----------------------------
