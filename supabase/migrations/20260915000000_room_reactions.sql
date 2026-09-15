begin;

-- Reactions use one private broadcast topic per recipient. A fixed room-wide
-- topic would keep a removed member authorized until their JWT reconnects.
create or replace function public.can_access_room_reaction_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  topic_room_id uuid;
  topic_recipient_id uuid;
begin
  if p_topic is null
    or p_topic !~* '^room-reactions:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  topic_room_id := pg_catalog.split_part(p_topic, ':', 2)::uuid;
  topic_recipient_id := pg_catalog.split_part(p_topic, ':', 3)::uuid;
  return topic_recipient_id = (select auth.uid())
    and public.is_room_member(topic_room_id);
exception when invalid_text_representation then
  return false;
end;
$function$;

revoke execute on function public.can_access_room_reaction_topic(text) from public, anon;
grant execute on function public.can_access_room_reaction_topic(text) to authenticated;

drop policy if exists stanparty_room_reaction_select on realtime.messages;
drop policy if exists stanparty_room_reaction_select_base on realtime.messages;
drop policy if exists stanparty_room_reaction_select_guard on realtime.messages;
create policy stanparty_room_reaction_select_base
on realtime.messages for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_access_room_reaction_topic((select realtime.topic()))
);

-- Restrictive policies are evaluated together with any permissive policy,
-- including one added by a future migration. Membership and recipient ID
-- therefore remain mandatory for this topic.
create policy stanparty_room_reaction_select_guard
on realtime.messages as restrictive for select
to authenticated
using (
  realtime.messages.extension <> 'broadcast'
  or (select realtime.topic()) !~ '^room-reactions:'
  or public.can_access_room_reaction_topic((select realtime.topic()))
);

-- Authenticated clients cannot insert reaction broadcasts. The server-only
-- API sends them with the service role after verifying the token, roster
-- membership, and authoritative sender name.
drop policy if exists stanparty_room_reaction_insert_guard on realtime.messages;
create policy stanparty_room_reaction_insert_guard
on realtime.messages as restrictive for insert
to authenticated
with check (
  realtime.messages.extension <> 'broadcast'
  or (select realtime.topic()) !~ '^room-reactions:'
);

commit;
