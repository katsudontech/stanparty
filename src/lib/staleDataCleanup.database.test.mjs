import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const db = new PGlite();
const ids = {
  staleRoom: '00000000-0000-4000-8000-000000000001',
  activeRoom: '00000000-0000-4000-8000-000000000002',
  recentEventRoom: '00000000-0000-4000-8000-000000000003',
  staleRoomHost: '00000000-0000-4000-8000-000000000011',
  activeRoomHost: '00000000-0000-4000-8000-000000000012',
  activeRoomPlayer: '00000000-0000-4000-8000-000000000013',
  recentEventHost: '00000000-0000-4000-8000-000000000014',
  unusedAnonymous: '00000000-0000-4000-8000-000000000015',
  registeredUser: '00000000-0000-4000-8000-000000000016',
  recentlySeenAnonymous: '00000000-0000-4000-8000-000000000017',
};

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      is_anonymous boolean not null,
      created_at timestamptz not null
    );
    create table public.users (
      id uuid primary key,
      last_seen_at timestamptz
    );
    create table public.rooms (
      id uuid primary key,
      host_id uuid not null,
      players jsonb not null,
      last_activity_at timestamptz not null
    );
    create table public.game_events (
      id uuid primary key,
      room_id uuid not null,
      event_type text not null,
      payload jsonb not null,
      created_at timestamptz not null
    );

    insert into auth.users (id, is_anonymous, created_at) values
      ('${ids.staleRoomHost}', true, now() - interval '40 days'),
      ('${ids.activeRoomHost}', true, now() - interval '40 days'),
      ('${ids.activeRoomPlayer}', true, now() - interval '40 days'),
      ('${ids.recentEventHost}', true, now() - interval '40 days'),
      ('${ids.unusedAnonymous}', true, now() - interval '40 days'),
      ('${ids.registeredUser}', false, now() - interval '40 days'),
      ('${ids.recentlySeenAnonymous}', true, now() - interval '40 days');

    insert into public.users (id, last_seen_at) values
      ('${ids.staleRoomHost}', now() - interval '40 days'),
      ('${ids.activeRoomHost}', now() - interval '40 days'),
      ('${ids.activeRoomPlayer}', now() - interval '40 days'),
      ('${ids.recentEventHost}', now() - interval '40 days'),
      ('${ids.unusedAnonymous}', null),
      ('${ids.registeredUser}', now() - interval '40 days'),
      ('${ids.recentlySeenAnonymous}', now() - interval '2 days');

    insert into public.rooms (id, host_id, players, last_activity_at) values
      ('${ids.staleRoom}', '${ids.staleRoomHost}', '[{"userId":"${ids.staleRoomHost}"}]', now() - interval '25 hours'),
      ('${ids.activeRoom}', '${ids.activeRoomHost}', '[{"userId":"${ids.activeRoomHost}"},{"userId":"${ids.activeRoomPlayer}"}]', now() - interval '2 hours'),
      ('${ids.recentEventRoom}', '${ids.recentEventHost}', '[]', now() - interval '25 hours');

    insert into public.game_events (id, room_id, event_type, payload, created_at) values
      ('00000000-0000-4000-8000-000000000021', '${ids.staleRoom}', 'old', '{}', now() - interval '25 hours'),
      ('00000000-0000-4000-8000-000000000022', '${ids.recentEventRoom}', 'recent', '{}', now() - interval '1 hour');
  `);

  const migration = await readFile(
    new URL('../../supabase/migrations/20260917010000_fix_stale_data_cleanup.sql', import.meta.url),
    'utf8',
  );
  await db.exec(migration);
}, 30000);

afterAll(() => db.close());

describe('stale StanParty data cleanup migration', () => {
  it('executes the replacement function and preserves eligible records', async () => {
    const result = await db.query('select * from public.cleanup_stale_stanparty_data()');
    expect(result.rows).toHaveLength(1);
    expect(String(result.rows[0].rooms_deleted)).toBe('1');
    expect(String(result.rows[0].anonymous_users_deleted)).toBe('2');

    expect((await db.query('select id from public.rooms order by id')).rows.map(row => row.id)).toEqual([
      ids.activeRoom,
      ids.recentEventRoom,
    ]);
    expect((await db.query('select room_id from public.game_events order by room_id')).rows.map(row => row.room_id)).toEqual([
      ids.recentEventRoom,
    ]);

    const remainingUsers = (await db.query('select id from auth.users order by id')).rows.map(row => row.id);
    expect(remainingUsers).toEqual([
      ids.activeRoomHost,
      ids.activeRoomPlayer,
      ids.recentEventHost,
      ids.registeredUser,
      ids.recentlySeenAnonymous,
    ].sort());
    expect((await db.query('select id from public.users order by id')).rows.map(row => row.id)).toEqual([
      ids.activeRoomHost,
      ids.activeRoomPlayer,
      ids.recentEventHost,
      ids.registeredUser,
      ids.recentlySeenAnonymous,
    ].sort());
  });

  it('returns zero counts when there is nothing left to delete', async () => {
    await db.query('select * from public.cleanup_stale_stanparty_data()');
    const result = await db.query('select * from public.cleanup_stale_stanparty_data()');
    expect(result.rows).toHaveLength(1);
    expect(String(result.rows[0].rooms_deleted)).toBe('0');
    expect(String(result.rows[0].anonymous_users_deleted)).toBe('0');
  });

  it('keeps the security-definer contract and client execute revokes', async () => {
    const functionInfo = await db.query(`
      select p.prosecdef, p.proconfig,
        has_function_privilege('anon', 'public.cleanup_stale_stanparty_data()', 'execute') as anon_execute,
        has_function_privilege('authenticated', 'public.cleanup_stale_stanparty_data()', 'execute') as authenticated_execute
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cleanup_stale_stanparty_data'
    `);
    expect(functionInfo.rows).toEqual([{
      prosecdef: true,
      proconfig: ['search_path=""'],
      anon_execute: false,
      authenticated_execute: false,
    }]);
  });
});
