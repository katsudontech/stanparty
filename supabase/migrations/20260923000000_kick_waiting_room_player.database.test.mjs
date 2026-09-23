import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const host = '00000000-0000-4000-8000-000000000001';
const guest = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create table public.rooms (
    id uuid primary key,
    host_id uuid not null,
    status text not null,
    players jsonb not null default '[]'::jsonb
  );
`);
await db.exec(await readFile(new URL('./20260923000000_kick_waiting_room_player.sql', import.meta.url), 'utf8'));

async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.exec('set role authenticated');
}

async function makeRoom(status = 'waiting') {
  await db.exec('reset role');
  const id = `00000000-0000-4000-8000-${String(Math.floor(Math.random() * 999999999999)).padStart(12, '0')}`;
  const players = JSON.stringify([
    { userId: host, name: 'Host', isHost: true },
    { userId: guest, name: 'Guest', isHost: false }
  ]);
  await db.query('insert into public.rooms(id, host_id, status, players) values($1, $2, $3, $4)', [id, host, status, players]);
  return id;
}

async function kick(roomId, userId) {
  return (await db.query('select public.kick_waiting_room_player($1, $2) result', [roomId, userId])).rows[0].result;
}

async function rejects(action) {
  await assert.rejects(action, (error) => ['P0001', '42501'].includes(error.code));
}

afterAll(async () => { await db.close(); });

describe('kick_waiting_room_player', () => {
  it('atomically removes a non-host player for the waiting room host', async () => {
    const roomId = await makeRoom();
    await actor(host);
    assert.equal(await kick(roomId, guest), true);
    await db.exec('reset role');
    const players = (await db.query('select players from public.rooms where id=$1', [roomId])).rows[0].players;
    assert.deepEqual(players.map(player => player.userId), [host]);
  });

  it('rejects non-hosts, non-waiting rooms, self kicks, and unknown targets', async () => {
    const nonHostRoom = await makeRoom();
    await actor(other);
    await rejects(() => kick(nonHostRoom, guest));

    const playingRoom = await makeRoom('playing');
    await actor(host);
    await rejects(() => kick(playingRoom, guest));
    await rejects(() => kick(nonHostRoom, host));
    await rejects(() => kick(nonHostRoom, other));
  });
});
