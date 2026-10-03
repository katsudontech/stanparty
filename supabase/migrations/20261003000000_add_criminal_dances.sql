begin;

-- Complete hands and pending selections are kept outside rooms.game_state. The
-- service role is the only role that can read or mutate this table; the API
-- authenticates the caller and returns a viewer-scoped projection.
create schema if not exists private;
grant usage on schema private to service_role;
alter table public.rooms add column if not exists criminal_dances_epoch bigint not null default 0;

create table if not exists private.criminal_dances_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  match_id text not null,
  state jsonb not null,
  public_state jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
alter table private.criminal_dances_state enable row level security;
revoke all on private.criminal_dances_state from public, anon, authenticated;
grant select, insert, update, delete on private.criminal_dances_state to service_role;

create or replace function public.criminal_dances_commit_initial(
  p_room_id uuid,
  p_actor_id uuid,
  p_match_id text,
  p_expected_epoch bigint,
  p_roster jsonb,
  p_state jsonb,
  p_public_state jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare room public.rooms%rowtype; existing private.criminal_dances_state%rowtype;
begin
  if p_actor_id is null or p_match_id is null or pg_catalog.jsonb_typeof(p_state) <> 'object' or pg_catalog.jsonb_typeof(p_public_state) <> 'object' then raise exception 'invalid game state'; end if;
  select * into room from public.rooms where id = p_room_id for update;
  if not found or room.game_type is distinct from 'criminal-dances' or room.status is distinct from 'playing' or room.host_id <> p_actor_id then raise exception 'host initialization required'; end if;
  if room.criminal_dances_epoch is distinct from p_expected_epoch then raise exception 'stale room start'; end if;
  if p_roster is distinct from room.players then raise exception 'roster changed'; end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(room.players) = 'array' then room.players else '[]'::jsonb end) player where player ->> 'userId' = p_actor_id::text) and room.host_id <> p_actor_id then raise exception 'room membership required'; end if;
  select * into existing from private.criminal_dances_state where room_id = p_room_id for update;
  if found then
    if existing.match_id = p_match_id then return existing.public_state; end if;
    raise exception 'match already initialized';
  end if;
  if coalesce(room.game_state, '{}'::jsonb) <> '{}'::jsonb then raise exception 'stale room start'; end if;
  insert into private.criminal_dances_state(room_id, match_id, state, public_state) values (p_room_id, p_match_id, p_state, p_public_state);
  update public.rooms set game_state = p_public_state where id = p_room_id;
  return p_public_state;
end;
$fn$;

create or replace function public.criminal_dances_read_state(p_room_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare room public.rooms%rowtype; result jsonb;
begin
  select * into room from public.rooms where id = p_room_id for share;
  if not found or room.game_type is distinct from 'criminal-dances' or room.status not in ('playing','finished') then raise exception 'game is not active'; end if;
  if room.host_id is distinct from p_actor_id and not exists (select 1 from pg_catalog.jsonb_array_elements(room.players) player where player ->> 'userId' = p_actor_id::text) then raise exception 'room membership required'; end if;
  select state into result from private.criminal_dances_state where room_id = p_room_id;
  return result;
end;
$fn$;

create or replace function public.criminal_dances_commit_action(
  p_room_id uuid,
  p_actor_id uuid,
  p_match_id text,
  p_expected_revision integer,
  p_action_id text,
  p_state jsonb,
  p_public_state jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare room public.rooms%rowtype; current private.criminal_dances_state%rowtype; roster jsonb; expected_ids text[]; state_ids text[]; next_status text;
begin
  if p_actor_id is null or p_match_id is null or p_action_id is null or pg_catalog.char_length(p_action_id) > 128 then raise exception 'invalid action'; end if;
  select * into room from public.rooms where id = p_room_id for update;
  select * into current from private.criminal_dances_state where room_id = p_room_id for update;
  if not found then raise exception 'game is not initialized'; end if;
  if room.game_type is distinct from 'criminal-dances' or room.status not in ('playing','finished') then raise exception 'game is not active'; end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(room.players) = 'array' then room.players else '[]'::jsonb end) player where player ->> 'userId' = p_actor_id::text) and room.host_id <> p_actor_id then raise exception 'room membership required'; end if;
  if current.match_id is distinct from p_match_id then raise exception 'stale match'; end if;
  if current.state -> 'processedActionIds' ? p_action_id then return current.public_state; end if;
  if room.status <> 'playing' then raise exception 'game is finished'; end if;
  if (current.state ->> 'revision')::integer is distinct from p_expected_revision then raise exception 'stale revision'; end if;
  if pg_catalog.jsonb_typeof(p_state -> 'turnOrder') <> 'array' or pg_catalog.jsonb_typeof(p_public_state -> 'turnOrder') <> 'array' then raise exception 'invalid seat order'; end if;
  select pg_catalog.array_agg(entry.player ->> 'userId' order by entry.ordinality) into expected_ids from pg_catalog.jsonb_array_elements(room.players) with ordinality entry(player, ordinality);
  select pg_catalog.array_agg(value order by ordinality) into state_ids from pg_catalog.jsonb_array_elements_text(p_state -> 'turnOrder') with ordinality;
  if expected_ids is distinct from state_ids then raise exception 'seat order changed'; end if;
  if p_state ->> 'matchId' is distinct from p_match_id or (p_state ->> 'revision')::integer <= p_expected_revision then raise exception 'invalid state revision'; end if;
  next_status := case when p_public_state ->> 'phase' = 'finished' then 'finished' else 'playing' end;
  update private.criminal_dances_state set state = p_state, public_state = p_public_state, updated_at = pg_catalog.now() where room_id = p_room_id;
  update public.rooms set game_state = p_public_state, status = next_status where id = p_room_id;
  return p_public_state;
end;
$fn$;

create or replace function public.criminal_dances_reset_private_state()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if auth.uid() is not null and auth.uid() is distinct from old.host_id then return new; end if;
  if old.status in ('playing','finished') and new.status = 'waiting' and old.game_type = 'criminal-dances' then new.criminal_dances_epoch := old.criminal_dances_epoch + 1; end if;
  if new.game_type = 'criminal-dances' and new.status = 'waiting' and coalesce(new.game_state, '{}'::jsonb) = '{}'::jsonb then
    delete from private.criminal_dances_state where room_id = new.id;
  end if;
  return new;
end;
$fn$;
drop trigger if exists criminal_dances_reset_private_state_trigger on public.rooms;
create trigger criminal_dances_reset_private_state_trigger before update of status, game_state on public.rooms for each row execute function public.criminal_dances_reset_private_state();

create or replace function public.enforce_criminal_dances_player_count()
returns trigger language plpgsql set search_path = '' as $fn$
declare count_players integer;
begin
  if new.status = 'playing' and old.status <> 'playing' and new.game_type = 'criminal-dances' then
    count_players := case when pg_catalog.jsonb_typeof(new.players) = 'array' then pg_catalog.jsonb_array_length(new.players) else 0 end;
    if count_players < 3 or count_players > 8 then raise exception '犯人は踊るは3〜8人で遊べます（現在%人です）', count_players; end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists enforce_criminal_dances_player_count_trigger on public.rooms;
create trigger enforce_criminal_dances_player_count_trigger before update of status on public.rooms for each row execute function public.enforce_criminal_dances_player_count();
revoke execute on function public.enforce_criminal_dances_player_count() from public, anon, authenticated;

create or replace function public.reject_criminal_dances_direct_room_change()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare old_ids text[]; new_ids text[];
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.game_type = 'criminal-dances' and coalesce(new.game_state, '{}'::jsonb) <> '{}'::jsonb then raise exception '犯人は踊るは専用サーバー処理で初期化してください'; end if;
    return new;
  end if;
  if old.game_type <> 'criminal-dances' and new.game_type <> 'criminal-dances' then return new; end if;
  if old.game_type = 'criminal-dances' and old.status in ('playing','finished') and new.status <> 'waiting' then
    if new.game_type is distinct from old.game_type then raise exception '進行中のゲーム識別子は変更できません'; end if;
    select pg_catalog.array_agg(player ->> 'userId' order by ordinality) into old_ids from pg_catalog.jsonb_array_elements(old.players) with ordinality entry(player, ordinality);
    select pg_catalog.array_agg(player ->> 'userId' order by ordinality) into new_ids from pg_catalog.jsonb_array_elements(new.players) with ordinality entry(player, ordinality);
    if old_ids is distinct from new_ids then raise exception '進行中の座席順は変更できません'; end if;
  end if;
  if current_user <> 'authenticated' then return new; end if;
  if old.game_type = 'criminal-dances' and new.criminal_dances_epoch is distinct from old.criminal_dances_epoch and not (old.status in ('playing','finished') and new.status = 'waiting') then raise exception 'ゲーム世代は変更できません'; end if;
  if old.game_type = 'criminal-dances' and old.status in ('playing','finished') then
    if auth.uid() = old.host_id and new.status = 'waiting' and coalesce(new.game_state, '{}'::jsonb) = '{}'::jsonb and new.game_type = old.game_type and new.players = old.players then return new; end if;
    raise exception '犯人は踊るの状態は専用サーバー処理からのみ更新できます';
  end if;
  if new.game_type = 'criminal-dances' and coalesce(new.game_state, '{}'::jsonb) <> '{}'::jsonb then raise exception '犯人は踊るの状態は専用サーバー処理からのみ更新できます'; end if;
  return new;
end;
$fn$;
drop trigger if exists reject_criminal_dances_direct_room_change_trigger on public.rooms;
create trigger reject_criminal_dances_direct_room_change_trigger before insert or update on public.rooms for each row execute function public.reject_criminal_dances_direct_room_change();
revoke execute on function public.reject_criminal_dances_direct_room_change() from public, anon, authenticated, service_role;
revoke all on function public.criminal_dances_reset_private_state() from public, anon, authenticated;
revoke all on function public.criminal_dances_read_state(uuid,uuid) from public, anon, authenticated;
revoke all on function public.criminal_dances_commit_initial(uuid,uuid,text,bigint,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.criminal_dances_commit_action(uuid,uuid,text,integer,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.criminal_dances_read_state(uuid,uuid) to service_role;
grant execute on function public.criminal_dances_commit_initial(uuid,uuid,text,bigint,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.criminal_dances_commit_action(uuid,uuid,text,integer,text,jsonb,jsonb) to service_role;

commit;
