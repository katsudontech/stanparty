begin;

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
  finalized_votes jsonb;
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

  -- Persist exactly the first vote per actor used by the existing tally above.
  select coalesce(pg_catalog.jsonb_object_agg(
    unique_vote.actor_id::text, unique_vote.payload ->> 'votedPlayerId'
  ), '{}'::jsonb)
  into finalized_votes
  from (
    select distinct on (event.actor_id) event.actor_id, event.payload
    from public.game_events as event
    where event.room_id = p_room_id
      and event.event_type = 'vote'
      and event.actor_id is not null
    order by event.actor_id, event.created_at, event.id
  ) as unique_vote;

  if fake_artist_was_selected then
    update public.rooms
    set game_state = target_room.game_state || pg_catalog.jsonb_build_object(
      'votes', finalized_votes,
      'phase', 'guessing',
      'winner', null
    )
    where id = p_room_id;
  else
    update public.rooms
    set game_state = target_room.game_state || pg_catalog.jsonb_build_object(
      'votes', finalized_votes,
      'phase', 'result',
      'winner', 'fake_artist'
    )
    where id = p_room_id;
  end if;

  return true;
end;
$function$;

revoke execute on function public.fake_artist_finalize_voting(uuid) from public, anon;
grant execute on function public.fake_artist_finalize_voting(uuid) to authenticated;

commit;
