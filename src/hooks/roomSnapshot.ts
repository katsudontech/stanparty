import type { RoomState } from '@/games/core/types';

/** Ignore an out-of-order Realtime payload from the same server-authoritative match. */
export function shouldAcceptRoomSnapshot(current: RoomState | null, next: RoomState | null): boolean {
  if (!current || !next || current.id !== next.id || !['pinch-hint', 'carbonated-shake'].includes(current.game_type) || current.game_type !== next.game_type) return true;
  if (current.status !== 'playing' || next.status !== 'playing') return true;
  const currentState = current.game_state as { matchId?: unknown; stateRevision?: unknown } | null;
  const nextState = next.game_state as { matchId?: unknown; stateRevision?: unknown } | null;
  if (typeof currentState?.matchId !== 'string' || typeof nextState?.matchId !== 'string' || currentState.matchId !== nextState.matchId) return true;
  if (typeof currentState.stateRevision !== 'number' || typeof nextState.stateRevision !== 'number') return true;
  return nextState.stateRevision >= currentState.stateRevision;
}
