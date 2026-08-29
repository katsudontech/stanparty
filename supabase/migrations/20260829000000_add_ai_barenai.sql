begin;

create schema if not exists private;
create table if not exists private.ai_barenai_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  topic text not null,
  aliases text[] not null default '{}',
  pending_hints jsonb not null default '{}'::jsonb,
  human_answer text,
  ai_answer text,
  ai_confidence integer,
  ai_claimed_at timestamptz,
  ai_claim_token text,
  ai_claim_round integer,
  judging_claimed_at timestamptz,
  judging_claim_token text,
  judging_claim_round integer,
  human_correct boolean,
  ai_correct boolean,
  last_error text
);
alter table private.ai_barenai_secrets enable row level security;
revoke all on private.ai_barenai_secrets from public, anon, authenticated;

-- Keep the start-count guard current for installations applying this migration.
create or replace function public.enforce_game_player_count_on_start()
returns trigger language plpgsql set search_path = '' as $function$
declare player_count integer; min_players integer; max_players integer; game_name text;
begin
  if new.status <> 'playing' or old.status = 'playing' then return new; end if;
  player_count := case when pg_catalog.jsonb_typeof(new.players) = 'array' then pg_catalog.jsonb_array_length(new.players) else 0 end;
  case new.game_type
    when 'fake-artist' then min_players := 3; max_players := 10; game_name := 'エセ芸術家';
    when 'coyote' then min_players := 2; max_players := 10; game_name := 'Coyote';
    when 'ito' then min_players := 2; max_players := 14; game_name := 'ito';
    when 'ai-barenai' then min_players := 2; max_players := 14; game_name := 'AIにバレるな！';
    else return new;
  end case;
  if player_count < min_players or player_count > max_players then raise exception '%は%〜%人で遊べます（現在%人です）', game_name,min_players,max_players,player_count; end if;
  return new;
end; $function$;
drop trigger if exists enforce_game_player_count_on_start_trigger on public.rooms;
create trigger enforce_game_player_count_on_start_trigger before update of status on public.rooms for each row execute function public.enforce_game_player_count_on_start();

create or replace function public.ai_barenai_is_member(p_room_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.rooms r where r.id = p_room_id and (r.host_id = p_actor_id or exists (
    select 1 from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(r.players) = 'array' then r.players else '[]'::jsonb end) p
    where p->>'userId' = p_actor_id::text)));
$fn$;

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
    'revealedHintHistory','[]'::jsonb,'round',1,'humanAnswerSubmitted',false,'aiGuessReady',false,'aiError',false,'result',null);
  insert into private.ai_barenai_secrets(room_id,topic,aliases) values(p_room_id,btrim(p_topic),coalesce(p_aliases,'{}')) on conflict(room_id) do update set topic=excluded.topic,aliases=excluded.aliases,pending_hints='{}',human_answer=null,ai_answer=null,ai_confidence=null,ai_claimed_at=null,ai_claim_token=null,ai_claim_round=null,judging_claimed_at=null,judging_claim_token=null,judging_claim_round=null,human_correct=null,ai_correct=null,last_error=null;
  update public.rooms set game_state=state where id=p_room_id;
  return state;
end;
$fn$;

create or replace function public.ai_barenai_submit_hint(p_room_id uuid, p_actor_id uuid, p_hint text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; pending jsonb; submitted jsonb; ids jsonb; round_hints jsonb;
begin
  select * into r from public.rooms where id=p_room_id for update;
  s := r.game_state;
  if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'game' <> 'ai-barenai' or s->>'phase' <> 'hinting' then raise exception 'ヒントを提出できません'; end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements_text(s->'currentAssigneeIds') x where x=p_actor_id::text) then raise exception '現在のヒント担当ではありません'; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements_text(s->'submittedHintPlayerIds') x where x=p_actor_id::text) then raise exception 'このラウンドは提出済みです'; end if;
  if p_hint is null or char_length(btrim(p_hint))=0 or char_length(p_hint)>300 then raise exception 'ヒントは1〜300文字で入力してください'; end if;
  select pending_hints into pending from private.ai_barenai_secrets where room_id=p_room_id for update;
  pending := jsonb_set(coalesce(pending,'{}'), array[p_actor_id::text], to_jsonb(btrim(p_hint)), true);
  submitted := coalesce(s->'submittedHintPlayerIds','[]') || to_jsonb(p_actor_id::text);
  s := jsonb_set(s,'{submittedHintPlayerIds}',submitted);
  if (select jsonb_array_length(submitted)) >= (select jsonb_array_length(s->'currentAssigneeIds')) then
    select jsonb_agg(jsonb_build_object('playerId',x,'text',pending->>x) order by ord) into ids
      from jsonb_array_elements_text(s->'currentAssigneeIds') with ordinality a(x,ord);
    round_hints := jsonb_build_object('round',(s->>'round')::int,'hints',coalesce(ids,'[]'::jsonb));
    s := jsonb_set(s,'{revealedHintHistory}',coalesce(s->'revealedHintHistory','[]') || jsonb_build_array(round_hints));
    s := jsonb_set(s,'{phase}','"answering"'::jsonb);
    s := jsonb_set(s,'{submittedHintPlayerIds}','[]'::jsonb);
    update private.ai_barenai_secrets set pending_hints='{}' where room_id=p_room_id;
  else update private.ai_barenai_secrets set pending_hints=pending where room_id=p_room_id;
  end if;
  update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

create or replace function public.ai_barenai_submit_answer(p_room_id uuid,p_actor_id uuid,p_answer text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update; s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' <> 'answering' or s->>'answererId' <> p_actor_id::text then raise exception '回答できません'; end if;
 if exists(select 1 from private.ai_barenai_secrets where room_id=p_room_id and human_answer is not null) then raise exception '回答は一度だけです'; end if;
 if p_answer is null or char_length(btrim(p_answer))=0 or char_length(p_answer)>200 then raise exception '回答を入力してください'; end if;
 update private.ai_barenai_secrets set human_answer=btrim(p_answer) where room_id=p_room_id;
 s:=jsonb_set(s,'{humanAnswerSubmitted}','true'::jsonb); update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

drop function if exists public.ai_barenai_claim_guess(uuid,uuid);
drop function if exists public.ai_barenai_complete_guess(uuid,uuid,text,integer,text);
drop function if exists public.ai_barenai_judge(uuid,uuid,boolean,boolean);
drop function if exists public.ai_barenai_get_judging_payload(uuid);

create or replace function public.ai_barenai_claim_guess(p_room_id uuid,p_actor_id uuid,p_claim_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r public.rooms%rowtype; s jsonb; claimed timestamptz; current_round integer;
begin
 select * into r from public.rooms where id=p_room_id for update; s:=r.game_state;
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
 select * into r from public.rooms where id=p_room_id for update; s:=r.game_state;
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
 select * into r from public.rooms where id=p_room_id for update; s:=r.game_state;
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
 select * into r from public.rooms where id=p_room_id for update; s:=r.game_state;
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
 select * into r from public.rooms where id=p_room_id for update; s:=r.game_state;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' <> 'revealing' then raise exception '次のラウンドへ進めません'; end if;
 n:=(s->>'hintsPerRound')::int; cursor:=((s->>'assignmentCursor')::int+n) % jsonb_array_length(s->'clueGiverOrder'); ord:=s->'clueGiverOrder';
 select jsonb_agg(ord->>(((cursor+i) % jsonb_array_length(ord)))::int order by i) from generate_series(0,n-1) i into ids;
 s:=jsonb_set(s,'{assignmentCursor}',to_jsonb(cursor)); s:=jsonb_set(s,'{currentAssigneeIds}',ids); s:=jsonb_set(s,'{submittedHintPlayerIds}','[]'::jsonb); s:=jsonb_set(s,'{humanAnswerSubmitted}','false'::jsonb); s:=jsonb_set(s,'{aiGuessReady}','false'::jsonb); s:=jsonb_set(s,'{aiError}','false'::jsonb); s:=jsonb_set(s,'{round}',to_jsonb((s->>'round')::int+1)); s:=jsonb_set(s,'{result}','null'::jsonb); s:=jsonb_set(s,'{phase}','"hinting"'::jsonb);
 update private.ai_barenai_secrets set pending_hints='{}',human_answer=null,ai_answer=null,ai_confidence=null,ai_claimed_at=null,ai_claim_token=null,ai_claim_round=null,judging_claimed_at=null,judging_claim_token=null,judging_claim_round=null,human_correct=null,ai_correct=null,last_error=null where room_id=p_room_id;
 update public.rooms set game_state=s where id=p_room_id; return s;
end;
$fn$;

create or replace function public.ai_barenai_get_topic(p_room_id uuid,p_actor_id uuid)
returns text language plpgsql security definer set search_path = '' as $fn$
declare s jsonb; topic_value text;
begin
 select game_state into s from public.rooms where id=p_room_id;
 if not public.ai_barenai_is_member(p_room_id,p_actor_id) or s->>'phase' not in ('hinting','answering') or s->>'answererId'=p_actor_id::text then raise exception 'お題を表示できません'; end if;
 select secrets.topic into topic_value from private.ai_barenai_secrets secrets where secrets.room_id=p_room_id; return topic_value;
end;
$fn$;

revoke all on function public.ai_barenai_is_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_initialize(uuid,uuid,integer,text,text[]) from public,anon,authenticated;
revoke all on function public.ai_barenai_submit_hint(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_submit_answer(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_claim_guess(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_complete_guess(uuid,uuid,text,integer,text,integer,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_claim_judging(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean) from public,anon,authenticated;
revoke all on function public.ai_barenai_next_round(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_get_topic(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_barenai_initialize(uuid,uuid,integer,text,text[]) to service_role;
grant execute on function public.ai_barenai_is_member(uuid,uuid) to service_role;
grant execute on function public.ai_barenai_submit_hint(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_submit_answer(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_claim_guess(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_complete_guess(uuid,uuid,text,integer,text,integer,text) to service_role;
grant execute on function public.ai_barenai_claim_judging(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_complete_judging(uuid,uuid,text,integer,boolean,boolean) to service_role;
grant execute on function public.ai_barenai_next_round(uuid,uuid) to service_role;
grant execute on function public.ai_barenai_get_topic(uuid,uuid) to service_role;

-- Authenticated clients must not directly mutate this game's public state.
create or replace function public.reject_ai_barenai_direct_state_update() returns trigger language plpgsql set search_path='' as $fn$
begin
 if current_user='authenticated' and old.game_type='ai-barenai' and new.game_state is distinct from old.game_state and not (new.status='waiting' and new.game_state='{}'::jsonb) then raise exception 'AIにバレるな！の状態はサーバー操作でのみ変更できます'; end if;
 return new;
end; $fn$;
drop trigger if exists reject_ai_barenai_direct_state_update_trigger on public.rooms;
create trigger reject_ai_barenai_direct_state_update_trigger before update of game_state on public.rooms for each row execute function public.reject_ai_barenai_direct_state_update();
revoke execute on function public.reject_ai_barenai_direct_state_update() from public,anon,authenticated,service_role;

commit;
