import { describe, expect, it } from 'vitest';
import type { RoomState } from '@/games/core/types';
import { shouldAcceptRoomSnapshot } from './roomSnapshot';

function room(revision: number, matchId = 'match'): RoomState {
  return { id: 'room', host_id: 'host', game_type: 'pinch-hint', status: 'playing', players: [], game_state: { game: 'pinch-hint', version: 1, matchId, stateRevision: revision }, created_at: '' };
}

describe('room snapshot ordering', () => {
  it('ignores an older Pinch Hint revision from the same match', () => {
    expect(shouldAcceptRoomSnapshot(room(4), room(3))).toBe(false);
    expect(shouldAcceptRoomSnapshot(room(4), room(4))).toBe(true);
    expect(shouldAcceptRoomSnapshot(room(4), room(5))).toBe(true);
  });

  it('accepts a new match or a lobby transition', () => {
    expect(shouldAcceptRoomSnapshot(room(4), room(0, 'new-match'))).toBe(true);
    expect(shouldAcceptRoomSnapshot(room(4), { ...room(0), status: 'waiting', game_state: {} })).toBe(true);
  });
});
