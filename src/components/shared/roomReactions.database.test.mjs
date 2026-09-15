import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const db = new PGlite();
const roomId = '00000000-0000-4000-8000-000000000001';
const memberId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const outsiderId = '00000000-0000-4000-8000-000000000004';

await db.exec(`
create role authenticated;
create role anon;
create schema auth;
create schema realtime;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function realtime.topic() returns text language sql stable as $$ select current_setting('request.jwt.claim.topic', true) $$;
create table public.rooms (id uuid primary key, host_id uuid not null, players jsonb not null);
create table realtime.messages (extension text not null, topic text not null);
alter table realtime.messages enable row level security;
grant usage on schema auth, realtime to authenticated;
grant execute on function auth.uid(), realtime.topic() to authenticated;
grant select, insert on table realtime.messages to authenticated;
create function public.is_room_member(p_room_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.rooms r where r.id=p_room_id and (r.host_id=auth.uid() or exists(select 1 from jsonb_array_elements(r.players) p where p->>'userId'=auth.uid()::text)))
$$;
create function public.can_access_room_presence_topic(p_topic text) returns boolean language sql stable security definer set search_path='' as $$ select p_topic like 'room:%:presence' and public.is_room_member(split_part(p_topic, ':', 2)::uuid) $$;
create policy presence_select on realtime.messages for select to authenticated using (extension='presence' and public.can_access_room_presence_topic(realtime.topic()));
create policy presence_insert on realtime.messages for insert to authenticated with check (extension='presence' and public.can_access_room_presence_topic(realtime.topic()));
insert into public.rooms values ('${roomId}', '${otherId}', '[{"userId":"${memberId}","name":"Alice"},{"userId":"${otherId}","name":"Host"}]');
`);

const migration = await readFile(`${root}/supabase/migrations/20260915000000_room_reactions.sql`, 'utf8');
await db.exec(migration);
await db.exec(`insert into realtime.messages values ('broadcast', 'room-reactions:${roomId}:${memberId}')`);
await db.exec(`insert into realtime.messages values ('presence', 'room:${roomId}:presence')`);
await db.exec(`create policy broad_select on realtime.messages for select to authenticated using (true); create policy broad_insert on realtime.messages for insert to authenticated with check (true);`);

async function actor(id, topic = '') {
  await db.exec('reset role');
  await db.query('select set_config(\'request.jwt.claim.sub\', $1, false)', [id]);
  await db.query('select set_config(\'request.jwt.claim.topic\', $1, false)', [topic]);
  await db.exec('set role authenticated');
}

describe('room reaction Realtime policies', () => {
  afterAll(async () => { await db.close(); });

  it('allows a member to read only their recipient topic', async () => {
    await actor(memberId, `room-reactions:${roomId}:${memberId}`);
    const own = await db.query("select count(*)::integer as count from realtime.messages where extension='broadcast'");
    assert.equal(own.rows[0].count, 1);
    await actor(memberId, `room-reactions:${roomId}:${otherId}`);
    const other = await db.query("select count(*)::integer as count from realtime.messages where extension='broadcast'");
    assert.equal(other.rows[0].count, 0);
  });

  it('rejects client broadcast inserts even on an authorized topic', async () => {
    await actor(memberId, `room-reactions:${roomId}:${memberId}`);
    await assert.rejects(
      () => db.query('insert into realtime.messages values ($1, $2)', ['broadcast', `room-reactions:${roomId}:${memberId}`]),
      /row-level security|permission denied/i,
    );
  });

  it('leaves policies for unrelated broadcast topics in control', async () => {
    await actor(memberId, 'existing-feature:topic');
    await db.query('insert into realtime.messages values ($1, $2)', ['broadcast', 'existing-feature:topic']);
    const result = await db.query("select count(*)::integer as count from realtime.messages where topic='existing-feature:topic'");
    assert.equal(result.rows[0].count, 1);
    await db.exec('reset role');
    await db.exec("delete from realtime.messages where topic='existing-feature:topic'");
  });

  it('denies outsider, removed member, and malformed topics while preserving presence', async () => {
    await actor(outsiderId, `room-reactions:${roomId}:${outsiderId}`);
    assert.equal((await db.query("select count(*)::integer as count from realtime.messages where extension='broadcast'")).rows[0].count, 0);
    await actor(memberId, `room-reactions:${roomId}:not-a-user-id`);
    assert.equal((await db.query("select count(*)::integer as count from realtime.messages where extension='broadcast'")).rows[0].count, 0);
    await actor(memberId, `room:${roomId}:presence`);
    assert.equal((await db.query("select count(*)::integer as count from realtime.messages where extension='presence'")).rows[0].count, 1);
    await db.exec('reset role');
    await db.query('update public.rooms set players=$1 where id=$2', ['[]', roomId]);
    await actor(memberId, `room-reactions:${roomId}:${memberId}`);
    assert.equal((await db.query("select count(*)::integer as count from realtime.messages where extension='broadcast'")).rows[0].count, 0);
  });
});
