begin;

create or replace function public.jsonb_changed_only(
  p_old_state jsonb,
  p_new_state jsonb,
  p_allowed_keys text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    (coalesce(p_old_state, '{}'::jsonb) - p_allowed_keys)
    =
    (coalesce(p_new_state, '{}'::jsonb) - p_allowed_keys);
$function$;

create or replace function public.can_update_fake_artist_game_state(
  p_old_state jsonb,
  p_new_state jsonb,
  p_user_id uuid,
  p_host_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  old_phase text;
  new_phase text;
  player_role text;
  fake_artist_id text;
  judge_id text;
  current_position integer;
  turn_count integer;
  old_lap integer;
  new_lap integer;
  round_limit integer;
  expected_next_player text;
begin
  if p_user_id is null
    or pg_catalog.jsonb_typeof(p_old_state) <> 'object'
    or pg_catalog.jsonb_typeof(p_new_state) <> 'object' then
    return false;
  end if;

  old_phase := p_old_state ->> 'phase';
  new_phase := p_new_state ->> 'phase';
  player_role := p_old_state #>> array['playerStates', p_user_id::text, 'role'];

  -- A manually selected questioner may set the theme and enter drawing.
  if old_phase = 'theme_selection'
    and player_role = 'questioner'
    and p_old_state #> '{ruleSettings,autoThemeSelection}' = 'false'::jsonb then
    return public.jsonb_changed_only(
      p_old_state,
      p_new_state,
      array['themeGenre', 'theme', 'phase']
    )
      and new_phase in ('theme_selection', 'drawing')
      and coalesce(pg_catalog.btrim(p_new_state ->> 'themeGenre'), '') <> ''
      and coalesce(pg_catalog.btrim(p_new_state ->> 'theme'), '') <> '';
  end if;

  -- Only the current drawing player may advance exactly one turn.
  if old_phase = 'drawing'
    and p_old_state ->> 'currentTurnPlayerId' = p_user_id::text then
    if not public.jsonb_changed_only(
      p_old_state,
      p_new_state,
      array['currentTurnPlayerId', 'currentLap', 'phase']
    ) then
      return false;
    end if;

    if pg_catalog.jsonb_typeof(p_old_state -> 'turnOrder') <> 'array'
      or pg_catalog.jsonb_array_length(p_old_state -> 'turnOrder') = 0 then
      return false;
    end if;

    select entry.ordinality::integer
    into current_position
    from pg_catalog.jsonb_array_elements_text(p_old_state -> 'turnOrder')
      with ordinality as entry(player_id, ordinality)
    where entry.player_id = p_user_id::text
    limit 1;

    if current_position is null then
      return false;
    end if;

    turn_count := pg_catalog.jsonb_array_length(p_old_state -> 'turnOrder');
    old_lap := (p_old_state ->> 'currentLap')::integer;
    new_lap := (p_new_state ->> 'currentLap')::integer;
    round_limit := (p_old_state #>> '{ruleSettings,roundLimit}')::integer;

    if current_position < turn_count then
      expected_next_player := p_old_state -> 'turnOrder' ->> current_position;
      return new_phase = 'drawing'
        and new_lap = old_lap
        and p_new_state ->> 'currentTurnPlayerId' = expected_next_player;
    end if;

    if old_lap + 1 > round_limit then
      return new_phase = 'voting'
        and new_lap = old_lap + 1
        and p_new_state ->> 'currentTurnPlayerId' is null;
    end if;

    return new_phase = 'drawing'
      and new_lap = old_lap + 1
      and p_new_state ->> 'currentTurnPlayerId' = p_old_state -> 'turnOrder' ->> 0;
  end if;

  -- Only the fake artist may submit the one guess.
  if old_phase = 'guessing'
    and player_role = 'fake_artist'
    and p_old_state ->> 'fakeArtistGuess' is null
    and public.jsonb_changed_only(
      p_old_state,
      p_new_state,
      array['fakeArtistGuess']
    ) then
    return new_phase = 'guessing'
      and coalesce(pg_catalog.btrim(p_new_state ->> 'fakeArtistGuess'), '') <> ''
      and pg_catalog.char_length(p_new_state ->> 'fakeArtistGuess') <= 500;
  end if;

  -- The host judges, unless the host is the fake artist; then the first
  -- non-fake player in turn order becomes the judge, matching the current UI.
  if old_phase = 'guessing'
    and p_old_state ->> 'fakeArtistGuess' is not null then
    select role_entry.key
    into fake_artist_id
    from pg_catalog.jsonb_each(p_old_state -> 'playerStates') as role_entry(key, value)
    where role_entry.value ->> 'role' = 'fake_artist'
    limit 1;

    judge_id := p_host_id::text;
    if judge_id = fake_artist_id then
      select turn_entry.player_id
      into judge_id
      from pg_catalog.jsonb_array_elements_text(p_old_state -> 'turnOrder')
        with ordinality as turn_entry(player_id, ordinality)
      where turn_entry.player_id <> fake_artist_id
      order by turn_entry.ordinality
      limit 1;
    end if;

    return judge_id = p_user_id::text
      and public.jsonb_changed_only(
        p_old_state,
        p_new_state,
        array['phase', 'winner']
      )
      and new_phase = 'result'
      and p_new_state ->> 'winner' in ('artists', 'fake_artist');
  end if;

  return false;
end;
$function$;

create or replace function public.can_update_coyote_game_state(
  p_old_state jsonb,
  p_new_state jsonb,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  old_phase text;
  new_phase text;
  caller_hp integer;
  player_entry record;
  new_player_state jsonb;
  old_hp integer;
  new_hp integer;
  hp_change_count integer := 0;
  alive_count integer := 0;
  expected_winner_id text := '';
begin
  if p_user_id is null
    or pg_catalog.jsonb_typeof(p_old_state) <> 'object'
    or pg_catalog.jsonb_typeof(p_new_state) <> 'object' then
    return false;
  end if;

  old_phase := p_old_state ->> 'phase';
  new_phase := p_new_state ->> 'phase';

  -- Any living player may call Coyote only as themself.
  if old_phase = 'playing' then
    if pg_catalog.jsonb_typeof(
      p_old_state #> array['coyotePlayers', p_user_id::text, 'hp']
    ) <> 'number' then
      return false;
    end if;

    caller_hp := (p_old_state #>> array['coyotePlayers', p_user_id::text, 'hp'])::integer;

    return caller_hp > 0
      and new_phase = 'coyote_called'
      and p_new_state ->> 'coyoteCallerId' = p_user_id::text
      and pg_catalog.jsonb_typeof(p_new_state -> 'coyoteTotalValue') = 'number'
      and public.jsonb_changed_only(
        p_old_state,
        p_new_state,
        array['phase', 'coyoteCallerId', 'coyoteTotalValue', 'questionRevealedCard']
      );
  end if;

  -- Only the player who called Coyote may resolve the loser and next round.
  if old_phase <> 'coyote_called'
    or p_old_state ->> 'coyoteCallerId' <> p_user_id::text
    or new_phase not in ('playing', 'result')
    or not public.jsonb_changed_only(
      p_old_state,
      p_new_state,
      array[
        'phase',
        'coyotePlayers',
        'currentDeck',
        'coyoteCallerId',
        'coyoteTotalValue',
        'questionRevealedCard',
        'winnerId'
      ]
    )
    or pg_catalog.jsonb_typeof(p_old_state -> 'coyotePlayers') <> 'object'
    or pg_catalog.jsonb_typeof(p_new_state -> 'coyotePlayers') <> 'object'
    or exists (
      select 1
      from pg_catalog.jsonb_object_keys(
        p_new_state -> 'coyotePlayers'
      ) as new_player_key(player_id)
      where not (
        (p_old_state -> 'coyotePlayers') ? new_player_key.player_id
      )
    ) then
    return false;
  end if;

  for player_entry in
    select entry.key, entry.value
    from pg_catalog.jsonb_each(p_old_state -> 'coyotePlayers') as entry(key, value)
  loop
    new_player_state := p_new_state -> 'coyotePlayers' -> player_entry.key;

    if pg_catalog.jsonb_typeof(new_player_state) <> 'object'
      or pg_catalog.jsonb_typeof(player_entry.value -> 'hp') <> 'number'
      or pg_catalog.jsonb_typeof(new_player_state -> 'hp') <> 'number'
      or pg_catalog.jsonb_typeof(new_player_state -> 'currentCard') <> 'string'
      or (player_entry.value - array['hp', 'currentCard'])
        <> (new_player_state - array['hp', 'currentCard']) then
      return false;
    end if;

    old_hp := (player_entry.value ->> 'hp')::integer;
    new_hp := (new_player_state ->> 'hp')::integer;

    if new_hp <> old_hp then
      if old_hp <= 0 or new_hp <> greatest(0, old_hp - 1) then
        return false;
      end if;
      hp_change_count := hp_change_count + 1;
    end if;

    if new_hp > 0 then
      alive_count := alive_count + 1;
      expected_winner_id := player_entry.key;
    end if;
  end loop;

  if hp_change_count <> 1 then
    return false;
  end if;

  if new_phase = 'result' then
    return alive_count <= 1
      and p_new_state ->> 'winnerId' = case
        when alive_count = 1 then expected_winner_id
        else ''
      end;
  end if;

  return alive_count > 1
    and pg_catalog.jsonb_typeof(p_new_state -> 'currentDeck') = 'array'
    and p_new_state ->> 'coyoteCallerId' is null
    and p_new_state ->> 'coyoteTotalValue' is null
    and p_new_state ->> 'questionRevealedCard' is null;
end;
$function$;

create or replace function public.enforce_room_update_permissions()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  game_update_is_allowed boolean := false;
begin
  -- Trusted security-definer RPCs from the previous migration run as their owner.
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

    if new.game_state is distinct from old.game_state then
      if old.game_type = 'fake-artist' then
        game_update_is_allowed := public.can_update_fake_artist_game_state(
          old.game_state,
          new.game_state,
          request_user_id,
          old.host_id
        );
      elsif old.game_type = 'coyote' then
        game_update_is_allowed := public.can_update_coyote_game_state(
          old.game_state,
          new.game_state,
          request_user_id
        );
      end if;

      if not game_update_is_allowed then
        raise exception 'This player cannot perform the requested game action';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_game_event_insert_permissions()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if request_user_id is null or new.actor_id is distinct from request_user_id then
    raise exception 'The authenticated event actor is required';
  end if;

  select *
  into target_room
  from public.rooms
  where id = new.room_id;

  if not found or not public.is_room_member(new.room_id) then
    raise exception 'Room membership is required';
  end if;

  if new.event_type = 'draw_line' then
    if target_room.game_type <> 'fake-artist'
      or target_room.status <> 'playing'
      or target_room.game_state ->> 'phase' <> 'drawing'
      or target_room.game_state ->> 'currentTurnPlayerId' <> request_user_id::text
      or new.payload ->> 'playerId' <> request_user_id::text then
      raise exception 'Only the current drawing player can add a stroke';
    end if;
    return new;
  end if;

  if new.event_type = 'vote' then
    if target_room.game_type <> 'fake-artist'
      or target_room.status <> 'playing'
      or target_room.game_state ->> 'phase' <> 'voting'
      or not exists (
        select 1
        from pg_catalog.jsonb_array_elements(target_room.players) as player
        where player ->> 'userId' = new.payload ->> 'votedPlayerId'
      )
      or exists (
        select 1
        from public.game_events as existing_event
        where existing_event.room_id = new.room_id
          and existing_event.event_type = 'vote'
          and existing_event.actor_id = request_user_id
      ) then
      raise exception 'This vote is not allowed';
    end if;
    return new;
  end if;

  raise exception 'Unsupported game event type';
end;
$function$;

drop trigger if exists enforce_game_event_insert_permissions_trigger on public.game_events;
create trigger enforce_game_event_insert_permissions_trigger
before insert on public.game_events
for each row execute function public.enforce_game_event_insert_permissions();

drop policy if exists game_events_delete_actor_or_host on public.game_events;
drop policy if exists game_events_delete_host on public.game_events;
create policy game_events_delete_host
on public.game_events for delete
to authenticated
using (public.is_room_host(room_id));

revoke execute on function public.jsonb_changed_only(jsonb, jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.can_update_fake_artist_game_state(jsonb, jsonb, uuid, uuid) from public, anon;
revoke execute on function public.can_update_coyote_game_state(jsonb, jsonb, uuid) from public, anon;
revoke execute on function public.enforce_game_event_insert_permissions() from public, anon, authenticated;

grant execute on function public.can_update_fake_artist_game_state(jsonb, jsonb, uuid, uuid) to authenticated;
grant execute on function public.can_update_coyote_game_state(jsonb, jsonb, uuid) to authenticated;

commit;
