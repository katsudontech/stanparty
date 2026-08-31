begin;

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

  if new.event_type = 'ai_barenai_drawing_line' then
    if target_room.game_type <> 'ai-barenai-drawing'
      or target_room.status <> 'playing'
      or target_room.game_state ->> 'phase' <> 'drawing'
      or target_room.game_state ->> 'drawerId' <> request_user_id::text
      or target_room.game_state ->> 'judgmentRevision' is not null
      or new.payload ->> 'playerId' <> request_user_id::text then
      raise exception '描く人だけが描画できます';
    end if;
    return new;
  end if;

  if new.event_type = 'ai_barenai_drawing_reset' then
    if target_room.game_type <> 'ai-barenai-drawing'
      or target_room.status <> 'playing'
      or target_room.game_state ->> 'phase' <> 'drawing'
      or target_room.game_state ->> 'drawerId' <> request_user_id::text
      or target_room.game_state ->> 'judgmentRevision' is not null then
      raise exception 'いまは絵をリセットできません';
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

commit;
