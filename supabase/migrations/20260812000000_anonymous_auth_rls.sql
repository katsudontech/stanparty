begin;

-- Normalize the nullable flag before making its public/private meaning consistent.
update public.rooms
set is_public = true
where is_public is null;

alter table public.rooms
  alter column is_public set default true,
  alter column is_public set not null;

-- New events record the authenticated actor. Existing transient rows stay nullable.
alter table public.game_events
  add column if not exists actor_id uuid default auth.uid();

create index if not exists game_events_room_actor_idx
  on public.game_events (room_id, actor_id);

-- Public room discovery must not expose rooms.players or rooms.game_state.
create table if not exists public.room_directory (
  id uuid primary key references public.rooms (id) on delete cascade,
  room_name text,
  game_type text not null,
  status text not null,
  player_count integer not null default 0 check (player_count >= 0),
  created_at timestamptz not null
);

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.rooms as room
    where room.id = p_room_id
      and (select auth.uid()) is not null
      and (
        room.host_id = (select auth.uid())
        or exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            case
              when pg_catalog.jsonb_typeof(room.players) = 'array' then room.players
              else '[]'::jsonb
            end
          ) as player
          where player ->> 'userId' = (select auth.uid())::text
        )
      )
  );
$function$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.rooms as room
    where room.id = p_room_id
      and room.host_id = (select auth.uid())
  );
$function$;

create or replace function public.sync_room_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.room_directory where id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and new.room_name is not distinct from old.room_name
    and new.game_type is not distinct from old.game_type
    and new.status is not distinct from old.status
    and new.players is not distinct from old.players
    and new.is_public is not distinct from old.is_public
    and new.host_id is not distinct from old.host_id then
    return new;
  end if;

  if new.is_public
    and exists (select 1 from auth.users where id = new.host_id) then
    insert into public.room_directory (
      id,
      room_name,
      game_type,
      status,
      player_count,
      created_at
    )
    values (
      new.id,
      new.room_name,
      new.game_type,
      new.status,
      case
        when pg_catalog.jsonb_typeof(new.players) = 'array'
          then pg_catalog.jsonb_array_length(new.players)
        else 0
      end,
      new.created_at
    )
    on conflict (id) do update
    set room_name = excluded.room_name,
        game_type = excluded.game_type,
        status = excluded.status,
        player_count = excluded.player_count,
        created_at = excluded.created_at;
  else
    delete from public.room_directory where id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_room_directory_trigger on public.rooms;
create trigger sync_room_directory_trigger
after insert or update or delete on public.rooms
for each row execute function public.sync_room_directory();

-- Do not let an authenticated non-host change lobby/ownership columns directly.
-- game_state remains member-writable until Step 3 replaces this with action RPCs.
create or replace function public.enforce_room_update_permissions()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
begin
  -- Security-definer room RPCs run as their owner after validating the caller.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if new.id is distinct from old.id
    or new.host_id is distinct from old.host_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Room identity fields cannot be changed';
  end if;

  if request_user_id <> old.host_id then
    if not public.is_room_member(old.id) then
      raise exception 'Room membership is required';
    end if;

    if new.game_type is distinct from old.game_type
      or new.status is distinct from old.status
      or new.players is distinct from old.players
      or new.room_name is distinct from old.room_name
      or new.is_display_roomlist is distinct from old.is_display_roomlist
      or new.is_public is distinct from old.is_public then
      raise exception 'Only the host can change lobby or membership fields';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_room_update_permissions_trigger on public.rooms;
create trigger enforce_room_update_permissions_trigger
before update on public.rooms
for each row execute function public.enforce_room_update_permissions();

-- Only rooms owned by actual Supabase Auth users are discoverable after migration.
insert into public.room_directory (
  id,
  room_name,
  game_type,
  status,
  player_count,
  created_at
)
select
  room.id,
  room.room_name,
  room.game_type,
  room.status,
  case
    when pg_catalog.jsonb_typeof(room.players) = 'array'
      then pg_catalog.jsonb_array_length(room.players)
    else 0
  end,
  room.created_at
from public.rooms as room
join auth.users as auth_user on auth_user.id = room.host_id
where room.is_public
on conflict (id) do update
set room_name = excluded.room_name,
    game_type = excluded.game_type,
    status = excluded.status,
    player_count = excluded.player_count,
    created_at = excluded.created_at;

create or replace function public.join_room(
  p_room_id uuid,
  p_name text,
  p_avatar_url text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  player_index integer;
  player_colors constant text[] := array[
    '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
    '#84cc16', '#eab308', '#f43f5e', '#d946ef', '#0ea5e9',
    '#22c55e', '#a855f7', '#78716c', '#64748b', '#fbbf24'
  ];
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_name is null or pg_catalog.char_length(pg_catalog.btrim(p_name)) = 0 then
    raise exception 'A player name is required';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_name)) > 80 then
    raise exception 'Player name is too long';
  end if;

  if not exists (select 1 from public.users where id = request_user_id) then
    raise exception 'Create a user profile before joining a room';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if target_room.status <> 'waiting' then
    raise exception 'This room is not accepting players';
  end if;

  if public.is_room_member(p_room_id) then
    return true;
  end if;

  if pg_catalog.jsonb_typeof(target_room.players) <> 'array' then
    raise exception 'Room player data is invalid';
  end if;

  player_index := pg_catalog.jsonb_array_length(target_room.players);

  update public.rooms
  set players = target_room.players || pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'userId', request_user_id::text,
      'name', pg_catalog.btrim(p_name),
      'avatarUrl', coalesce(p_avatar_url, ''),
      'isHost', false,
      'color', player_colors[(player_index % pg_catalog.array_length(player_colors, 1)) + 1],
      'isOnline', true
    )
  )
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.leave_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  remaining_players jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if target_room.host_id = request_user_id then
    raise exception 'The host must delete the room instead of leaving it';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'Room membership is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(entry.player order by entry.ordinal),
    '[]'::jsonb
  )
  into remaining_players
  from pg_catalog.jsonb_array_elements(target_room.players)
    with ordinality as entry(player, ordinal)
  where entry.player ->> 'userId' <> request_user_id::text;

  update public.rooms
  set players = remaining_players
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.remove_room_players(
  p_room_id uuid,
  p_user_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  remaining_players jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if target_room.host_id <> request_user_id then
    raise exception 'Only the host can remove players';
  end if;

  if p_user_ids is null or pg_catalog.cardinality(p_user_ids) = 0 then
    return true;
  end if;

  if target_room.host_id = any(p_user_ids) then
    raise exception 'The host cannot be removed from the room';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(entry.player order by entry.ordinal),
    '[]'::jsonb
  )
  into remaining_players
  from pg_catalog.jsonb_array_elements(target_room.players)
    with ordinality as entry(player, ordinal)
  where not exists (
    select 1
    from pg_catalog.unnest(p_user_ids) as requested(user_id)
    where requested.user_id::text = entry.player ->> 'userId'
  );

  update public.rooms
  set players = remaining_players
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.update_my_room_profile(
  p_room_id uuid,
  p_name text,
  p_avatar_url text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  updated_players jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_name is null or pg_catalog.char_length(pg_catalog.btrim(p_name)) = 0 then
    raise exception 'A player name is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not public.is_room_member(p_room_id) then
    raise exception 'Room membership is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      case
        when entry.player ->> 'userId' = request_user_id::text then
          pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
              entry.player,
              '{name}',
              pg_catalog.to_jsonb(pg_catalog.btrim(p_name)),
              true
            ),
            '{avatarUrl}',
            pg_catalog.to_jsonb(coalesce(p_avatar_url, '')),
            true
          )
        else entry.player
      end
      order by entry.ordinal
    ),
    '[]'::jsonb
  )
  into updated_players
  from pg_catalog.jsonb_array_elements(target_room.players)
    with ordinality as entry(player, ordinal);

  update public.rooms
  set players = updated_players
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.undo_latest_stroke(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  latest_event_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not public.is_room_member(p_room_id) then
    raise exception 'Room membership is required';
  end if;

  if target_room.game_state ->> 'phase' <> 'drawing'
    or target_room.game_state ->> 'currentTurnPlayerId' <> request_user_id::text then
    raise exception 'Only the current player can undo a stroke';
  end if;

  select event.id
  into latest_event_id
  from public.game_events as event
  where event.room_id = p_room_id
    and event.event_type = 'draw_line'
  order by event.created_at desc, event.id desc
  limit 1;

  if latest_event_id is null then
    return false;
  end if;

  delete from public.game_events
  where id = latest_event_id;

  return true;
end;
$function$;

create or replace function public.can_access_room_presence_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  topic_room_id uuid;
begin
  if p_topic is null
    or p_topic !~* '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:presence$' then
    return false;
  end if;

  topic_room_id := pg_catalog.split_part(p_topic, ':', 2)::uuid;
  return public.is_room_member(topic_room_id);
end;
$function$;

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.game_events enable row level security;
alter table public.room_directory enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self
on public.users for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists users_insert_self on public.users;
create policy users_insert_self
on public.users for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists users_update_self on public.users;
create policy users_update_self
on public.users for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists room_directory_select_public on public.room_directory;
create policy room_directory_select_public
on public.room_directory for select
to authenticated
using (true);

drop policy if exists rooms_select_member on public.rooms;
create policy rooms_select_member
on public.rooms for select
to authenticated
using (public.is_room_member(id));

drop policy if exists rooms_insert_host on public.rooms;
create policy rooms_insert_host
on public.rooms for insert
to authenticated
with check (
  host_id = (select auth.uid())
  and pg_catalog.jsonb_typeof(players) = 'array'
  and pg_catalog.jsonb_array_length(players) = 1
  and players -> 0 ->> 'userId' = (select auth.uid())::text
  and players -> 0 ->> 'isHost' = 'true'
);

drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host
on public.rooms for update
to authenticated
using (host_id = (select auth.uid()))
with check (host_id = (select auth.uid()));

drop policy if exists rooms_update_member_game_state on public.rooms;
create policy rooms_update_member_game_state
on public.rooms for update
to authenticated
using (public.is_room_member(id))
with check (public.is_room_member(id));

drop policy if exists rooms_delete_host on public.rooms;
create policy rooms_delete_host
on public.rooms for delete
to authenticated
using (host_id = (select auth.uid()));

drop policy if exists game_events_select_member on public.game_events;
create policy game_events_select_member
on public.game_events for select
to authenticated
using (public.is_room_member(room_id));

drop policy if exists game_events_insert_member on public.game_events;
create policy game_events_insert_member
on public.game_events for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and public.is_room_member(room_id)
);

drop policy if exists game_events_delete_actor_or_host on public.game_events;
create policy game_events_delete_actor_or_host
on public.game_events for delete
to authenticated
using (
  actor_id = (select auth.uid())
  or public.is_room_host(room_id)
);

revoke all on table public.users from anon;
revoke all on table public.rooms from anon;
revoke all on table public.game_events from anon;
revoke all on table public.room_directory from anon;

revoke all on table public.users from authenticated;
revoke all on table public.rooms from authenticated;
revoke all on table public.game_events from authenticated;
revoke all on table public.room_directory from authenticated;

grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.rooms to authenticated;
grant select, insert, delete on table public.game_events to authenticated;
grant select on table public.room_directory to authenticated;

revoke execute on function public.is_room_member(uuid) from public, anon;
revoke execute on function public.is_room_host(uuid) from public, anon;
revoke execute on function public.sync_room_directory() from public, anon, authenticated;
revoke execute on function public.enforce_room_update_permissions() from public, anon, authenticated;
revoke execute on function public.join_room(uuid, text, text) from public, anon;
revoke execute on function public.leave_room(uuid) from public, anon;
revoke execute on function public.remove_room_players(uuid, uuid[]) from public, anon;
revoke execute on function public.update_my_room_profile(uuid, text, text) from public, anon;
revoke execute on function public.undo_latest_stroke(uuid) from public, anon;
revoke execute on function public.can_access_room_presence_topic(text) from public, anon;

grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_room_host(uuid) to authenticated;
grant execute on function public.join_room(uuid, text, text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.remove_room_players(uuid, uuid[]) to authenticated;
grant execute on function public.update_my_room_profile(uuid, text, text) to authenticated;
grant execute on function public.undo_latest_stroke(uuid) to authenticated;
grant execute on function public.can_access_room_presence_topic(text) to authenticated;

drop policy if exists stanparty_room_presence_select on realtime.messages;
create policy stanparty_room_presence_select
on realtime.messages for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and public.can_access_room_presence_topic((select realtime.topic()))
);

drop policy if exists stanparty_room_presence_insert on realtime.messages;
create policy stanparty_room_presence_insert
on realtime.messages for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and public.can_access_room_presence_topic((select realtime.topic()))
);

do $block$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_directory'
  ) then
    alter publication supabase_realtime add table public.room_directory;
  end if;
end;
$block$;

commit;
