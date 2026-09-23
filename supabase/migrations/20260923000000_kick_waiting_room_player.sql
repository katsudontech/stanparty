begin;

create or replace function public.kick_waiting_room_player(
  p_room_id uuid,
  p_user_id uuid
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

  if p_user_id is null then
    raise exception 'A player is required';
  end if;

  -- Lock the room before checking status or rebuilding the membership array so
  -- a kick cannot race with another membership change.
  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if target_room.host_id <> request_user_id then
    raise exception 'Only the host can kick players';
  end if;

  if target_room.status <> 'waiting' then
    raise exception 'Players can only be kicked while the room is waiting';
  end if;

  if target_room.host_id = p_user_id then
    raise exception 'The host cannot be kicked from the room';
  end if;

  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(target_room.players) = 'array' then target_room.players
        else '[]'::jsonb
      end
    ) as entry(player)
    where entry.player ->> 'userId' = p_user_id::text
  ) then
    raise exception 'Player is not in the room';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(entry.player order by entry.ordinal),
    '[]'::jsonb
  )
  into remaining_players
  from pg_catalog.jsonb_array_elements(
    case
      when pg_catalog.jsonb_typeof(target_room.players) = 'array' then target_room.players
      else '[]'::jsonb
    end
  ) with ordinality as entry(player, ordinal)
  where entry.player ->> 'userId' <> p_user_id::text;

  update public.rooms
  set players = remaining_players
  where id = p_room_id;

  return true;
end;
$function$;

revoke execute on function public.kick_waiting_room_player(uuid, uuid) from public, anon;
grant execute on function public.kick_waiting_room_player(uuid, uuid) to authenticated;

commit;
