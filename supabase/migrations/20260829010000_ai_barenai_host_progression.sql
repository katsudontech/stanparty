begin;

-- Progression and AI orchestration are host-only even when these security
-- definer functions are called directly with the service role.

create or replace function public.ai_barenai_claim_guess(p_room_id uuid,p_actor_id uuid,p_claim_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; claimed timestamptz; current_round integer;
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
 return jsonb_build_object('claimed',true,'round',current_round,'token',p_claim_token,'hints',s->'revealedHintHistory');
end;
$fn$;

create or replace function public.ai_barenai_complete_guess(p_room_id uuid,p_actor_id uuid,p_claim_token text,p_claim_round integer,p_answer text,p_confidence integer,p_error text default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.host_id is distinct from p_actor_id then raise exception 'Only the host can process AIにバレるな！'; end if;
 s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) then raise exception 'Room membership is required'; end if;
 if s->>'phase' <> 'answering' then return s; end if;
 update private.ai_barenai_secrets set ai_answer=coalesce(nullif(btrim(p_answer),''),'AI回答を取得できませんでした'),ai_confidence=greatest(0,least(100,coalesce(p_confidence,0))),ai_claimed_at=null,ai_claim_token=null,ai_claim_round=null,last_error=p_error where room_id=p_room_id and ai_answer is null and ai_claim_token=p_claim_token and ai_claim_round=p_claim_round and (s->>'round')::integer=p_claim_round and ai_claimed_at > now() - interval '2 minutes';
 if found then s:=jsonb_set(s,'{aiGuessReady}','true'::jsonb); s:=jsonb_set(s,'{aiError}',to_jsonb(p_error is not null)); update public.rooms set game_state=s where id=p_room_id; end if;
 return s;
end;
$fn$;

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
 return jsonb_build_object('claimed',true,'round',current_round,'token',p_claim_token,'topic',sec.topic,'aliases',sec.aliases,'human_answer',sec.human_answer,'ai_answer',sec.ai_answer);
end;
$fn$;

create or replace function public.ai_barenai_complete_judging(p_room_id uuid,p_actor_id uuid,p_claim_token text,p_claim_round integer,p_human_correct boolean,p_ai_correct boolean)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; sec private.ai_barenai_secrets%rowtype; winner text; final_phase text;
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
 s:=jsonb_set(s,'{phase}',to_jsonb(final_phase));
 s:=jsonb_set(s,'{result}',jsonb_build_object('winner',winner,'topic',case when final_phase='game_over' then sec.topic else null end,'humanAnswer',sec.human_answer,'aiAnswer',sec.ai_answer,'aiConfidence',coalesce(sec.ai_confidence,0),'humanCorrect',p_human_correct,'aiCorrect',p_ai_correct,'aiError',s->>'aiError'='true'));
 update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

create or replace function public.ai_barenai_next_round(p_room_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; ord jsonb; cursor integer; n integer; ids jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.host_id is distinct from p_actor_id then raise exception 'Only the host can advance AIにバレるな！'; end if;
 s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' <> 'revealing' then raise exception '次のラウンドへ進めません'; end if;
 n:=(s->>'hintsPerRound')::int; cursor:=((s->>'assignmentCursor')::int+n) % jsonb_array_length(s->'clueGiverOrder'); ord:=s->'clueGiverOrder';
 select jsonb_agg(ord->>(((cursor+i) % jsonb_array_length(ord)))::int order by i) from generate_series(0,n-1) i into ids;
 s:=jsonb_set(s,'{assignmentCursor}',to_jsonb(cursor)); s:=jsonb_set(s,'{currentAssigneeIds}',ids); s:=jsonb_set(s,'{submittedHintPlayerIds}','[]'::jsonb); s:=jsonb_set(s,'{humanAnswerSubmitted}','false'::jsonb); s:=jsonb_set(s,'{aiGuessReady}','false'::jsonb); s:=jsonb_set(s,'{aiError}','false'::jsonb); s:=jsonb_set(s,'{round}',to_jsonb((s->>'round')::int+1)); s:=jsonb_set(s,'{result}','null'::jsonb); s:=jsonb_set(s,'{phase}','"hinting"'::jsonb);
 update private.ai_barenai_secrets set pending_hints='{}',human_answer=null,ai_answer=null,ai_confidence=null,ai_claimed_at=null,ai_claim_token=null,ai_claim_round=null,judging_claimed_at=null,judging_claim_token=null,judging_claim_round=null,human_correct=null,ai_correct=null,last_error=null where room_id=p_room_id;
 update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

revoke all on function public.ai_barenai_claim_guess(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_complete_guess(uuid,uuid,text,integer,text,integer,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_claim_judging(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean) from public,anon,authenticated;
revoke all on function public.ai_barenai_next_round(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_barenai_claim_guess(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_complete_guess(uuid,uuid,text,integer,text,integer,text) to service_role;
grant execute on function public.ai_barenai_claim_judging(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean) to service_role;
grant execute on function public.ai_barenai_next_round(uuid,uuid) to service_role;

commit;
