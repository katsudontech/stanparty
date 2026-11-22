import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ids = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
];
const db = new PGlite();
const roster = ids.map((userId, index) => ({ userId, name: `Player${index + 1}`, isHost: index === 0, color: '#ef4444', isOnline: true, avatarUrl: '' }));
const state = (revision, processedActionIds = []) => ({ game: 'aiue-battle', matchId: 'match-1', revision, phase: 'words', turnOrder: ids, currentPlayerIndex: 0, attackNumber: 1, players: Object.fromEntries(ids.map(id => [id, { cells: Array(7).fill(null), ready: false, eliminated: false }])), secrets: { [ids[0]]: ['あ','い','×','×','×','×','×'] }, processedActionIds, candidate: '動物', theme: '動物', usedKana: [], lastAttack: null, winnerId: null });
const publicState = (revision, processedActionIds = []) => { const { secrets, processedActionIds: hiddenIds, ...visible } = state(revision, processedActionIds); void secrets; void hiddenIds; return visible; };

async function actor(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${role}`);
}

beforeAll(async () => {
  await db.exec(`
    create role service_role; create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table public.rooms (id uuid primary key default gen_random_uuid(), host_id uuid not null, game_type text not null default 'fake-artist', status text not null default 'waiting', players jsonb not null default '[]', game_state jsonb default '{}', room_name text not null default 'test', is_public boolean default false, created_at timestamptz default now());
    grant select, update on public.rooms to authenticated; grant select, update on public.rooms to service_role;
  `);
  await db.exec(await readFile(new URL('../../../supabase/migrations/20261122000000_add_aiue_battle.sql', import.meta.url), 'utf8'));
  await db.query('insert into public.rooms(host_id, game_type, status, players) values($1, $2, $3, $4)', [ids[0], 'aiue-battle', 'playing', JSON.stringify(roster)]);
}, 30000);

afterAll(async () => { await db.close(); });

describe('aiue-battle PostgreSQL authority', () => {
  it('keeps private state inaccessible to authenticated clients', async () => {
    await actor(ids[0], 'service_role');
    const roomId = (await db.query('select id from public.rooms limit 1')).rows[0].id;
    await db.query('select public.aiue_battle_commit_initial($1,$2,$3,$4,$5,$6,$7)', [roomId, ids[0], 'match-1', 0, JSON.stringify(roster), JSON.stringify(state(0)), JSON.stringify(publicState(0))]);
    await actor(ids[1]);
    await assert.rejects(() => db.query('select * from private.aiue_battle_state'));
    await assert.rejects(() => db.query('select public.aiue_battle_read_state($1,$2)', [roomId, ids[1]]));
    await assert.rejects(() => db.query("update public.rooms set game_state='{}' where id=$1", [roomId]));
    await assert.rejects(() => db.query("update public.rooms set players=$2 where id=$1", [roomId, JSON.stringify([...roster].reverse())]));
  });

  it('accepts one CAS action, replays duplicates, and rejects stale revisions', async () => {
    const roomId = (await db.query('select id from public.rooms limit 1')).rows[0].id;
    const next = state(1, ['action-1']);
    const nextPublic = publicState(1, ['action-1']);
    await actor(ids[0], 'service_role');
    await db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', [roomId, ids[0], 'match-1', 0, 'action-1', JSON.stringify(next), JSON.stringify(nextPublic)]);
    await db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', [roomId, ids[0], 'match-1', 0, 'action-1', JSON.stringify(next), JSON.stringify(nextPublic)]);
    await assert.rejects(() => db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', [roomId, ids[0], 'match-1', 0, 'action-2', JSON.stringify(state(2, ['action-2'])), JSON.stringify(publicState(2, ['action-2']))]));
  });

  it('deletes private state and increments the room epoch on host reset', async () => {
    const roomId = (await db.query('select id from public.rooms limit 1')).rows[0].id;
    await actor(ids[0]);
    await db.query("update public.rooms set status='waiting', game_state='{}' where id=$1", [roomId]);
    await actor(ids[1], 'service_role');
    const row = await db.query('select aiue_battle_epoch from public.rooms where id=$1', [roomId]);
    assert.equal(Number(row.rows[0].aiue_battle_epoch), 1);
    assert.equal((await db.query('select count(*)::int as count from private.aiue_battle_state where room_id=$1', [roomId])).rows[0].count, 0);
  });
});

describe('reset and authority regressions', () => {
  it('rejects an old initializer after reset and allows a fresh match only once', async () => {
    await actor(ids[0]);
    const roomId = (await db.query('select id from public.rooms limit 1')).rows[0].id;
    await db.query("update public.rooms set status='playing' where id=$1", [roomId]);
    await actor(ids[0], 'service_role');
    const args = [roomId, ids[0], 'match-1', 0, JSON.stringify(roster), JSON.stringify(state(0)), JSON.stringify(publicState(0))];
    await assert.rejects(() => db.query('select public.aiue_battle_commit_initial($1,$2,$3,$4,$5,$6,$7)', args), /stale room start/);
    args[3] = 1;
    await db.query('select public.aiue_battle_commit_initial($1,$2,$3,$4,$5,$6,$7)', args);
    await db.query('select public.aiue_battle_commit_initial($1,$2,$3,$4,$5,$6,$7)', args);
    await assert.rejects(() => db.query('select public.aiue_battle_read_state($1,$2)', [roomId, '00000000-0000-4000-8000-000000000099']), /membership/);
    await actor(ids[1]);
    await assert.rejects(() => db.query("update public.rooms set status='waiting', game_state='{}' where id=$1", [roomId]));
    await assert.rejects(() => db.query('update public.rooms set aiue_battle_epoch=99 where id=$1', [roomId]));
    await assert.rejects(() => db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', [roomId, ids[1], 'match-1', 0, 'forged', JSON.stringify(state(1)), JSON.stringify(publicState(1))]));
  });

  it('rejects all new commits after finishing but permits saved replay', async () => {
    await actor(ids[0], 'service_role');
    const roomId = (await db.query('select id from public.rooms limit 1')).rows[0].id;
    const finished = { ...state(1, ['finished-action']), phase: 'finished' };
    const visible = { ...publicState(1), phase: 'finished' };
    const args = [roomId, ids[0], 'match-1', 0, 'finished-action', JSON.stringify(finished), JSON.stringify(visible)];
    await db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', args);
    await db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', args);
    args[3] = 1; args[4] = 'after-finish';
    await assert.rejects(() => db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', args), /finished/);
  });
});

describe('aiue host and player-count boundaries', () => {
  it('protects active words, turn, roster and game identifier from direct host writes', async () => {
    await actor(ids[0]);
    const roomId = (await db.query('select id from public.rooms limit 1')).rows[0].id;
    await assert.rejects(() => db.query("update public.rooms set game_state='{\"secrets\":{}}' where id=$1", [roomId]), /専用サーバー/);
    await assert.rejects(() => db.query("update public.rooms set game_type='ito' where id=$1", [roomId]));
    await assert.rejects(() => db.query('update public.rooms set players=$2 where id=$1', [roomId, JSON.stringify([...roster].reverse())]));
    await assert.rejects(() => db.query('select public.aiue_battle_commit_action($1,$2,$3,$4,$5,$6,$7)', [roomId, ids[0], 'match-1', 1, 'host-forgery', JSON.stringify(state(2)), JSON.stringify(publicState(2))]));
  });

  it('accepts 2 and 8-player starts, rejects 1 and 9, and never stores a secret in the room', async () => {
    await db.exec('reset role');
    for(const count of [1,2,8,9]) {
      const members=Array.from({length:count},(_,i)=>({...roster[0],userId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')}));
      const roomId=(await db.query("insert into public.rooms(host_id,game_type,players) values($1,'aiue-battle',$2) returning id", [ids[0],JSON.stringify(members)])).rows[0].id;
      await actor(ids[0]);
      const start=()=>db.query("update public.rooms set status='playing' where id=$1",[roomId]);
      if(count===1 || count===9) await assert.rejects(start,/2〜8人/); else await start();
      await db.exec('reset role');
      const row=(await db.query('select game_state from public.rooms where id=$1',[roomId])).rows[0];
      assert.deepEqual(row.game_state,{});
    }
  });
});
