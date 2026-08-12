begin;

create or replace function public.enforce_coyote_player_identity_keys()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  old_players jsonb;
  new_players jsonb;
begin
  if current_user <> 'authenticated'
    or auth.uid() is null
    or auth.uid() = old.host_id
    or old.game_type <> 'coyote'
    or new.game_state is not distinct from old.game_state then
    return new;
  end if;

  old_players := old.game_state -> 'coyotePlayers';
  new_players := new.game_state -> 'coyotePlayers';

  if pg_catalog.jsonb_typeof(old_players) <> 'object'
    or pg_catalog.jsonb_typeof(new_players) <> 'object'
    or exists (
      (
        select old_key.player_id
        from pg_catalog.jsonb_object_keys(old_players) as old_key(player_id)
        except
        select new_key.player_id
        from pg_catalog.jsonb_object_keys(new_players) as new_key(player_id)
      )
      union all
      (
        select new_key.player_id
        from pg_catalog.jsonb_object_keys(new_players) as new_key(player_id)
        except
        select old_key.player_id
        from pg_catalog.jsonb_object_keys(old_players) as old_key(player_id)
      )
    ) then
    raise exception 'Coyote player identities cannot be changed during a round';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_coyote_player_identity_keys_trigger on public.rooms;
create trigger enforce_coyote_player_identity_keys_trigger
before update on public.rooms
for each row execute function public.enforce_coyote_player_identity_keys();

revoke execute on function public.enforce_coyote_player_identity_keys()
from public, anon, authenticated;

commit;
