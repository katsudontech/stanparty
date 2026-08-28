begin;

-- StanParty rooms are temporary. Track the latest room mutation separately from
-- created_at so an old room is not removed while a game is still progressing.
alter table public.rooms
  add column if not exists last_activity_at timestamptz;

-- Give every existing room a full retention period after this migration is
-- applied instead of immediately deleting old records.
update public.rooms
set last_activity_at = pg_catalog.now()
where last_activity_at is null;

alter table public.rooms
  alter column last_activity_at set default pg_catalog.now(),
  alter column last_activity_at set not null;

create index if not exists rooms_last_activity_at_idx
  on public.rooms (last_activity_at);

create index if not exists game_events_room_created_at_idx
  on public.game_events (room_id, created_at desc);

-- The app already upserts the current guest profile whenever it starts. Use
-- that write as an authoritative last-seen signal for anonymous-user cleanup.
alter table public.users
  add column if not exists last_seen_at timestamptz;

-- Existing users also receive a full retention period after migration.
update public.users
set last_seen_at = pg_catalog.now()
where last_seen_at is null;

alter table public.users
  alter column last_seen_at set default pg_catalog.now(),
  alter column last_seen_at set not null;

create index if not exists users_last_seen_at_idx
  on public.users (last_seen_at);

create or replace function public.set_user_last_seen_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.last_seen_at := pg_catalog.now();
  return new;
end;
$function$;

drop trigger if exists set_user_last_seen_at_trigger on public.users;
create trigger set_user_last_seen_at_trigger
before update on public.users
for each row execute function public.set_user_last_seen_at();

create or replace function public.set_room_last_activity_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- Always use the database clock so clients cannot choose the retention time.
  new.last_activity_at := pg_catalog.now();
  return new;
end;
$function$;

drop trigger if exists set_room_last_activity_at_trigger on public.rooms;
create trigger set_room_last_activity_at_trigger
before update on public.rooms
for each row execute function public.set_room_last_activity_at();

create or replace function public.cleanup_stale_stanparty_data()
returns table (
  rooms_deleted bigint,
  anonymous_users_deleted bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  stale_room_ids uuid[];
  stale_anonymous_user_ids uuid[];
  removed_rooms bigint := 0;
  removed_anonymous_users bigint := 0;
  room_cutoff constant timestamptz := pg_catalog.now() - interval '24 hours';
  anonymous_user_cutoff constant timestamptz := pg_catalog.now() - interval '30 days';
begin
  select pg_catalog.array_agg(room.id)
  into stale_room_ids
  from public.rooms as room
  where room.last_activity_at < room_cutoff
    and not exists (
      select 1
      from public.game_events as event
      where event.room_id = room.id
        and event.created_at >= room_cutoff
    );

  if pg_catalog.coalesce(pg_catalog.cardinality(stale_room_ids), 0) > 0 then
    -- Delete child events explicitly so cleanup is safe even when the original
    -- game_events foreign key was not created with ON DELETE CASCADE.
    delete from public.game_events
    where room_id = any(stale_room_ids);

    delete from public.rooms
    where id = any(stale_room_ids);

    get diagnostics removed_rooms = row_count;
  end if;

  -- Keep anonymous users that are referenced by any remaining room. This also
  -- protects participants stored inside the players JSON array.
  select pg_catalog.array_agg(auth_user.id)
  into stale_anonymous_user_ids
  from auth.users as auth_user
  left join public.users as profile on profile.id = auth_user.id
  where auth_user.is_anonymous is true
    and pg_catalog.coalesce(profile.last_seen_at, auth_user.created_at) < anonymous_user_cutoff
    and not exists (
      select 1
      from public.rooms as room
      where room.host_id = auth_user.id
        or exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            case
              when pg_catalog.jsonb_typeof(room.players) = 'array' then room.players
              else '[]'::jsonb
            end
          ) as player
          where player ->> 'userId' = auth_user.id::text
        )
    );

  if pg_catalog.coalesce(pg_catalog.cardinality(stale_anonymous_user_ids), 0) > 0 then
    -- Remove the app profile first. Standard Supabase auth relations are then
    -- removed by their auth.users cascade when the anonymous identity is deleted.
    delete from public.users
    where id = any(stale_anonymous_user_ids);

    delete from auth.users
    where id = any(stale_anonymous_user_ids)
      and is_anonymous is true;

    get diagnostics removed_anonymous_users = row_count;
  end if;

  return query
  select removed_rooms, removed_anonymous_users;
end;
$function$;

comment on function public.cleanup_stale_stanparty_data() is
  'Deletes rooms inactive for 24 hours and unreferenced anonymous users inactive for 30 days.';

revoke execute on function public.cleanup_stale_stanparty_data()
  from public, anon, authenticated;

-- Supabase Cron is backed by pg_cron. The named job can be inspected and its
-- run history reviewed from the Supabase Dashboard.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'stanparty-cleanup-stale-data',
  '17 * * * *',
  'select * from public.cleanup_stale_stanparty_data();'
);

commit;
