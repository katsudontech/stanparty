import type { RoomState } from '@/games/core/types';

/** Ignore an out-of-order Realtime payload from the same server-authoritative match. */
export function shouldAcceptRoomSnapshot(current: RoomState | null, next: RoomState | null): boolean {
  if (!current || !next || current.id !== next.id || !['pinch-hint', 'carbonated-shake', 'aiue-battle', 'shittakaburi-show'].includes(current.game_type) || current.game_type !== next.game_type) return true;
  if (!['playing', 'finished'].includes(current.status) || !['playing', 'finished'].includes(next.status)) return true;
  const currentState = current.game_state as { matchId?: unknown; stateRevision?: unknown; revision?: unknown } | null;
  const nextState = next.game_state as { matchId?: unknown; stateRevision?: unknown; revision?: unknown } | null;
  if (typeof currentState?.matchId !== 'string' || typeof nextState?.matchId !== 'string' || currentState.matchId !== nextState.matchId) return true;
  if (['aiue-battle', 'shittakaburi-show'].includes(current.game_type)) return typeof currentState.revision !== 'number' || typeof nextState.revision !== 'number' || nextState.revision >= currentState.revision;
  if (typeof currentState.stateRevision !== 'number' || typeof nextState.stateRevision !== 'number') return true;
  return nextState.stateRevision >= currentState.stateRevision;
}
