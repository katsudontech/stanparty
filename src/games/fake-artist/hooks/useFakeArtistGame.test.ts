import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoomState } from '@/games/core/types';
import { DEFAULT_FAKE_ARTIST_STATE, type FakeArtistGameState } from '../types';
import { useFakeArtistGame } from './useFakeArtistGame';

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: supabaseMocks.rpc,
    from: supabaseMocks.from,
  }),
}));

const players = [
  { userId: '00000000-0000-0000-0000-000000000001', name: 'Host', avatarUrl: '', isHost: true, color: '#f00', isOnline: true },
  { userId: '00000000-0000-0000-0000-000000000002', name: 'Artist', avatarUrl: '', isHost: false, color: '#0f0', isOnline: true },
  { userId: '00000000-0000-0000-0000-000000000003', name: 'Fake', avatarUrl: '', isHost: false, color: '#00f', isOnline: true },
];

function createRoom(gameState: FakeArtistGameState): RoomState {
  return {
    id: '10000000-0000-0000-0000-000000000001',
    host_id: players[0].userId,
    game_type: 'fake-artist',
    status: 'playing',
    players,
    game_state: gameState,
    created_at: '2026-08-27T00:00:00.000Z',
  };
}

describe('useFakeArtistGame action RPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.eq.mockResolvedValue({ error: null });
    supabaseMocks.update.mockReturnValue({ eq: supabaseMocks.eq });
    supabaseMocks.from.mockReturnValue({ update: supabaseMocks.update });
  });

  it('投票を専用RPCへ送る', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });
    const room = createRoom({ ...DEFAULT_FAKE_ARTIST_STATE, phase: 'voting' });

    await useFakeArtistGame(room).handleVote(players[1].userId);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('fake_artist_cast_vote', {
      p_room_id: room.id,
      p_voted_player_id: players[1].userId,
    });
  });

  it('投票RPCの失敗を呼び出し元へ返す', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: { message: 'vote rejected' } });
    const room = createRoom({ ...DEFAULT_FAKE_ARTIST_STATE, phase: 'voting' });

    await expect(useFakeArtistGame(room).handleVote(players[1].userId)).rejects.toThrow('vote rejected');
  });

  it('投票集計とゲームリセットを専用RPCへ送る', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });
    const votingRoom = createRoom({ ...DEFAULT_FAKE_ARTIST_STATE, phase: 'voting' });
    const resultRoom = createRoom({ ...DEFAULT_FAKE_ARTIST_STATE, phase: 'result', winner: 'artists' });

    await useFakeArtistGame(votingRoom).handleAllVoted();
    await useFakeArtistGame(resultRoom).handleResetGame();

    expect(supabaseMocks.rpc).toHaveBeenNthCalledWith(1, 'fake_artist_finalize_voting', {
      p_room_id: votingRoom.id,
    });
    expect(supabaseMocks.rpc).toHaveBeenNthCalledWith(2, 'fake_artist_reset_game', {
      p_room_id: resultRoom.id,
    });
  });

  it('Undoはクライアント側で別の状態更新を行わない', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });
    const drawingRoom = createRoom({ ...DEFAULT_FAKE_ARTIST_STATE, phase: 'drawing' });

    await useFakeArtistGame(drawingRoom).handleUndoStroke();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('undo_latest_stroke', {
      p_room_id: drawingRoom.id,
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('game_state更新エラーを握りつぶさない', async () => {
    supabaseMocks.eq.mockResolvedValue({ error: { message: 'update rejected' } });
    const room = createRoom(DEFAULT_FAKE_ARTIST_STATE);

    await expect(useFakeArtistGame(room).updateGameState({ theme: '猫' })).rejects.toThrow('update rejected');
  });
});
