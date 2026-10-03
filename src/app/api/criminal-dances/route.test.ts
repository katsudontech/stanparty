import { createGameState } from '@/games/criminal-dances/rules';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { POST } from './route';

const roomId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const request = (body: unknown, authorization = 'Bearer token') => new Request('https://stanparty.example/api/criminal-dances', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/criminal-dances', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    mocks.getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mocks.createClient.mockImplementation((_url: string, key: string) => key === 'anon-key' ? { auth: { getUser: mocks.getUser } } : {});
  });

  it('requires a bearer token before reading request state', async () => {
    expect((await POST(request({ roomId }, ''))).status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects non-object JSON and malformed rooms after authentication', async () => {
    expect((await POST(new Request('https://stanparty.example/api/criminal-dances', { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, body: 'null' }))).status).toBe(400);
    expect((await POST(request({ roomId: 'bad', action: 'play_card' }))).status).toBe(400);
  });

  it('requires CAS metadata for every mutating action', async () => {
    expect((await POST(request({ roomId, action: 'play_card', cardId: 'x' }))).status).toBe(400);
  });
});

describe('authenticated game boundary', () => {
  const host = '00000000-0000-4000-8000-000000000003';
  const rpc = vi.fn();
  let game: ReturnType<typeof createGameState>;
  let room: Record<string, unknown>;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    game = createGameState([actorId, host, roomId], () => .123, 'match-test');
    room = { id: roomId, host_id: host, game_type: 'criminal-dances', status: 'playing', players: game.turnOrder.map(userId => ({ userId })), game_state: {}, criminal_dances_epoch: 0 };
    mocks.getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    const query = { select: () => query, eq: () => query, single: async () => ({ data: room, error: null }) };
    rpc.mockImplementation(async (name: string) => name === 'criminal_dances_read_state' ? { data: game, error: null } : { data: null, error: null });
    mocks.createClient.mockImplementation((_url: string, key: string) => key === 'anon-key' ? { auth: { getUser: mocks.getUser } } : { from: () => query, rpc });
  });

  it('rejects nonmembers before reading secret state', async () => {
    room.players = [{ userId: host }];
    expect((await POST(request({ roomId, action: 'snapshot' }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns only the caller hand and allows reconnect to finished results', async () => {
    room.status = 'finished'; game.phase = 'finished';
    const response = await POST(request({ roomId, action: 'snapshot' }));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.myHand).toEqual(game.players[actorId].hand);
    expect(data.players[host]).not.toHaveProperty('hand');
    expect(data).not.toHaveProperty('processedActionIds');
  });

  it('rejects guest initialization and stale metadata before committing', async () => {
    expect((await POST(request({ roomId, action: 'initialize' }))).status).toBe(403);
    const base = { roomId, action: 'play_card', cardId: 'culprit-1', actionId: 'unique-action', matchId: 'old-match', expectedRevision: 0 };
    expect((await POST(request(base))).status).toBe(409);
    expect((await POST(request({ ...base, matchId: game.matchId, expectedRevision: 1 }))).status).toBe(409);
    expect(rpc.mock.calls.every(([name]) => name === 'criminal_dances_read_state')).toBe(true);
  });

  it('rejects an action by the wrong player without writing state', async () => {
    game.currentPlayerIndex = 1;
    const response = await POST(request({ roomId, action: 'play_card', cardId: game.players[actorId].hand[0].id, actionId: 'unique-action', matchId: game.matchId, expectedRevision: 0 }));
    expect(response.status).toBe(400);
    expect(rpc.mock.calls.every(([name]) => name === 'criminal_dances_read_state')).toBe(true);
  });

  it('rejects postgame actions but accepts an already committed replay', async () => {
    room.status = 'finished'; game.phase = 'finished'; game.processedActionIds = ['saved-action'];
    const base = { roomId, action: 'play_card', cardId: 'x', matchId: game.matchId, expectedRevision: 0 };
    expect((await POST(request({ ...base, actionId: 'new-action' }))).status).toBe(409);
    expect((await POST(request({ ...base, actionId: 'saved-action' }))).status).toBe(200);
  });
});
