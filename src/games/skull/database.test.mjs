import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ids = Array.from({ length: 7 }, (_, index) => `00000000-0000-4000-8000-00000000000${index + 1}`);
const [host, guest, third, outsider] = ids;
const db = new PGlite();
const players = ids.slice(0, 3).map(userId => ({ userId }));
const match = 'first-match';
const initial = (matchId = match) => ({
  game: 'skull', matchId, phase: 'opening', revision: 0, processedActions: [],
  seats: ids.slice(0, 3).map(id => ({ id, discs: ['flower', 'flower', 'flower', 'skull'], stack: [] })),
});
const visible = (matchId = match, revision = 0, phase = 'opening') => ({
  game: 'skull', matchId, phase, revision,
  seats: ids.slice(0, 3).map(id => ({ id, remaining: 4, stack: [] })),
});

async function actor(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${role}`);
}

async function newRoom(count = 3) {
  await db.exec('reset role');
  const roster = ids.slice(0, count).map(userId => ({ userId }));
  const { rows } = await db.query("insert into public.rooms(host_id, game_type, players) values ($1, 'skull', $2) returning id",
    [host, JSON.stringify(roster)]);
  return rows[0].id;
}

const room = async id => (await db.query('select * from public.rooms where id = $1', [id])).rows[0];
const start = id => db.query("update public.rooms set status = 'playing' where id = $1", [id]);
const read = async (id, user) => (await db.query('select public.skull_read_state($1, $2) as value', [id, user])).rows[0].value;
const init = async (id, epoch, matchId = match) => (await db.query(
  'select public.skull_commit_initial($1,$2,$3,$4,$5,$6) as value',
  [id, host, epoch, JSON.stringify(players), JSON.stringify(initial(matchId)), JSON.stringify(visible(matchId))],
)).rows[0].value;

async function commit(id, user, action, expectedRevision, phase = 'opening', matchId = match) {
  const next = {
    ...initial(matchId), revision: expectedRevision + 1, phase,
    processedActions: [`${host}:action-one`, `${user}:${action}`],
  };
  return (await db.query('select public.skull_commit_action($1,$2,$3,$4,$5,$6,$7) as value', [
    id, user, matchId, expectedRevision, action, JSON.stringify(next), JSON.stringify(visible(matchId, next.revision, phase)),
  ])).rows[0].value;
}

beforeAll(async () => {
  await db.exec(`
    create role service_role; create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table public.rooms (
      id uuid primary key default gen_random_uuid(), host_id uuid not null, game_type text not null,
      status text not null default 'waiting', players jsonb not null, game_state jsonb default '{}'
    );
    grant select, insert, update on public.rooms to authenticated, anon, service_role;
  `);
  await db.exec(await readFile(new URL('../../../supabase/migrations/20261126000000_add_skull.sql', import.meta.url), 'utf8'));
}, 30000);

afterAll(async () => { await db.close(); });

describe('skull database authority', () => {
  it('enforces the lobby start and inclusive player count', async () => {
    for (const count of [2, 3, 6, 7]) {
      const id = await newRoom(count);
      await actor(host);
      if (count >= 3 && count <= 6) await start(id);
      else await assert.rejects(start(id), /3〜6人/);
    }
    const id = await newRoom();
    await actor(guest);
    await assert.rejects(start(id), /ロビーから/);
    await actor(host);
    await assert.rejects(db.query("update public.rooms set status = 'finished' where id = $1", [id]), /ロビーから/);
    await assert.rejects(db.query("insert into public.rooms(host_id,game_type,status,players) values ($1,'skull','playing',$2)",
      [host, JSON.stringify(players)]), /ロビーから/);
  });

  it('keeps the private row and all gameplay RPCs away from host, members and anonymous roles', async () => {
    const id = await newRoom();
    await actor(host);
    await start(id);
    await actor(host, 'service_role');
    assert.deepEqual(await init(id, 0), initial());
    assert.deepEqual(await init(id, 0, 'racing-match'), initial());
    await assert.rejects(read(id, outsider), /membership/);
    for (const [user, role] of [[host, 'authenticated'], [guest, 'authenticated'], ['', 'anon']]) {
      await actor(user, role);
      assert.deepEqual((await room(id)).game_state, visible());
      await assert.rejects(db.query('select * from private.skull_state'), /permission denied/);
      await assert.rejects(read(id, host), /permission denied/);
      await assert.rejects(init(id, 0), /permission denied/);
      await assert.rejects(commit(id, host, 'action-one', 0), /permission denied/);
      await assert.rejects(db.query("update public.rooms set game_state = '{\"injected\":true}' where id = $1", [id]), /サーバー処理/);
      await assert.rejects(db.query("update public.rooms set status = 'finished' where id = $1", [id]), /サーバー処理/);
    }
    await actor(guest);
    await assert.rejects(db.query("update public.rooms set status = 'waiting', game_state = '{}' where id = $1", [id]), /サーバー処理/);
    await actor(host);
    await assert.rejects(db.query('update public.rooms set players = $2 where id = $1',
      [id, JSON.stringify([{ userId: host }, { userId: third }, { userId: guest }])]), /座席順/);
    await assert.rejects(db.query("update public.rooms set game_type = 'ito' where id = $1", [id]), /変更できません/);
    await assert.rejects(db.query('update public.rooms set skull_epoch = 99 where id = $1', [id]), /世代/);
  });

  it('applies one revision per action and cannot replay an old match or epoch after reset', async () => {
    const id = await newRoom();
    await actor(host);
    await start(id);
    await actor(host, 'service_role');
    await init(id, 0);
    const first = await commit(id, host, 'action-one', 0);
    assert.equal(first.revision, 1);
    assert.deepEqual(await commit(id, host, 'action-one', 0), first);
    await assert.rejects(commit(id, guest, 'action-one', 0), /stale revision/);
    const end = await commit(id, guest, 'action-one', 1, 'finished');
    assert.equal(end.revision, 2);
    assert.deepEqual(await commit(id, guest, 'action-one', 1), end);
    await assert.rejects(commit(id, host, 'action-two', 2), /game is finished/);
    assert.equal((await room(id)).status, 'finished');
    assert.deepEqual((await room(id)).game_state, visible(match, 2, 'finished'));

    await actor(host);
    await db.query("update public.rooms set status = 'waiting', game_state = '{}' where id = $1", [id]);
    assert.equal(Number((await room(id)).skull_epoch), 1);
    assert.deepEqual((await room(id)).game_state, {});
    await start(id);
    await actor(host, 'service_role');
    assert.equal(await read(id, host), null);
    await assert.rejects(init(id, 0), /stale room start/);
    await init(id, 1, 'second-match');
    await assert.rejects(commit(id, guest, 'action-one', 1), /stale match/);
  });
});
