begin;

create schema if not exists private;
grant usage on schema private to service_role;
alter table public.rooms add column if not exists skull_epoch bigint not null default 0;

-- Only the public projection is replicated with rooms.
create table if not exists private.skull_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  state jsonb not null
);
alter table private.skull_state enable row level security;
revoke all on private.skull_state from public, anon, authenticated, service_role;

create or replace function public.skull_commit_initial(
  p_room_id uuid, p_actor_id uuid, p_expected_epoch bigint, p_roster jsonb,
  p_state jsonb, p_public_state jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare room public.rooms%rowtype; existing jsonb;
begin
  select * into room from public.rooms where id = p_room_id for update;
  if not found or room.game_type is distinct from 'skull' or room.status is distinct from 'playing'
    or room.host_id is distinct from p_actor_id then
    raise exception 'host initialization required';
  end if;
  if room.skull_epoch is distinct from p_expected_epoch then raise exception 'stale room start'; end if;
  select state into existing from private.skull_state where room_id = p_room_id;
  if found then return existing; end if;
  if p_roster is distinct from room.players then raise exception 'roster changed'; end if;
  if coalesce(room.game_state, '{}'::jsonb) <> '{}'::jsonb then raise exception 'stale room start'; end if;
  insert into private.skull_state(room_id, state) values (p_room_id, p_state);
  update public.rooms set game_state = p_public_state where id = p_room_id;
  return p_state;
end;
$fn$;

create or replace function public.skull_read_state(p_room_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare room public.rooms%rowtype; result jsonb;
begin
  select * into room from public.rooms where id = p_room_id for share;
  if not found or room.game_type is distinct from 'skull' or room.status not in ('playing','finished') then
    raise exception 'game is not active';
  end if;
  if room.host_id is distinct from p_actor_id and not exists (
    select 1 from pg_catalog.jsonb_array_elements(room.players) player where player ->> 'userId' = p_actor_id::text
  ) then raise exception 'room membership required'; end if;
  select state into result from private.skull_state where room_id = p_room_id;
  return result;
end;
$fn$;

create or replace function public.skull_commit_action(
  p_room_id uuid, p_actor_id uuid, p_match_id text, p_expected_revision integer,
  p_action_id text, p_state jsonb, p_public_state jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare room public.rooms%rowtype; current_state jsonb; action_key text;
begin
  if p_actor_id is null or p_action_id is null or p_action_id !~ '^[a-zA-Z0-9_-]{8,128}$' then
    raise exception 'invalid action';
  end if;
  action_key := p_actor_id::text || ':' || p_action_id;

  -- Every operation acquires the room lock first, including reset via the room trigger.
  select * into room from public.rooms where id = p_room_id for update;
  if not found or room.game_type is distinct from 'skull' or room.status not in ('playing','finished') then
    raise exception 'game is not active';
  end if;
  if room.host_id is distinct from p_actor_id and not exists (
    select 1 from pg_catalog.jsonb_array_elements(room.players) player where player ->> 'userId' = p_actor_id::text
  ) then raise exception 'room membership required'; end if;
  select state into current_state from private.skull_state where room_id = p_room_id;
  if not found then raise exception 'game is not initialized'; end if;
  if current_state ->> 'matchId' is distinct from p_match_id then raise exception 'stale match'; end if;
  if current_state -> 'processedActions' ? action_key then return current_state; end if;
  if room.status <> 'playing' then raise exception 'game is finished'; end if;
  if (current_state ->> 'revision')::integer is distinct from p_expected_revision then raise exception 'stale revision'; end if;
  if p_state ->> 'matchId' is distinct from p_match_id
    or (p_state ->> 'revision')::integer is distinct from p_expected_revision + 1
    or not coalesce(p_state -> 'processedActions' ? action_key, false) then
    raise exception 'invalid state revision';
  end if;
  update private.skull_state set state = p_state where room_id = p_room_id;
  update public.rooms
  set game_state = p_public_state,
      status = case when p_public_state ->> 'phase' = 'finished' then 'finished' else 'playing' end
  where id = p_room_id;
  return p_state;
end;
$fn$;

create or replace function public.skull_reset_private_state()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if old.game_type = 'skull' and old.status in ('playing','finished') and new.status = 'waiting' then
    new.skull_epoch := old.skull_epoch + 1;
    delete from private.skull_state where room_id = old.id;
  end if;
  return new;
end;
$fn$;
drop trigger if exists skull_reset_private_state_trigger on public.rooms;
create trigger skull_reset_private_state_trigger before update of status on public.rooms
for each row execute function public.skull_reset_private_state();

create or replace function public.enforce_skull_room_update()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare player_count integer; old_ids text[]; new_ids text[];
begin
  if new.game_type = 'skull' and new.status = 'playing' then
    player_count := case when pg_catalog.jsonb_typeof(new.players) = 'array' then pg_catalog.jsonb_array_length(new.players) else 0 end;
    if player_count < 3 or player_count > 6 then
      raise exception 'スカルは3〜6人で遊べます（現在%人です）', player_count;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if current_user in ('authenticated','anon') and new.game_type = 'skull' and
      (new.status <> 'waiting' or coalesce(new.game_state, '{}'::jsonb) <> '{}'::jsonb or new.skull_epoch <> 0) then
      raise exception 'スカルはロビーから開始してください';
    end if;
    return new;
  end if;

  if old.game_type = 'skull' and old.status in ('playing','finished') then
    if new.game_type is distinct from old.game_type then raise exception '進行中のゲームは変更できません'; end if;
    select pg_catalog.array_agg(player ->> 'userId' order by ordinality) into old_ids
    from pg_catalog.jsonb_array_elements(old.players) with ordinality entry(player, ordinality);
    select pg_catalog.array_agg(player ->> 'userId' order by ordinality) into new_ids
    from pg_catalog.jsonb_array_elements(new.players) with ordinality entry(player, ordinality);
    if old_ids is distinct from new_ids then raise exception '進行中の座席順は変更できません'; end if;
  end if;

  if current_user not in ('authenticated','anon') then return new; end if;
  if new.skull_epoch is distinct from old.skull_epoch then raise exception 'ゲームの世代は変更できません'; end if;
  if old.game_type = 'skull' and old.status in ('playing','finished') then
    if auth.uid() = old.host_id and new.status = 'waiting' and coalesce(new.game_state, '{}'::jsonb) = '{}'::jsonb then
      return new;
    end if;
    if new.status is distinct from old.status or new.game_state is distinct from old.game_state then
      raise exception 'スカルの状態はサーバー処理からのみ更新できます';
    end if;
  elsif new.game_type = 'skull' and (old.game_type <> 'skull' or old.status = 'waiting') then
    if coalesce(new.game_state, '{}'::jsonb) <> '{}'::jsonb or new.status = 'finished'
      or (new.status = 'playing' and (old.status <> 'waiting' or auth.uid() is distinct from old.host_id)) then
      raise exception 'スカルはロビーから開始してください';
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists enforce_skull_room_update_trigger on public.rooms;
create trigger enforce_skull_room_update_trigger before insert or update on public.rooms
for each row execute function public.enforce_skull_room_update();

revoke execute on function public.enforce_skull_room_update() from public, anon, authenticated, service_role;
revoke execute on function public.skull_reset_private_state() from public, anon, authenticated, service_role;
revoke all on function public.skull_read_state(uuid,uuid) from public, anon, authenticated;
revoke all on function public.skull_commit_initial(uuid,uuid,bigint,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.skull_commit_action(uuid,uuid,text,integer,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.skull_read_state(uuid,uuid) to service_role;
grant execute on function public.skull_commit_initial(uuid,uuid,bigint,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.skull_commit_action(uuid,uuid,text,integer,text,jsonb,jsonb) to service_role;

commit;
