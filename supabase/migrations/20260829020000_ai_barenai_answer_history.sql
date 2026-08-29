begin;

-- Keep the public answer history separate from the private topic and aliases.
-- This forward migration also makes the answer-history addition safe for rooms
-- whose state was created by an earlier version of the game.

create or replace function public.ai_barenai_initialize(p_room_id uuid, p_actor_id uuid, p_hints_per_round integer, p_topic text, p_aliases text[])
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; ids text[]; answerer text; order_ids text[]; n integer; state jsonb;
begin
  select * into r from public.rooms where id = p_room_id for update;
  if not found or r.game_type <> 'ai-barenai' or r.status <> 'playing' or r.host_id <> p_actor_id then raise exception 'Only the host can start AIにバレるな！'; end if;
  if r.game_state is not null and r.game_state <> '{}'::jsonb and r.game_state->>'phase' <> 'rule_setting' then raise exception 'このゲームはすでに開始しています'; end if;
  select array_agg(p->>'userId') into ids from pg_catalog.jsonb_array_elements(r.players) p;
  if coalesce(array_length(ids,1),0) < 2 or coalesce(array_length(ids,1),0) > 14 then raise exception '2〜14人で遊んでください'; end if;
  n := coalesce(p_hints_per_round, 0);
  if n < 1 or n >= array_length(ids,1) then raise exception 'ヒント人数が不正です'; end if;
  answerer := ids[1 + floor(random() * array_length(ids,1))::int];
  select array_agg(x order by random()) into order_ids from unnest(ids) x where x <> answerer;
  state := jsonb_build_object('game','ai-barenai','version',1,'phase','hinting','hintsPerRound',n,
    'answererId',answerer,'clueGiverOrder',to_jsonb(order_ids),'assignmentCursor',0,
    'currentAssigneeIds',to_jsonb(order_ids[1:n]),'submittedHintPlayerIds','[]'::jsonb,
    'revealedHintHistory','[]'::jsonb,'answerHistory','[]'::jsonb,'round',1,'humanAnswerSubmitted',false,'aiGuessReady',false,'aiError',false,'result',null);
  insert into private.ai_barenai_secrets(room_id,topic,aliases) values(p_room_id,btrim(p_topic),coalesce(p_aliases,'{}')) on conflict(room_id) do update set topic=excluded.topic,aliases=excluded.aliases,pending_hints='{}',human_answer=null,ai_answer=null,ai_confidence=null,ai_claimed_at=null,ai_claim_token=null,ai_claim_round=null,judging_claimed_at=null,judging_claim_token=null,judging_claim_round=null,human_correct=null,ai_correct=null,last_error=null;
  update public.rooms set game_state=state where id=p_room_id;
  return state;
end;
$fn$;

create or replace function public.ai_barenai_claim_guess(p_room_id uuid,p_actor_id uuid,p_claim_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; claimed timestamptz; current_round integer; answer_history jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.host_id is distinct from p_actor_id then return jsonb_build_object('claimed',false); end if;
 s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' <> 'answering' then raise exception 'AI回答を開始できません'; end if;
 current_round := (s->>'round')::integer;
 select ai_claimed_at into claimed from private.ai_barenai_secrets where room_id=p_room_id for update;
 if exists(select 1 from private.ai_barenai_secrets where room_id=p_room_id and ai_answer is not null) then return jsonb_build_object('claimed',false,'state',s); end if;
 if claimed is not null and claimed > now() - interval '45 seconds' then return jsonb_build_object('claimed',false,'state',s); end if;
 update private.ai_barenai_secrets set ai_claimed_at=now(),ai_claim_token=p_claim_token,ai_claim_round=current_round,last_error=null where room_id=p_room_id;
 answer_history := case when pg_catalog.jsonb_typeof(s->'answerHistory')='array' then s->'answerHistory' else '[]'::jsonb end;
 return jsonb_build_object('claimed',true,'round',current_round,'token',p_claim_token,'hints',coalesce(s->'revealedHintHistory','[]'::jsonb),'answerHistory',answer_history);
end;
$fn$;

create or replace function public.ai_barenai_complete_judging(p_room_id uuid,p_actor_id uuid,p_claim_token text,p_claim_round integer,p_human_correct boolean,p_ai_correct boolean)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; sec private.ai_barenai_secrets%rowtype; winner text; final_phase text; answer_history jsonb;
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
 s:=jsonb_set(s,'{result}',jsonb_build_object('winner',winner,'topic',case when final_phase='game_over' then sec.topic else null end,'humanAnswer',sec.human_answer,'aiAnswer',sec.ai_answer,'aiConfidence',coalesce(sec.ai_confidence,0),'humanCorrect',p_human_correct,'aiCorrect',p_ai_correct,'aiError',s->>'aiError'='true'));
 update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

revoke all on function public.ai_barenai_initialize(uuid,uuid,integer,text,text[]) from public,anon,authenticated;
revoke all on function public.ai_barenai_claim_guess(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.ai_barenai_initialize(uuid,uuid,integer,text,text[]) to service_role;
grant execute on function public.ai_barenai_claim_guess(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean) to service_role;

commit;
