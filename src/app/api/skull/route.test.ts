import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGameState, toPublicState, type GameState } from '@/games/skull/rules';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
import { POST } from './route';

const roomId = '00000000-0000-4000-8000-000000000001';
const matchId = '00000000-0000-4000-8000-000000000002';
const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 3}`);
const host = ids[0];
let state: GameState;
let epoch: number;
let writes: number;
let conflictCount: number;

function request(actor: string, body: Record<string, unknown>, auth = true) {
  return new Request('https://example.test/api/skull', {
    method: 'POST', headers: { authorization: auth ? `Bearer ${actor}` : '', 'content-type': 'application/json' },
    body: JSON.stringify({ roomId, ...body }),
  });
}

function command(actor: string, action: string, value?: string | number, extra: Record<string, unknown> = {}) {
  return POST(request(actor, {
    action, value, actionId: `action-${state.revision}`, matchId: state.matchId,
    expectedRevision: state.revision, round: state.round, phase: state.phase, ...extra,
  }));
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
  state = createGameState(ids, matchId, () => 0);
  epoch = 0;
  writes = 0;
  conflictCount = 0;

  const query = {
    select: () => query, eq: () => query, maybeSingle: async () => ({
      data: { id: roomId, host_id: host, game_type: 'skull', status: state.phase === 'finished' ? 'finished' : 'playing',
        players: ids.map(userId => ({ userId })), skull_epoch: epoch }, error: null,
    }),
  };

  mocks.createClient.mockImplementation((_url: string, key: string) => key === 'anon' ?
    { auth: { getUser: async (token: string) => ({ data: { user: token === 'invalid' ? null : { id: token } }, error: null }) } } :
    { from: () => query, rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'skull_read_state') return { data: structuredClone(state), error: null };
      if (name === 'skull_commit_initial') {
        if (args.p_expected_epoch !== epoch) return { data: null, error: { message: 'stale room start' } };
        expect(args.p_public_state).toEqual(toPublicState(args.p_state as GameState));
        return { data: state, error: null };
      }
      if (name === 'skull_commit_action') {
        if (args.p_match_id !== state.matchId) return { data: null, error: { message: 'stale match' } };
        const actionKey = `${args.p_actor_id}:${args.p_action_id}`;
        if (state.processedActions.includes(actionKey)) return { data: state, error: null };
        if (args.p_expected_revision !== state.revision) {
          conflictCount += 1;
          return { data: null, error: { message: 'stale revision' } };
        }
        state = args.p_state as GameState;
        expect(args.p_public_state).toEqual(toPublicState(state));
        writes += 1;
        return { data: state, error: null };
      }
      throw new Error('Unexpected RPC');
    } });
});

describe('skull API', () => {
  it('requires a valid session, membership, metadata and the host epoch to initialize', async () => {
    expect((await POST(request(host, { action: 'snapshot' }, false))).status).toBe(401);
    expect((await POST(request('invalid', { action: 'snapshot' }))).status).toBe(401);
    expect((await POST(request('outsider', { action: 'snapshot', actorId: host }))).status).toBe(403);
    expect((await POST(request(host, { action: 'place' }))).status).toBe(400);
    expect((await POST(request(ids[1], { action: 'initialize', epoch }))).status).toBe(403);
    expect((await POST(request(host, { action: 'initialize', epoch: -1 }))).status).toBe(409);
    const response = await POST(request(host, { action: 'initialize', epoch }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { data } = await response.json();
    expect(data.mine.hand).toHaveLength(4);
    expect(data.seats.some((seat: object) => 'discs' in seat)).toBe(false);
    expect(data).not.toHaveProperty('processedActions');
  });

  it('serializes concurrent initial placements with the same revision and isolates action IDs by actor', async () => {
    const responses = await Promise.all(ids.map((actor, index) => command(actor, 'place', index === 1 ? '4' : '1')));
    expect(responses.map(response => response.status)).toEqual(Array(6).fill(200));
    expect(writes).toBe(6);
    expect(conflictCount).toBeGreaterThan(0);
    expect(state).toMatchObject({ phase: 'placing', actorId: host, revision: 6 });
    const response = await POST(request(host, { action: 'snapshot' }));
    const { data } = await response.json();
    expect(data.mine.stack).toEqual(['flower']);
    expect(data.seats.map((seat: { stack: unknown[] }) => seat.stack)).toEqual(Array(6).fill([null]));
    expect((await command(host, 'place', '4', { actionId: 'action-0', phase: 'opening', expectedRevision: 0 })).status).toBe(200);
    expect(writes).toBe(6);
    expect((await command(host, 'place', '4', { phase: 'opening', expectedRevision: 0 })).status).toBe(409);
  });

  it('rejects stale revisions, rounds and matches for sequential actions and replays a successful response', async () => {
    for (const actor of ids) state = applyAction(state, actor, host, 'place', '1', 'setup-' + actor, () => 0);
    expect((await command(host, 'bid', 2, { expectedRevision: state.revision - 1 })).status).toBe(409);
    expect((await command(host, 'bid', 2, { round: 0 })).status).toBe(409);
    expect((await command(host, 'bid', 2, { matchId: roomId })).status).toBe(409);
    const revision = state.revision;
    expect((await command(host, 'bid', 2, { actionId: 'same-action' })).status).toBe(200);
    expect((await command(host, 'bid', 3, { actionId: 'same-action', phase: 'placing', expectedRevision: revision })).status).toBe(200);
    expect(writes).toBe(1);
    expect(state.bid?.count).toBe(2);
  });
});
