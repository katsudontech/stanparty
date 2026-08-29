begin;

-- The judging claim remains host-only, but also returns the public revealed
-- hints so the server can ask Gemini for a reaction without exposing secrets.
create or replace function public.ai_barenai_claim_judging(p_room_id uuid,p_actor_id uuid,p_claim_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; sec private.ai_barenai_secrets%rowtype; current_round integer;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.host_id is distinct from p_actor_id then return jsonb_build_object('claimed',false); end if;
 s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' <> 'answering' or s->>'humanAnswerSubmitted' <> 'true' or s->>'aiGuessReady' <> 'true' or s->>'result' is not null then return jsonb_build_object('claimed',false); end if;
 current_round := (s->>'round')::integer;
 select * into sec from private.ai_barenai_secrets where room_id=p_room_id for update;
 if sec.human_answer is null or sec.ai_answer is null then return jsonb_build_object('claimed',false); end if;
 if sec.judging_claimed_at is not null and sec.judging_claimed_at > now() - interval '90 seconds' then return jsonb_build_object('claimed',false); end if;
 update private.ai_barenai_secrets set judging_claimed_at=now(),judging_claim_token=p_claim_token,judging_claim_round=current_round where room_id=p_room_id;
 return jsonb_build_object('claimed',true,'round',current_round,'token',p_claim_token,'topic',sec.topic,'aliases',sec.aliases,'human_answer',sec.human_answer,'ai_answer',sec.ai_answer,'hints',coalesce(s->'revealedHintHistory','[]'::jsonb));
end;
$fn$;

-- Adding p_ai_comment creates an overload in PostgreSQL, so remove the old
-- six-argument function explicitly before creating the seven-argument one.
drop function if exists public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean);
create function public.ai_barenai_complete_judging(p_room_id uuid,p_actor_id uuid,p_claim_token text,p_claim_round integer,p_human_correct boolean,p_ai_correct boolean,p_ai_comment text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; sec private.ai_barenai_secrets%rowtype; winner text; final_phase text; answer_history jsonb; result_value jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.host_id is distinct from p_actor_id then raise exception 'Only the host can process AIにバレるな！'; end if;
 s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' <> 'answering' or (s->>'round')::integer <> p_claim_round then return s; end if;
 select * into sec from private.ai_barenai_secrets where room_id=p_room_id for update;
 if (s->>'round')::integer <> p_claim_round or sec.judging_claim_token is distinct from p_claim_token or sec.judging_claim_round is distinct from p_claim_round or sec.judging_claimed_at is null or sec.judging_claimed_at <= now() - interval '2 minutes' then return s; end if;
 winner:=case when p_ai_correct then 'ai' when p_human_correct then 'humans' else 'draw' end;
 final_phase:=case when p_ai_correct or p_human_correct then 'game_over' else 'revealing' end;
 update private.ai_barenai_secrets set human_correct=p_human_correct,ai_correct=p_ai_correct,judging_claimed_at=null,judging_claim_token=null,judging_claim_round=null where room_id=p_room_id;
 answer_history := case when pg_catalog.jsonb_typeof(s->'answerHistory')='array' then s->'answerHistory' else '[]'::jsonb end;
 if not exists (select 1 from pg_catalog.jsonb_array_elements(answer_history) entry where entry->>'round' = p_claim_round::text) then
   answer_history := answer_history || jsonb_build_array(jsonb_build_object('round',p_claim_round,'humanAnswer',sec.human_answer,'aiAnswer',sec.ai_answer,'aiConfidence',coalesce(sec.ai_confidence,0),'humanCorrect',p_human_correct,'aiCorrect',p_ai_correct,'aiError',s->>'aiError'='true'));
 end if;
 s:=jsonb_set(s,'{answerHistory}',answer_history);
 s:=jsonb_set(s,'{phase}',to_jsonb(final_phase));
 result_value:=jsonb_build_object('winner',winner,'topic',case when final_phase='game_over' then sec.topic else null end,'humanAnswer',sec.human_answer,'aiAnswer',sec.ai_answer,'aiConfidence',coalesce(sec.ai_confidence,0),'humanCorrect',p_human_correct,'aiCorrect',p_ai_correct,'aiError',s->>'aiError'='true');
 if winner='ai' and p_ai_comment is not null and char_length(btrim(p_ai_comment)) > 0 then
   result_value:=jsonb_set(result_value,'{aiComment}',to_jsonb(left(btrim(p_ai_comment),520)));
 end if;
 s:=jsonb_set(s,'{result}',result_value);
 update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

revoke all on function public.ai_barenai_claim_judging(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.ai_barenai_claim_judging(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean,text) to service_role;

commit;
