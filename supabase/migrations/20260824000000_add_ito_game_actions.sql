begin;

-- ito keeps its complete state in rooms.game_state, like the existing games.
-- These RPCs serialize player actions with a row lock and only allow changes
-- that are valid during the arranging phase.

create or replace function public.ito_set_card_hint(
  p_room_id uuid,
  p_card_id text,
  p_hint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  target_card jsonb;
  updated_cards jsonb;
  normalized_hint text := pg_catalog.btrim(coalesce(p_hint, ''));
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if pg_catalog.char_length(normalized_hint) > 100 then
    raise exception 'The hint must be 100 characters or fewer';
  end if;

  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or not public.is_room_member(p_room_id) then
    raise exception 'Room membership is required';
  end if;

  if target_room.game_type <> 'ito'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'game' <> 'ito'
    or target_room.game_state ->> 'phase' <> 'arranging'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'cards') <> 'array' then
    raise exception 'ito is not accepting card actions';
  end if;

  select entry.card
  into target_card
  from pg_catalog.jsonb_array_elements(target_room.game_state -> 'cards')
    as entry(card)
  where entry.card ->> 'id' = p_card_id
  limit 1;

  if target_card is null or target_card ->> 'ownerId' <> request_user_id::text then
    raise exception 'Only the card owner can update its hint';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      case
        when entry.card ->> 'id' = p_card_id
          then pg_catalog.jsonb_set(
            entry.card,
            '{hint}',
            pg_catalog.to_jsonb(normalized_hint),
            true
          )
        else entry.card
      end
      order by entry.ordinality
    ),
    '[]'::jsonb
  )
  into updated_cards
  from pg_catalog.jsonb_array_elements(target_room.game_state -> 'cards')
    with ordinality as entry(card, ordinality);

  update public.rooms
  set game_state = pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(target_room.game_state, '{cards}', updated_cards, true),
    '{readyPlayerIds}',
    '[]'::jsonb,
    true
  )
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.ito_move_card(
  p_room_id uuid,
  p_card_id text,
  p_target_index integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  target_card jsonb;
  order_without_card jsonb;
  next_order jsonb;
  order_length integer;
  card_is_placed boolean;
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

  if target_room.game_type <> 'ito'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'game' <> 'ito'
    or target_room.game_state ->> 'phase' <> 'arranging'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'cards') <> 'array'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'cardOrder') <> 'array' then
    raise exception 'ito is not accepting card actions';
  end if;

  select entry.card
  into target_card
  from pg_catalog.jsonb_array_elements(target_room.game_state -> 'cards')
    as entry(card)
  where entry.card ->> 'id' = p_card_id
  limit 1;

  if target_card is null then
    raise exception 'Card not found';
  end if;

  select exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(target_room.game_state -> 'cardOrder')
      as ordered(card_id)
    where ordered.card_id = p_card_id
  )
  into card_is_placed;

  if not card_is_placed and target_card ->> 'ownerId' <> request_user_id::text then
    raise exception 'Only the owner can place an unplaced card';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(ordered.card_id order by ordered.ordinality),
    '[]'::jsonb
  )
  into order_without_card
  from pg_catalog.jsonb_array_elements_text(target_room.game_state -> 'cardOrder')
    with ordinality as ordered(card_id, ordinality)
  where ordered.card_id <> p_card_id;

  order_length := pg_catalog.jsonb_array_length(order_without_card);
  if p_target_index is null or p_target_index < 0 or p_target_index > order_length then
    raise exception 'Invalid card position';
  end if;

  select pg_catalog.jsonb_agg(positioned.card_id order by positioned.sort_index)
  into next_order
  from (
    select
      ordered.card_id,
      case
        when ordered.ordinality - 1 < p_target_index then ordered.ordinality - 1
        else ordered.ordinality
      end as sort_index
    from pg_catalog.jsonb_array_elements_text(order_without_card)
      with ordinality as ordered(card_id, ordinality)

    union all

    select p_card_id, p_target_index
  ) as positioned;

  update public.rooms
  set game_state = pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(target_room.game_state, '{cardOrder}', next_order, true),
    '{readyPlayerIds}',
    '[]'::jsonb,
    true
  )
  where id = p_room_id;

  return true;
end;
$function$;

create or replace function public.ito_set_ready(
  p_room_id uuid,
  p_is_ready boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  ready_without_player jsonb;
  next_ready_players jsonb;
  card_count integer;
  placed_card_count integer;
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

  if target_room.game_type <> 'ito'
    or target_room.status <> 'playing'
    or target_room.game_state ->> 'game' <> 'ito'
    or target_room.game_state ->> 'phase' <> 'arranging'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'cards') <> 'array'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'cardOrder') <> 'array'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'roundPlayerIds') <> 'array'
    or pg_catalog.jsonb_typeof(target_room.game_state -> 'readyPlayerIds') <> 'array' then
    raise exception 'ito is not accepting ready actions';
  end if;

  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(target_room.game_state -> 'roundPlayerIds')
      as participant(player_id)
    where participant.player_id = request_user_id::text
  ) then
    raise exception 'Only round participants can confirm the arrangement';
  end if;

  card_count := pg_catalog.jsonb_array_length(target_room.game_state -> 'cards');
  placed_card_count := pg_catalog.jsonb_array_length(target_room.game_state -> 'cardOrder');
  if p_is_ready and (card_count = 0 or placed_card_count <> card_count) then
    raise exception 'Place every card before confirming the arrangement';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(ready.player_id order by ready.ordinality),
    '[]'::jsonb
  )
  into ready_without_player
  from pg_catalog.jsonb_array_elements_text(target_room.game_state -> 'readyPlayerIds')
    with ordinality as ready(player_id, ordinality)
  where ready.player_id <> request_user_id::text;

  next_ready_players := case
    when p_is_ready
      then ready_without_player || pg_catalog.jsonb_build_array(request_user_id::text)
    else ready_without_player
  end;

  update public.rooms
  set game_state = pg_catalog.jsonb_set(
    target_room.game_state,
    '{readyPlayerIds}',
    next_ready_players,
    true
  )
  where id = p_room_id;

  return true;
end;
$function$;

revoke execute on function public.ito_set_card_hint(uuid, text, text)
from public, anon;
revoke execute on function public.ito_move_card(uuid, text, integer)
from public, anon;
revoke execute on function public.ito_set_ready(uuid, boolean)
from public, anon;

grant execute on function public.ito_set_card_hint(uuid, text, text)
to authenticated;
grant execute on function public.ito_move_card(uuid, text, integer)
to authenticated;
grant execute on function public.ito_set_ready(uuid, boolean)
to authenticated;

commit;
