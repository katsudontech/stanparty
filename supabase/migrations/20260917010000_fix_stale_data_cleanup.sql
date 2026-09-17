begin;

-- coalesce is a SQL conditional expression, not a pg_catalog function. Keep
-- the cleanup function's public contract and security settings unchanged.
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

  if coalesce(pg_catalog.cardinality(stale_room_ids), 0) > 0 then
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
    and coalesce(profile.last_seen_at, auth_user.created_at) < anonymous_user_cutoff
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

  if coalesce(pg_catalog.cardinality(stale_anonymous_user_ids), 0) > 0 then
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

commit;
