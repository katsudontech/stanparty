begin;

-- PostgreSQL has jsonb_array_length(), but no jsonb_object_length().
-- The original judging claim therefore failed after every human answer and the
-- AI answer were ready, leaving the room stuck in the answering phase. Count
-- the server-owned submitted-player array instead; answer submission updates
-- it atomically with the private answer map.
create or replace function public.ai_barenai_drawing_claim_judging(
  p_room_id uuid,
  p_actor_id uuid,
  p_claim_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_room public.rooms%rowtype;
  state jsonb;
  secret private.ai_barenai_drawing_secrets%rowtype;
  expected_answer_count integer;
begin
  select *
  into target_room
  from public.rooms
  where id = p_room_id
  for update;
  state := target_room.game_state;

  if not found
    or target_room.game_type <> 'ai-barenai-drawing'
    or target_room.status <> 'playing'
    or not public.ai_barenai_drawing_is_member(p_room_id, p_actor_id)
    or state ->> 'phase' <> 'answering'
    or state ->> 'aiGuessReady' <> 'true' then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  expected_answer_count := pg_catalog.jsonb_array_length(target_room.players) - 1;

  select *
  into secret
  from private.ai_barenai_drawing_secrets
  where room_id = p_room_id
  for update;

  if not found
    or secret.ai_answer is null
    or pg_catalog.jsonb_array_length(
      coalesce(state -> 'answerSubmittedPlayerIds', '[]'::jsonb)
    ) < expected_answer_count then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  if secret.judging_claimed_at is not null
    and secret.judging_claimed_at > pg_catalog.now() - interval '90 seconds' then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  update private.ai_barenai_drawing_secrets
  set judging_claimed_at = pg_catalog.now(),
      judging_claim_token = p_claim_token,
      judging_claim_round = (state ->> 'round')::integer
  where room_id = p_room_id;

  return pg_catalog.jsonb_build_object(
    'claimed', true,
    'token', p_claim_token,
    'round', (state ->> 'round')::integer,
    'topic', secret.topic,
    'aliases', secret.aliases,
    'answers', secret.human_answers,
    'ai_answer', secret.ai_answer,
    'ai_confidence', secret.ai_confidence
  );
end;
$function$;

revoke all on function public.ai_barenai_drawing_claim_judging(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ai_barenai_drawing_claim_judging(uuid, uuid, text)
  to service_role;

commit;
