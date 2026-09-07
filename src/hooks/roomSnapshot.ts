import type { RoomState } from '@/games/core/types';

/** Ignore an out-of-order Realtime payload from the same Pinch Hint match. */
export function shouldAcceptRoomSnapshot(current: RoomState | null, next: RoomState | null): boolean {
  if (!current || !next || current.id !== next.id || current.game_type !== 'pinch-hint' || next.game_type !== 'pinch-hint') return true;
  if (current.status !== 'playing' || next.status !== 'playing') return true;
  const currentState = current.game_state as { matchId?: unknown; stateRevision?: unknown } | null;
  const nextState = next.game_state as { matchId?: unknown; stateRevision?: unknown } | null;
  if (typeof currentState?.matchId !== 'string' || typeof nextState?.matchId !== 'string' || currentState.matchId !== nextState.matchId) return true;
  if (typeof currentState.stateRevision !== 'number' || typeof nextState.stateRevision !== 'number') return true;
  return nextState.stateRevision >= currentState.stateRevision;
}

