begin;

-- Fake Artist actions that touch both rooms.game_state and game_events must be
-- serialized on the room row. This prevents a turn update from overtaking the
-- stroke insert and keeps undo/reset operations atomic.

create or replace function public.fake_artist_submit_stroke(
  p_room_id uuid,
  p_stroke jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  current_position integer;
  turn_count integer;
  current_lap integer;
  next_lap integer;
  round_limit integer;
  turn_revision integer;
  next_player_id text;
  next_phase text := 'drawing';
  turn_key text;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if pg_catalog.jsonb_typeof(p_stroke) <> 'object'
    or pg_catalog.octet_length(p_stroke::text) > 250000 then
    raise exception 'Invalid stroke data';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not public.is_room_member(p_room_id) then
    raise exception 'Room membership is required';
  end if;

  if target_room.game_type <> 'fake-artist'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'phase' <> 'drawing'
    or target_room.game_state ->> 'currentTurnPlayerId' <> request_user_id::text
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'turnOrder') <> 'array'
    or pg_catalog.jsonb_array_length(target_room.game_state -> 'turnOrder') = 0 then
    raise exception 'Fake Artist is not accepting this stroke';
  end if;

  select entry.ordinality::integer
  into current_position
  from pg_catalog.jsonb_array_elements_text(target_room.game_state -> 'turnOrder')
    with ordinality as entry(player_id, ordinality)
  where entry.player_id = request_user_id::text
  limit 1;

  if current_position is null then
    raise exception 'The current player is not in the turn order';
  end if;

  turn_count := pg_catalog.jsonb_array_length(target_room.game_state -> 'turnOrder');
  current_lap := (target_room.game_state ->> 'currentLap')::integer;
  round_limit := (target_room.game_state #>> '{ruleSettings,roundLimit}')::integer;
  turn_revision := coalesce((target_room.game_state ->> 'turnRevision')::integer, 0);

  if current_lap < 1 or round_limit < 1 then
    raise exception 'Invalid Fake Artist turn settings';
  end if;

  turn_key := current_lap::text || ':' || request_user_id::text || ':' || turn_revision::text;

  if exists (
    select 1
    from public.game_events as existing_event
    where existing_event.room_id = p_room_id
      and existing_event.event_type = 'draw_line'
      and existing_event.payload ->> 'turnKey' = turn_key
  ) then
    raise exception 'A stroke was already submitted for this turn';
  end if;

  if current_position < turn_count then
    next_player_id := target_room.game_state -> 'turnOrder' ->> current_position;
    next_lap := current_lap;
  else
    next_lap := current_lap + 1;
    if next_lap > round_limit then
      next_player_id := null;
      next_phase := 'voting';
    else
      next_player_id := target_room.game_state -> 'turnOrder' ->> 0;
    end if;
  end if;

  insert into public.game_events (room_id, event_type, payload, actor_id)
  values (
    p_room_id,
    'draw_line',
    pg_catalog.jsonb_build_object(
      'playerId', request_user_id::text,
      'stroke', p_stroke,
      'turnKey', turn_key
    ),
    request_user_id
  );

  update public.rooms
  set game_state = target_room.game_state || pg_catalog.jsonb_build_object(
    'currentTurnPlayerId', next_player_id,
    'currentLap', next_lap,
    'phase', next_phase,
    'turnRevision', turn_revision + 1
  )
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
  current_position integer;
  current_lap integer;
  previous_lap integer;
  previous_player_id text;
  turn_revision integer;
  latest_event_id uuid;
  latest_event_payload jsonb;
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

  if target_room.game_type <> 'fake-artist'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'phase' <> 'drawing'
    or target_room.game_state ->> 'currentTurnPlayerId' <> request_user_id::text
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'turnOrder') <> 'array'
    or pg_catalog.jsonb_array_length(target_room.game_state -> 'turnOrder') = 0 then
    raise exception 'Only the current Fake Artist player can undo a stroke';
  end if;

  select entry.ordinality::integer
  into current_position
  from pg_catalog.jsonb_array_elements_text(target_room.game_state -> 'turnOrder')
    with ordinality as entry(player_id, ordinality)
  where entry.player_id = request_user_id::text
  limit 1;

  current_lap := (target_room.game_state ->> 'currentLap')::integer;
  previous_lap := current_lap;

  if current_position > 1 then
    previous_player_id := target_room.game_state -> 'turnOrder' ->> (current_position - 2);
  elsif current_position = 1 and current_lap > 1 then
    previous_lap := current_lap - 1;
    previous_player_id := target_room.game_state -> 'turnOrder'
      ->> (pg_catalog.jsonb_array_length(target_room.game_state -> 'turnOrder') - 1);
  else
    return false;
  end if;

  select event.id, event.payload
  into latest_event_id, latest_event_payload
  from public.game_events as event
  where event.room_id = p_room_id
    and event.event_type = 'draw_line'
  order by event.created_at desc, event.id desc
  limit 1;

  if latest_event_id is null then
    return false;
  end if;

  turn_revision := coalesce((target_room.game_state ->> 'turnRevision')::integer, 0);

  delete from public.game_events
  where id = latest_event_id;

  -- Realtime DELETE payloads do not reliably include the filtered room/event
  -- fields. Emit an INSERT marker so every client removes exactly one stroke.
  insert into public.game_events (room_id, event_type, payload, actor_id)
  values (
    p_room_id,
    'undo_line',
    pg_catalog.jsonb_build_object(
      'targetEventId', latest_event_id,
      'targetTurnKey', latest_event_payload ->> 'turnKey'
    ),
    request_user_id
  );

  update public.rooms
  set game_state = target_room.game_state || pg_catalog.jsonb_build_object(
    'currentTurnPlayerId', previous_player_id,
    'currentLap', previous_lap,
    'turnRevision', turn_revision + 1
  )
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.fake_artist_cast_vote(
  p_room_id uuid,
  p_voted_player_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
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

  if target_room.game_type <> 'fake-artist'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'phase' <> 'voting' then
    raise exception 'Fake Artist is not accepting votes';
  end if;

  if p_voted_player_id is null or p_voted_player_id = request_user_id then
    raise exception 'Players cannot vote for themselves';
  end if;

  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(target_room.players) as player
    where player ->> 'userId' = p_voted_player_id::text
  ) then
    raise exception 'The selected player is not in this room';
  end if;

  if exists (
    select 1
    from public.game_events as existing_event
    where existing_event.room_id = p_room_id
      and existing_event.event_type = 'vote'
      and existing_event.actor_id = request_user_id
  ) then
    raise exception 'This player has already voted';
  end if;

  insert into public.game_events (room_id, event_type, payload, actor_id)
  values (
    p_room_id,
    'vote',
    pg_catalog.jsonb_build_object('votedPlayerId', p_voted_player_id::text),
    request_user_id
  );

  return true;
end;
$function$;

create or replace function public.fake_artist_finalize_voting(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  player_count integer;
  voter_count integer;
  maximum_vote_count integer;
  fake_artist_id text;
  fake_artist_was_selected boolean;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or target_room.host_id <> request_user_id then
    raise exception 'Only the room host can finalize voting';
  end if;

  if target_room.game_type <> 'fake-artist'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'phase' <> 'voting' then
    raise exception 'Fake Artist voting cannot be finalized now';
  end if;

  player_count := pg_catalog.jsonb_array_length(target_room.players);

  select pg_catalog.count(distinct event.actor_id)::integer
  into voter_count
  from public.game_events as event
  where event.room_id = p_room_id
    and event.event_type = 'vote'
    and event.actor_id is not null;

  if voter_count < player_count then
    raise exception 'Not every player has voted';
  end if;

  select role_entry.key
  into fake_artist_id
  from pg_catalog.jsonb_each(target_room.game_state -> 'playerStates') as role_entry(key, value)
  where role_entry.value ->> 'role' = 'fake_artist'
  limit 1;

  if fake_artist_id is null then
    raise exception 'The fake artist is missing from the game state';
  end if;

  select pg_catalog.max(vote_total)::integer
  into maximum_vote_count
  from (
    select pg_catalog.count(*)::integer as vote_total
    from (
      select distinct on (event.actor_id)
        event.actor_id,
        event.payload
      from public.game_events as event
      where event.room_id = p_room_id
        and event.event_type = 'vote'
        and event.actor_id is not null
      order by event.actor_id, event.created_at, event.id
    ) as unique_vote
    group by unique_vote.payload ->> 'votedPlayerId'
  ) as totals;

  select exists (
    select 1
    from (
      select distinct on (event.actor_id)
        event.actor_id,
        event.payload
      from public.game_events as event
      where event.room_id = p_room_id
        and event.event_type = 'vote'
        and event.actor_id is not null
      order by event.actor_id, event.created_at, event.id
    ) as unique_vote
    group by unique_vote.payload ->> 'votedPlayerId'
    having unique_vote.payload ->> 'votedPlayerId' = fake_artist_id
      and pg_catalog.count(*) = maximum_vote_count
  )
  into fake_artist_was_selected;

  if fake_artist_was_selected then
    update public.rooms
    set game_state = target_room.game_state || pg_catalog.jsonb_build_object(
      'phase', 'guessing',
      'winner', null
    )
    where id = p_room_id;
  else
    update public.rooms
    set game_state = target_room.game_state || pg_catalog.jsonb_build_object(
      'phase', 'result',
      'winner', 'fake_artist'
    )
    where id = p_room_id;
  end if;

  return true;
end;
$function$;

create or replace function public.fake_artist_reset_game(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or target_room.host_id <> request_user_id then
    raise exception 'Only the room host can reset Fake Artist';
  end if;

  if target_room.game_type <> 'fake-artist'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'phase' <> 'result' then
    raise exception 'Fake Artist cannot be reset now';
  end if;

  delete from public.game_events
  where room_id = p_room_id;

  update public.rooms
  set game_state = pg_catalog.jsonb_build_object(
    'phase', 'rule_setting',
    'playerStates', pg_catalog.jsonb_build_object(),
    'ruleSettings', pg_catalog.jsonb_build_object(
      'roundLimit', 2,
      'autoThemeSelection', true,
      'questionerDraws', false
    ),
    'themeGenre', null,
    'theme', null,
    'currentTurnPlayerId', null,
    'turnOrder', pg_catalog.jsonb_build_array(),
    'currentLap', 1,
    'turnRevision', 0,
    'votes', pg_catalog.jsonb_build_object(),
    'fakeArtistGuess', null,
    'winner', null
  )
  where id = p_room_id;

  return true;
end;
$function$;

revoke execute on function public.fake_artist_submit_stroke(uuid, jsonb)
from public, anon;
revoke execute on function public.undo_latest_stroke(uuid)
from public, anon;
revoke execute on function public.fake_artist_cast_vote(uuid, uuid)
from public, anon;
revoke execute on function public.fake_artist_finalize_voting(uuid)
from public, anon;
revoke execute on function public.fake_artist_reset_game(uuid)
from public, anon;

grant execute on function public.fake_artist_submit_stroke(uuid, jsonb)
to authenticated;
grant execute on function public.undo_latest_stroke(uuid)
to authenticated;
grant execute on function public.fake_artist_cast_vote(uuid, uuid)
to authenticated;
grant execute on function public.fake_artist_finalize_voting(uuid)
to authenticated;
grant execute on function public.fake_artist_reset_game(uuid)
to authenticated;

commit;
