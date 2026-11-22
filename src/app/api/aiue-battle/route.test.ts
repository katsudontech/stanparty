import { createGameState } from '@/games/aiue-battle/rules';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { POST } from './route';

const roomId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const request = (body: unknown, authorization = 'Bearer token') => new Request('https://stanparty.example/api/aiue-battle', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/aiue-battle', () => {
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
    expect((await POST(new Request('https://stanparty.example/api/aiue-battle', { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, body: 'null' }))).status).toBe(400);
    expect((await POST(request({ roomId: 'bad', action: 'attack' }))).status).toBe(400);
  });

  it('requires CAS metadata for every mutating action', async () => {
    expect((await POST(request({ roomId, action: 'attack', value: 'あ' }))).status).toBe(400);
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
    game.secrets[actorId] = ['あ', 'い', '×', '×', '×', '×', '×'];
    game.secrets[host] = ['か', 'き', 'く', '×', '×', '×', '×'];
    room = { id: roomId, host_id: host, game_type: 'aiue-battle', status: 'playing', players: game.turnOrder.map(userId => ({ userId })), game_state: {}, aiue_battle_epoch: 0 };
    mocks.getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    const query = { select: () => query, eq: () => query, single: async () => ({ data: room, error: null }) };
    rpc.mockImplementation(async (name: string) => name === 'aiue_battle_read_state' ? { data: game, error: null } : { data: null, error: null });
    mocks.createClient.mockImplementation((_url: string, key: string) => key === 'anon-key' ? { auth: { getUser: mocks.getUser } } : { from: () => query, rpc });
  });

  it('rejects nonmembers before reading secret state', async () => {
    room.players = [{ userId: host }];
    expect((await POST(request({ roomId, action: 'snapshot' }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns only the caller secret cells and allows reconnect to finished results', async () => {
    room.status = 'finished'; game.phase = 'finished';
    const response = await POST(request({ roomId, action: 'snapshot' }));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.myCells).toEqual(game.secrets[actorId] ?? null);
    expect(data).not.toHaveProperty('secrets');
    expect(data.players[host].cells).toHaveLength(7);
    expect(data.players[host].cells).not.toContain('×');
    expect(data.players[host]).not.toHaveProperty('word');
    expect(data).not.toHaveProperty('processedActionIds');
  });

  it('rejects guest initialization and stale metadata before committing', async () => {
    expect((await POST(request({ roomId, action: 'initialize' }))).status).toBe(403);
    const base = { roomId, action: 'attack', value: 'あ', actionId: 'unique-action', matchId: 'old-match', expectedRevision: 0 };
    expect((await POST(request(base))).status).toBe(409);
    expect((await POST(request({ ...base, matchId: game.matchId, expectedRevision: 1 }))).status).toBe(409);
    expect(rpc.mock.calls.every(([name]) => name === 'aiue_battle_read_state')).toBe(true);
  });

  it('rejects an action by the wrong player without writing state', async () => {
    game.phase = 'playing';
    game.secrets[roomId] = ['さ','し','×','×','×','×','×'];
    game.currentPlayerIndex = 1;
    const response = await POST(request({ roomId, action: 'attack', value: 'あ', actionId: 'unique-action', matchId: game.matchId, expectedRevision: 0 }));
    expect(response.status).toBe(400);
    expect(rpc.mock.calls.every(([name]) => name === 'aiue_battle_read_state')).toBe(true);
  });

  it('rejects postgame actions but accepts an already committed replay', async () => {
    room.status = 'finished'; game.phase = 'finished'; game.processedActionIds = ['saved-action'];
    const base = { roomId, action: 'attack', value: 'あ', matchId: game.matchId, expectedRevision: 0 };
    expect((await POST(request({ ...base, actionId: 'new-action' }))).status).toBe(409);
    expect((await POST(request({ ...base, actionId: 'saved-action' }))).status).toBe(200);
  });
});

describe('successful authoritative API phase flow', () => {
  it('commits host theme, concurrent words with stale retry, attack and duplicate replay', async () => {
    vi.resetAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const guest = '00000000-0000-4000-8000-000000000003';
    let actor = actorId;
    let state = createGameState([actorId, guest], () => 0, 'flow-match');
    const room = { id: roomId, host_id: actorId, game_type: 'aiue-battle', status: 'playing', players: state.turnOrder.map(userId=>({userId})), game_state: {}, aiue_battle_epoch: 0 };
    const query = { select:()=>query, eq:()=>query, single:async()=>({data:room,error:null}) };
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      expect(args.p_actor_id).toBe(actor);
      if(name==='aiue_battle_read_state') return {data:state,error:null};
      if(name==='aiue_battle_commit_action') { state=args.p_state as typeof state; return {data:args.p_public_state,error:null}; }
      throw new Error('Unexpected RPC');
    });
    mocks.getUser.mockImplementation(async()=>({data:{user:{id:actor}},error:null}));
    mocks.createClient.mockImplementation((_url: string,key: string)=>key==='anon-key'?{auth:{getUser:mocks.getUser}}:{from:()=>query,rpc});
    const command=async(action:string,value:string,revision=state.revision,actionId='command-'+state.revision)=>POST(request({roomId,action,value,matchId:state.matchId,expectedRevision:revision,actionId,actorId:'forged'}));
    expect((await command('theme','動物')).status).toBe(200);
    expect(state.phase).toBe('words');
    const beforeWords=state.revision;
    expect((await command('word','ああ')).status).toBe(200);
    actor=guest;
    expect((await command('word','いい',beforeWords)).status).toBe(409);
    expect(state.players[guest].ready).toBe(false);
    expect((await command('word','いい')).status).toBe(200);
    expect(state.phase).toBe('playing');
    actor=actorId;
    const response=await command('attack','あ',state.revision,'attack-once');
    expect(response.status).toBe(200);
    const {data}=await response.json();
    expect(data.phase).toBe('finished');
    expect(data.winnerId).toBe(guest);
    expect(data).not.toHaveProperty('secrets');
    expect(data.players[guest].cells).toEqual(Array(7).fill(null));
    const revision=state.revision;
    room.status='finished';
    expect((await command('attack','あ',revision-1,'attack-once')).status).toBe(200);
    expect(state.revision).toBe(revision);
  });
});
