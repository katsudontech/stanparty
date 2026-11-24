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

describe('aiue snapshot ordering across results and reconnect', () => {
  const aiue = (revision: number, status: RoomState['status'] = 'playing'): RoomState => ({ ...room(0), game_type: 'aiue-battle', status, game_state: { game: 'aiue-battle', matchId: 'match', revision } });
  it('rejects old play after result and accepts current result or lobby reset', () => {
    expect(shouldAcceptRoomSnapshot(aiue(7, 'finished'), aiue(6))).toBe(false);
    expect(shouldAcceptRoomSnapshot(aiue(6), aiue(7, 'finished'))).toBe(true);
    expect(shouldAcceptRoomSnapshot(aiue(7, 'finished'), aiue(7, 'finished'))).toBe(true);
    expect(shouldAcceptRoomSnapshot(aiue(7, 'finished'), { ...aiue(0, 'waiting'), game_state: {} })).toBe(true);
  });
});

describe('shittakaburi snapshot ordering across results and reconnect', () => {
  const snapshot = (revision: number, status: RoomState['status'] = 'playing'): RoomState => ({ ...room(0), game_type: 'shittakaburi-show', status, game_state: { game: 'shittakaburi-show', matchId: 'match', revision } });
  it('rejects stale updates, accepts results, a new match and lobby reset', () => {
    expect(shouldAcceptRoomSnapshot(snapshot(7, 'finished'), snapshot(6))).toBe(false);
    expect(shouldAcceptRoomSnapshot(snapshot(6), snapshot(7, 'finished'))).toBe(true);
    expect(shouldAcceptRoomSnapshot(snapshot(7, 'finished'), snapshot(7, 'finished'))).toBe(true);
    expect(shouldAcceptRoomSnapshot(snapshot(7, 'finished'), { ...snapshot(0, 'waiting'), game_state: {} })).toBe(true);
    expect(shouldAcceptRoomSnapshot(snapshot(7, 'finished'), { ...snapshot(0), game_state: { game: 'shittakaburi-show', matchId: 'new', revision: 0 } })).toBe(true);
  });
});
