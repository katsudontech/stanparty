begin;

-- Carbonation, the hidden limit, cumulative shake amounts, and one-shot hints
-- stay outside rooms.game_state. Keep this tuning object in sync with
-- src/games/carbonated-shake/constants.ts; server authority uses this object.
create schema if not exists private;
create table if not exists private.carbonated_shake_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  match_id text not null,
  burst_limit numeric not null check (burst_limit > 0),
  carbonation numeric not null default 0 check (carbonation >= 0),
  turn_amount numeric not null default 0 check (turn_amount >= 0),
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  pending_hint_level integer check (pending_hint_level between 1 and 5),
  pending_hint_turn bigint,
  pending_hint_player uuid,
  pending_hint_expires_at timestamptz,
  display_until timestamptz
);
alter table private.carbonated_shake_state enable row level security;
revoke all on private.carbonated_shake_state from public, anon, authenticated;

create or replace function private.carbonated_shake_tuning()
returns jsonb language sql immutable set search_path = '' as $fn$
  select '{"maxTurnScore":15,"carbonationRate":16,"limitMin":90,"limitMax":110,"pendingHintMs":3000,"hintDisplayMs":700,"dangerThresholds":[0.2,0.4,0.6,0.8],"noiseBuckets":[0.7,0.95],"levels":[{"minimumAmount":1,"score":1},{"minimumAmount":2,"score":3},{"minimumAmount":3,"score":6},{"minimumAmount":4,"score":10},{"minimumAmount":5,"score":15}]}'::jsonb;
$fn$;

create or replace function private.carbonated_shake_max_amount()
returns numeric language sql immutable set search_path = '' as $fn$
  select coalesce(min((level ->> 'minimumAmount')::numeric) filter (where (level ->> 'score')::integer >= (private.carbonated_shake_tuning() ->> 'maxTurnScore')::integer), 0)
  from pg_catalog.jsonb_array_elements(private.carbonated_shake_tuning() -> 'levels') level;
$fn$;

create or replace function private.carbonated_shake_level_count()
returns integer language sql immutable set search_path = '' as $fn$
  select pg_catalog.jsonb_array_length(private.carbonated_shake_tuning() -> 'dangerThresholds') + 1;
$fn$;

create or replace function public.carbonated_shake_score_for_amount(p_amount numeric)
returns integer language sql immutable set search_path = '' as $fn$
  select least((private.carbonated_shake_tuning() ->> 'maxTurnScore')::integer, coalesce(max((level ->> 'score')::integer) filter (where greatest(0, least(private.carbonated_shake_max_amount(), coalesce(p_amount, 0))) >= (level ->> 'minimumAmount')::numeric), 0))
  from pg_catalog.jsonb_array_elements(private.carbonated_shake_tuning() -> 'levels') level;
$fn$;

create or replace function public.carbonated_shake_is_member(p_room_id uuid, p_actor uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.rooms room
    where room.id = p_room_id and (
      room.host_id = p_actor
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(
          case when pg_catalog.jsonb_typeof(room.players) = 'array' then room.players else '[]'::jsonb end
        ) player where player ->> 'userId' = p_actor::text
      )
    )
  );
$fn$;

create or replace function public.carbonated_shake_noisy_danger(p_carbonation numeric, p_limit numeric)
returns integer language plpgsql volatile set search_path = '' as $fn$
declare
  base_level integer := 1;
  bucket numeric;
  offset_amount integer := 0;
  threshold jsonb;
  tuning jsonb := private.carbonated_shake_tuning();
begin
  for threshold in select value from pg_catalog.jsonb_array_elements(tuning -> 'dangerThresholds') loop
    if p_carbonation / p_limit >= (threshold #>> '{}')::numeric then base_level := base_level + 1; end if;
  end loop;
  bucket := pg_catalog.random();
  if bucket >= (tuning #>> '{noiseBuckets,0}')::numeric and bucket < (tuning #>> '{noiseBuckets,1}')::numeric then offset_amount := 1;
  elsif bucket >= (tuning #>> '{noiseBuckets,1}')::numeric then offset_amount := 2;
  end if;
  if offset_amount > 0 and pg_catalog.random() < .5 then offset_amount := -offset_amount; end if;
  return greatest(1, least(private.carbonated_shake_level_count(), base_level + offset_amount));
end;
$fn$;

create or replace function public.carbonated_shake_initialize(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor uuid := (select auth.uid());
  room public.rooms%rowtype;
  ids text[];
  scores jsonb;
  state jsonb;
  match text := gen_random_uuid()::text;
begin
  if actor is null then raise exception '認証が必要です'; end if;
  select * into room from public.rooms where id = p_room_id for update;
  if not found or room.game_type is distinct from 'carbonated-shake' or room.status is distinct from 'playing' or room.host_id <> actor then
    raise exception 'ホストだけが炭酸シェイクを開始できます';
  end if;
  if pg_catalog.jsonb_typeof(room.players) <> 'array' or pg_catalog.jsonb_array_length(room.players) not between 2 and 14 then
    raise exception '2〜14人で遊んでください';
  end if;
  if room.game_state is not null and room.game_state <> '{}'::jsonb and room.game_state ->> 'game' is not distinct from 'carbonated-shake' then
    raise exception 'このゲームはすでに開始しています';
  end if;
  select pg_catalog.array_agg(player ->> 'userId' order by pg_catalog.random()) into ids
  from pg_catalog.jsonb_array_elements(room.players) player;
  if not (actor::text = any(ids)) or (select count(distinct id) from pg_catalog.unnest(ids) id) <> pg_catalog.cardinality(ids) then
    raise exception '参加プレイヤーを確認してください';
  end if;
  select pg_catalog.jsonb_object_agg(id, pg_catalog.jsonb_build_object('totalScore', 0, 'turnScore', 0)) into scores
  from pg_catalog.unnest(ids) id;
  state := pg_catalog.jsonb_build_object(
    'game', 'carbonated-shake', 'version', 1, 'matchId', match, 'stateRevision', 0,
    'phase', 'shaking', 'turnOrder', pg_catalog.to_jsonb(ids), 'turnIndex', 0,
    'turnNumber', 1, 'currentPlayerId', ids[1], 'scores', scores,
    'displayUntil', null, 'pendingHintDeadline', null, 'burstPlayerId', null
  );
  insert into private.carbonated_shake_state(room_id, match_id, burst_limit)
    values (p_room_id, match, (private.carbonated_shake_tuning() ->> 'limitMin')::numeric + pg_catalog.random() * ((private.carbonated_shake_tuning() ->> 'limitMax')::numeric - (private.carbonated_shake_tuning() ->> 'limitMin')::numeric))
    on conflict (room_id) do update set match_id=excluded.match_id, burst_limit=excluded.burst_limit,
      carbonation=0, turn_amount=0, last_sequence=0, pending_hint_level=null,
      pending_hint_turn=null, pending_hint_player=null, pending_hint_expires_at=null, display_until=null;
  update public.rooms set game_state = state where id = p_room_id;
  return state;
end;
$fn$;

create or replace function public.carbonated_shake_apply_shake(
  p_room_id uuid, p_match_id text, p_turn_number bigint, p_sequence bigint, p_total_shake_amount numeric
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  actor uuid := (select auth.uid()); room public.rooms%rowtype; state jsonb; secret private.carbonated_shake_state%rowtype;
  capped numeric; delta numeric; new_carbonation numeric; score integer; scores jsonb; danger integer;
begin
  if actor is null or p_match_id is null or p_turn_number is null or p_sequence is null or p_total_shake_amount is null or p_sequence < 1 or p_total_shake_amount < 0 then raise exception '無効なシェイク量です'; end if;
  select * into room from public.rooms where id=p_room_id for update; state:=room.game_state;
  select * into secret from private.carbonated_shake_state where room_id=p_room_id for update;
  if room.game_type is distinct from 'carbonated-shake' or room.status is distinct from 'playing' or not public.carbonated_shake_is_member(p_room_id,actor)
    or state->>'game' is distinct from 'carbonated-shake' or state->>'matchId' is distinct from p_match_id
    or (state->>'turnNumber')::bigint is distinct from p_turn_number or state->>'phase' is distinct from 'shaking'
    or state->>'currentPlayerId' is distinct from actor::text then raise exception 'いまはシェイクできません'; end if;
  if p_sequence <= secret.last_sequence then return state; end if;
  if p_total_shake_amount < secret.turn_amount then raise exception '古いシェイク量です'; end if;
  capped := greatest(0, least(private.carbonated_shake_max_amount(), p_total_shake_amount));
  delta := greatest(0, capped-secret.turn_amount);
  new_carbonation := secret.carbonation + delta*(private.carbonated_shake_tuning() ->> 'carbonationRate')::numeric;
  score := public.carbonated_shake_score_for_amount(capped);
  secret.turn_amount := capped; secret.last_sequence := p_sequence;
  scores := pg_catalog.jsonb_set(state, array['scores',actor::text,'turnScore'], pg_catalog.to_jsonb(score), true);
  if new_carbonation > secret.burst_limit then
    scores := pg_catalog.jsonb_set(scores, array['scores',actor::text,'totalScore'], '-999'::jsonb, true);
    scores := pg_catalog.jsonb_set(scores, array['scores',actor::text,'turnScore'], '-999'::jsonb, true);
    state := scores || pg_catalog.jsonb_build_object('phase','finished','burstPlayerId',actor::text,'pendingHintDeadline',null,'displayUntil',null,'stateRevision',coalesce((state->>'stateRevision')::integer,0)+1);
    update private.carbonated_shake_state set carbonation=new_carbonation,turn_amount=secret.turn_amount,last_sequence=secret.last_sequence,pending_hint_level=null,pending_hint_expires_at=null,display_until=null where room_id=p_room_id;
    update public.rooms set game_state=state where id=p_room_id; return state;
  end if;
  if score >= (private.carbonated_shake_tuning() ->> 'maxTurnScore')::integer then
    scores := pg_catalog.jsonb_set(scores, array['scores',actor::text,'totalScore'], pg_catalog.to_jsonb((state #>> array['scores',actor::text,'totalScore'])::integer + score), true);
    danger := public.carbonated_shake_noisy_danger(new_carbonation, secret.burst_limit);
    state := scores || pg_catalog.jsonb_build_object('phase','hint_pending','pendingHintDeadline',(pg_catalog.now()+((private.carbonated_shake_tuning() ->> 'pendingHintMs')::numeric / 1000) * interval '1 second'),'displayUntil',null,'stateRevision',coalesce((state->>'stateRevision')::integer,0)+1);
    update private.carbonated_shake_state set carbonation=new_carbonation,turn_amount=secret.turn_amount,last_sequence=secret.last_sequence,pending_hint_level=danger,pending_hint_turn=p_turn_number,pending_hint_player=actor,pending_hint_expires_at=pg_catalog.now()+((private.carbonated_shake_tuning() ->> 'pendingHintMs')::numeric / 1000) * interval '1 second' where room_id=p_room_id;
  else
    state := scores || pg_catalog.jsonb_build_object('stateRevision',coalesce((state->>'stateRevision')::integer,0)+1);
    update private.carbonated_shake_state set carbonation=new_carbonation,turn_amount=secret.turn_amount,last_sequence=secret.last_sequence where room_id=p_room_id;
  end if;
  update public.rooms set game_state=state where id=p_room_id; return state;
end;
$fn$;

create or replace function public.carbonated_shake_finish_turn(p_room_id uuid, p_match_id text, p_turn_number bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := (select auth.uid()); room public.rooms%rowtype; state jsonb; secret private.carbonated_shake_state%rowtype; danger integer; score integer;
begin
  select * into room from public.rooms where id=p_room_id for update; state:=room.game_state;
  select * into secret from private.carbonated_shake_state where room_id=p_room_id for update;
  if actor is null or room.game_type is distinct from 'carbonated-shake' or room.status is distinct from 'playing' or not public.carbonated_shake_is_member(p_room_id,actor)
    or state->>'matchId' is distinct from p_match_id or (state->>'turnNumber')::bigint is distinct from p_turn_number or state->>'currentPlayerId' is distinct from actor::text then raise exception 'このターンを終了できません'; end if;
  if state->>'phase' = 'hint_pending' or state->>'phase' = 'hint_display' then return state; end if;
  if state->>'phase' is distinct from 'shaking' then raise exception 'このターンを終了できません'; end if;
  score := public.carbonated_shake_score_for_amount(secret.turn_amount);
  state := pg_catalog.jsonb_set(state, array['scores',actor::text,'totalScore'], pg_catalog.to_jsonb((state #>> array['scores',actor::text,'totalScore'])::integer + score), true);
  danger := public.carbonated_shake_noisy_danger(secret.carbonation, secret.burst_limit);
  state := pg_catalog.jsonb_set(state, array['scores',actor::text,'turnScore'], pg_catalog.to_jsonb(score), true)
    || pg_catalog.jsonb_build_object('phase','hint_pending','pendingHintDeadline',(pg_catalog.now()+((private.carbonated_shake_tuning() ->> 'pendingHintMs')::numeric / 1000) * interval '1 second'),'displayUntil',null,'stateRevision',coalesce((state->>'stateRevision')::integer,0)+1);
  update private.carbonated_shake_state set pending_hint_level=danger,pending_hint_turn=p_turn_number,pending_hint_player=actor,pending_hint_expires_at=pg_catalog.now()+((private.carbonated_shake_tuning() ->> 'pendingHintMs')::numeric / 1000) * interval '1 second' where room_id=p_room_id;
  update public.rooms set game_state=state where id=p_room_id; return state;
end;
$fn$;

create or replace function public.carbonated_shake_consume_hint(p_room_id uuid, p_match_id text, p_turn_number bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := (select auth.uid()); room public.rooms%rowtype; state jsonb; secret private.carbonated_shake_state%rowtype; level integer;
begin
  select * into room from public.rooms where id=p_room_id for update; state:=room.game_state;
  select * into secret from private.carbonated_shake_state where room_id=p_room_id for update;
  if actor is null or room.game_type is distinct from 'carbonated-shake' or room.status is distinct from 'playing' or not public.carbonated_shake_is_member(p_room_id,actor)
    or state->>'matchId' is distinct from p_match_id or (state->>'turnNumber')::bigint is distinct from p_turn_number
    or state->>'currentPlayerId' is distinct from actor::text then raise exception '危険度を表示できません'; end if;
  if state->>'phase' is distinct from 'hint_pending' then return null; end if;
  if secret.pending_hint_level is null then return null; end if;
  if secret.pending_hint_expires_at <= pg_catalog.now() then
    update private.carbonated_shake_state set pending_hint_level=null,pending_hint_turn=null,pending_hint_player=null,pending_hint_expires_at=null where room_id=p_room_id;
    update public.rooms set game_state=state || pg_catalog.jsonb_build_object('pendingHintDeadline',null,'stateRevision',coalesce((state->>'stateRevision')::integer,0)+1) where id=p_room_id;
    return null;
  end if;
  level := secret.pending_hint_level;
  update private.carbonated_shake_state set pending_hint_level=null,pending_hint_turn=null,pending_hint_expires_at=null,display_until=pg_catalog.now()+((private.carbonated_shake_tuning() ->> 'hintDisplayMs')::numeric / 1000) * interval '1 second' where room_id=p_room_id;
  state := state || pg_catalog.jsonb_build_object('phase','hint_display','pendingHintDeadline',null,'displayUntil',(pg_catalog.now()+((private.carbonated_shake_tuning() ->> 'hintDisplayMs')::numeric / 1000) * interval '1 second'),'stateRevision',coalesce((state->>'stateRevision')::integer,0)+1);
  update public.rooms set game_state=state where id=p_room_id;
  return pg_catalog.jsonb_build_object('level',level,'matchId',p_match_id,'turnNumber',p_turn_number);
end;
$fn$;

create or replace function public.carbonated_shake_advance_turn(p_room_id uuid, p_match_id text, p_turn_number bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := (select auth.uid()); room public.rooms%rowtype; state jsonb; secret private.carbonated_shake_state%rowtype; next_index integer; next_id text;
begin
  select * into room from public.rooms where id=p_room_id for update; state:=room.game_state;
  select * into secret from private.carbonated_shake_state where room_id=p_room_id for update;
  if actor is null or room.game_type is distinct from 'carbonated-shake' or room.status is distinct from 'playing' or not public.carbonated_shake_is_member(p_room_id,actor)
    or state->>'matchId' is distinct from p_match_id or (state->>'turnNumber')::bigint is distinct from p_turn_number then raise exception 'ターンを進められません'; end if;
  if state->>'phase' = 'hint_display' then
    if secret.display_until is null or (secret.pending_hint_player = actor and secret.display_until > pg_catalog.now())
      or (secret.pending_hint_player is distinct from actor and secret.display_until + (((private.carbonated_shake_tuning() ->> 'pendingHintMs')::numeric - (private.carbonated_shake_tuning() ->> 'hintDisplayMs')::numeric) / 1000) * interval '1 second' > pg_catalog.now()) then raise exception '危険度演出中です'; end if;
  elsif state->>'phase' = 'hint_pending' then
    if secret.pending_hint_level is not null and secret.pending_hint_expires_at > pg_catalog.now() then raise exception '危険度の確認を待っています'; end if;
    update private.carbonated_shake_state set pending_hint_level=null,pending_hint_turn=null,pending_hint_player=null,pending_hint_expires_at=null where room_id=p_room_id;
  else raise exception 'ターンを進められません'; end if;
  next_index := ((state->>'turnIndex')::integer + 1) % pg_catalog.jsonb_array_length(state->'turnOrder');
  next_id := state->'turnOrder'->>next_index;
  state := state || pg_catalog.jsonb_build_object('phase','shaking','turnIndex',next_index,'turnNumber',(state->>'turnNumber')::bigint+1,'currentPlayerId',next_id,'displayUntil',null,'pendingHintDeadline',null,'stateRevision',coalesce((state->>'stateRevision')::integer,0)+1);
  state := pg_catalog.jsonb_set(state, array['scores',next_id,'turnScore'], '0'::jsonb, true);
  update private.carbonated_shake_state set turn_amount=0,last_sequence=0,display_until=null where room_id=p_room_id;
  update public.rooms set game_state=state where id=p_room_id; return state;
end;
$fn$;

revoke all on function public.carbonated_shake_score_for_amount(numeric) from public, anon, authenticated;
revoke all on function private.carbonated_shake_tuning() from public, anon, authenticated;
revoke all on function private.carbonated_shake_max_amount() from public, anon, authenticated;
revoke all on function private.carbonated_shake_level_count() from public, anon, authenticated;
revoke all on function public.carbonated_shake_is_member(uuid,uuid) from public, anon, authenticated;
revoke all on function public.carbonated_shake_noisy_danger(numeric,numeric) from public, anon, authenticated;
revoke all on function public.carbonated_shake_initialize(uuid) from public, anon, authenticated;
revoke all on function public.carbonated_shake_apply_shake(uuid,text,bigint,bigint,numeric) from public, anon, authenticated;
revoke all on function public.carbonated_shake_finish_turn(uuid,text,bigint) from public, anon, authenticated;
revoke all on function public.carbonated_shake_consume_hint(uuid,text,bigint) from public, anon, authenticated;
revoke all on function public.carbonated_shake_advance_turn(uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.carbonated_shake_initialize(uuid) to authenticated;
grant execute on function public.carbonated_shake_apply_shake(uuid,text,bigint,bigint,numeric) to authenticated;
grant execute on function public.carbonated_shake_finish_turn(uuid,text,bigint) to authenticated;
grant execute on function public.carbonated_shake_consume_hint(uuid,text,bigint) to authenticated;
grant execute on function public.carbonated_shake_advance_turn(uuid,text,bigint) to authenticated;

commit;
