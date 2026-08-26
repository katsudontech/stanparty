begin;

create or replace function public.enforce_game_player_count_on_start()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  player_count integer;
  min_players integer;
  max_players integer;
  game_name text;
begin
  if new.status <> 'playing' or old.status = 'playing' then
    return new;
  end if;

  player_count := case
    when pg_catalog.jsonb_typeof(new.players) = 'array'
      then pg_catalog.jsonb_array_length(new.players)
    else 0
  end;

  case new.game_type
    when 'fake-artist' then
      min_players := 3;
      max_players := 10;
      game_name := 'エセ芸術家';
    when 'coyote' then
      min_players := 3;
      max_players := 10;
      game_name := 'Coyote';
    when 'ito' then
      min_players := 2;
      max_players := 14;
      game_name := 'ito';
    else
      return new;
  end case;

  if player_count < min_players or player_count > max_players then
    raise exception '%は%〜%人で遊べます（現在%人です）',
      game_name,
      min_players,
      max_players,
      player_count;
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_game_player_count_on_start_trigger on public.rooms;
create trigger enforce_game_player_count_on_start_trigger
before update of status on public.rooms
for each row execute function public.enforce_game_player_count_on_start();

revoke execute on function public.enforce_game_player_count_on_start()
  from public, anon, authenticated;

commit;
