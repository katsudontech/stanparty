import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const ids = [1, 2, 3, 4, 5].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const players = ids.slice(0, 4).map(userId => ({ userId }));
const state = {
  phase: 'voting', votes: {}, theme: '猫', winner: null,
  playerStates: Object.fromEntries(ids.slice(0, 4).map((id, i) => [id, { role: i === 2 ? 'fake_artist' : 'artist' }])),
};

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.rooms (
      id uuid primary key default gen_random_uuid(), host_id uuid not null,
      game_type text default 'fake-artist', status text default 'playing',
      players jsonb not null, game_state jsonb not null
    );
    create table public.game_events (
      id uuid primary key default gen_random_uuid(), room_id uuid references public.rooms(id),
      event_type text not null, payload jsonb not null, actor_id uuid,
      created_at timestamptz default now()
    );
    create function public.is_room_member(p_room_id uuid) returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.rooms r, jsonb_array_elements(r.players) p
        where r.id = p_room_id and p->>'userId' = auth.uid()::text)
    $$;
  `);
  for (const migration of ['20260827010000_fix_fake_artist_game_actions.sql', '20260917000000_persist_fake_artist_votes.sql']) {
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
}, 30000);
afterAll(() => db.close());

async function room(overrides = {}) {
  await db.exec('reset role');
  return (await db.query('insert into public.rooms(host_id, players, game_state) values ($1, $2, $3) returning id',
    [ids[0], JSON.stringify(players), JSON.stringify({ ...state, ...overrides })])).rows[0].id;
}
async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  await db.exec('set role authenticated');
}
async function castAll(roomId, targets) {
  for (let i = 0; i < targets.length; i++) {
    await actor(ids[i]);
    await db.query('select public.fake_artist_cast_vote($1, $2)', [roomId, ids[targets[i]]]);
  }
}
async function finalize(roomId) {
  await db.query('select public.fake_artist_finalize_voting($1)', [roomId]);
}
async function saved(roomId) {
  await db.exec('reset role');
  return (await db.query('select game_state from public.rooms where id = $1', [roomId])).rows[0].game_state;
}

describe('Fake Artist finalized votes', () => {
  it.each([
    ['caught', [2, 2, 0, 2], 'guessing', null],
    ['escaped', [1, 0, 0, 0], 'result', 'fake_artist'],
    ['fake artist tied for most', [2, 2, 0, 0], 'guessing', null],
    ['other players tied for most', [1, 0, 1, 0], 'result', 'fake_artist'],
  ])('persists every vote and preserves the outcome: %s', async (_, targets, phase, winner) => {
    const roomId = await room();
    await castAll(roomId, targets);
    expect((await saved(roomId)).votes).toEqual({});
    await actor(ids[0]);
    await finalize(roomId);
    expect(await saved(roomId)).toMatchObject({
      phase, winner, theme: '猫',
      votes: Object.fromEntries(targets.map((target, i) => [ids[i], ids[target]])),
    });
  });

  it('rejects incomplete voting and publishes no partial votes', async () => {
    const roomId = await room();
    await castAll(roomId, [2, 2, 0]);
    await actor(ids[0]);
    await expect(finalize(roomId)).rejects.toThrow('Not every player has voted');
    expect(await saved(roomId)).toMatchObject({ phase: 'voting', votes: {} });
  });

  it('allows only the host, with authentication and the voting phase', async () => {
    const roomId = await room();
    await castAll(roomId, [2, 2, 0, 2]);
    for (const id of [ids[1], ids[4]]) {
      await actor(id);
      await expect(finalize(roomId)).rejects.toThrow('Only the room host');
    }
    await actor(null);
    await expect(finalize(roomId)).rejects.toThrow('Authentication is required');
    await actor(ids[0]);
    await finalize(roomId);
    await expect(finalize(roomId)).rejects.toThrow('cannot be finalized now');
  });

  it('retains execute permissions', async () => {
    await db.exec('reset role');
    const result = await db.query(`select
      has_function_privilege('anon', 'public.fake_artist_finalize_voting(uuid)', 'execute') as anon,
      has_function_privilege('authenticated', 'public.fake_artist_finalize_voting(uuid)', 'execute') as authenticated`);
    expect(result.rows[0]).toEqual({ anon: false, authenticated: true });
  });

  it('saves the same first vote as the tally if legacy duplicates exist', async () => {
    const roomId = await room();
    const targets = [2, 2, 0, 2];
    await castAll(roomId, targets);
    await db.exec('reset role');
    await db.query(`insert into public.game_events(room_id, event_type, payload, actor_id, created_at)
      values ($1, 'vote', $2, $3, now() + interval '1 day')`, [roomId, JSON.stringify({ votedPlayerId: ids[1] }), ids[0]]);
    await actor(ids[0]);
    await finalize(roomId);
    expect(await saved(roomId)).toMatchObject({ phase: 'guessing', votes: Object.fromEntries(targets.map((target, i) => [ids[i], ids[target]])) });
  });

  it('reset clears finalized votes and all events before the next game', async () => {
    const roomId = await room();
    await castAll(roomId, [1, 0, 0, 0]);
    await actor(ids[0]);
    await finalize(roomId);
    await db.query('select public.fake_artist_reset_game($1)', [roomId]);
    expect(await saved(roomId)).toMatchObject({ phase: 'rule_setting', votes: {}, turnRevision: 0 });
    expect((await db.query('select * from public.game_events where room_id = $1', [roomId])).rows).toHaveLength(0);
  });
});
