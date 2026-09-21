begin;

-- Re-apply the latest player-count guard for already migrated installations.
-- This preserves all existing game branches and adds carbonated-shake.
create or replace function public.enforce_game_player_count_on_start()
returns trigger language plpgsql set search_path = '' as $fn$
declare player_count integer; min_players integer; max_players integer; game_name text;
begin
  if new.status <> 'playing' or old.status = 'playing' then return new; end if;
  player_count := case when pg_catalog.jsonb_typeof(new.players) = 'array' then pg_catalog.jsonb_array_length(new.players) else 0 end;
  case new.game_type
    when 'fake-artist' then min_players := 3; max_players := 10; game_name := 'エセ芸術家';
    when 'coyote' then min_players := 2; max_players := 10; game_name := 'Coyote';
    when 'ito' then min_players := 2; max_players := 14; game_name := 'ito';
    when 'ai-barenai' then min_players := 2; max_players := 14; game_name := 'AIにバレるな！';
    when 'ai-barenai-drawing' then min_players := 2; max_players := 14; game_name := 'AIにバレるな！お絵かき版';
    when 'pinch-hint' then min_players := 2; max_players := 10; game_name := 'ピンチにひらめき！';
    when 'carbonated-shake' then min_players := 2; max_players := 14; game_name := '炭酸シェイク！';
    else return new;
  end case;
  if player_count < min_players or player_count > max_players then
    raise exception '%は%〜%人で遊べます（現在%人です）', game_name, min_players, max_players, player_count;
  end if;
  return new;
end;
$fn$;
drop trigger if exists enforce_game_player_count_on_start_trigger on public.rooms;
create trigger enforce_game_player_count_on_start_trigger before update of status on public.rooms for each row execute function public.enforce_game_player_count_on_start();
revoke execute on function public.enforce_game_player_count_on_start() from public, anon, authenticated;

-- This is intentionally SECURITY INVOKER. The authenticated role must remain
-- visible as current_user; SECURITY DEFINER would make the guard ineffective.
create or replace function public.reject_carbonated_shake_direct_room_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  old_ids text[];
  new_ids text[];
begin
  if tg_op = 'INSERT' then
    if current_user <> 'authenticated' then
      return new;
    end if;
    if new.game_type = 'carbonated-shake' and coalesce(new.game_state, '{}'::jsonb) <> '{}'::jsonb then
      raise exception '炭酸シェイクは専用RPCで初期化してください';
    end if;
    return new;
  end if;

  if old.game_type <> 'carbonated-shake' and new.game_type <> 'carbonated-shake' then
    return new;
  end if;

  -- Apply identity freeze before the current_user check. SECURITY DEFINER room
  -- maintenance RPCs must not be able to change the roster during a match.
  if old.game_type = 'carbonated-shake' and old.status in ('playing', 'finished') and new.status <> 'waiting' then
    if new.game_type is distinct from old.game_type then
      raise exception '進行中の炭酸シェイクのゲーム識別子は変更できません';
    end if;
    select pg_catalog.array_agg(player ->> 'userId' order by player ->> 'userId') into old_ids
    from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(old.players) = 'array' then old.players else '[]'::jsonb end) player;
    select pg_catalog.array_agg(player ->> 'userId' order by player ->> 'userId') into new_ids
    from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(new.players) = 'array' then new.players else '[]'::jsonb end) player;
    if old_ids is distinct from new_ids then raise exception '進行中の炭酸シェイクの参加者は変更できません'; end if;
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;

  -- The only client-side state reset allowed for an initialized match is the
  -- host's normal return to the waiting room. The existing room permissions
  -- trigger still verifies that the caller is the host.
  if old.game_type = 'carbonated-shake'
     and new.status = 'waiting'
     and coalesce(new.game_state, '{}'::jsonb) = '{}'::jsonb
     and new.game_type = old.game_type
     and new.players = old.players then
    return new;
  end if;

  if old.game_type = 'carbonated-shake' then
    if old.status in ('playing', 'finished') then
      if new.game_type is distinct from old.game_type or new.status is distinct from old.status then
        raise exception '進行中の炭酸シェイクのゲーム識別子と状態は変更できません';
      end if;
      if new.players is distinct from old.players then
        select pg_catalog.array_agg(player ->> 'userId' order by player ->> 'userId') into old_ids
        from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(old.players) = 'array' then old.players else '[]'::jsonb end) player;
        select pg_catalog.array_agg(player ->> 'userId' order by player ->> 'userId') into new_ids
        from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(new.players) = 'array' then new.players else '[]'::jsonb end) player;
        if old_ids is distinct from new_ids then raise exception '進行中の炭酸シェイクの参加者は変更できません'; end if;
      end if;
      if new.game_state is distinct from old.game_state then
        raise exception '炭酸シェイクの状態は専用RPCからのみ更新できます';
      end if;
    elsif new.game_state is distinct from '{}'::jsonb then
      raise exception '炭酸シェイクの状態は専用RPCからのみ更新できます';
    end if;
  elsif new.game_type = 'carbonated-shake' and coalesce(new.game_state, '{}'::jsonb) <> '{}'::jsonb then
    raise exception '炭酸シェイクの状態は専用RPCで初期化してください';
  end if;

  return new;
end;
$fn$;

drop trigger if exists reject_carbonated_shake_direct_room_change_trigger on public.rooms;
create trigger reject_carbonated_shake_direct_room_change_trigger
before insert or update on public.rooms
for each row execute function public.reject_carbonated_shake_direct_room_change();

revoke execute on function public.reject_carbonated_shake_direct_room_change() from public, anon, authenticated, service_role;

commit;
