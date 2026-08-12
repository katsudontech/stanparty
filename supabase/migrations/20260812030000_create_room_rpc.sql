begin;

drop policy if exists rooms_select_host on public.rooms;
create policy rooms_select_host
on public.rooms for select
to authenticated
using (host_id = (select auth.uid()));

create or replace function public.create_room(
  p_room_name text,
  p_host_name text,
  p_avatar_url text default '',
  p_is_public boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_user_id uuid := auth.uid();
  created_room_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_room_name is null or pg_catalog.char_length(pg_catalog.btrim(p_room_name)) = 0 then
    raise exception 'A room name is required';
  end if;

  if p_host_name is null or pg_catalog.char_length(pg_catalog.btrim(p_host_name)) = 0 then
    raise exception 'A host name is required';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_host_name)) > 80 then
    raise exception 'Host name is too long';
  end if;

  if not exists (
    select 1
    from public.users
    where id = request_user_id
  ) then
    raise exception 'Create a user profile before creating a room';
  end if;

  insert into public.rooms (
    host_id,
    game_type,
    status,
    players,
    room_name,
    is_public
  )
  values (
    request_user_id,
    'fake-artist',
    'waiting',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'userId', request_user_id::text,
        'name', pg_catalog.btrim(p_host_name),
        'avatarUrl', coalesce(p_avatar_url, ''),
        'isHost', true,
        'color', '#ef4444',
        'isOnline', true
      )
    ),
    pg_catalog.btrim(p_room_name),
    coalesce(p_is_public, true)
  )
  returning id into created_room_id;

  return created_room_id;
end;
$function$;

revoke execute on function public.create_room(text, text, text, boolean)
  from public, anon;
grant execute on function public.create_room(text, text, text, boolean)
  to authenticated;

commit;
