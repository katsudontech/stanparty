begin;

-- Keep the server-side start guard aware of this distinct game id.
create or replace function public.enforce_game_player_count_on_start()
returns trigger language plpgsql set search_path = '' as $function$
declare player_count integer; min_players integer; max_players integer; game_name text;
begin
 if new.status <> 'playing' or old.status = 'playing' then return new; end if;
 player_count:=case when pg_catalog.jsonb_typeof(new.players)='array' then pg_catalog.jsonb_array_length(new.players) else 0 end;
 case new.game_type
   when 'fake-artist' then min_players:=3;max_players:=10;game_name:='エセ芸術家';
   when 'coyote' then min_players:=2;max_players:=10;game_name:='Coyote';
   when 'ito' then min_players:=2;max_players:=14;game_name:='ito';
   when 'ai-barenai' then min_players:=2;max_players:=14;game_name:='AIにバレるな！';
   when 'ai-barenai-drawing' then min_players:=2;max_players:=14;game_name:='AIにバレるな！お絵かき版';
   else return new;
 end case;
 if player_count<min_players or player_count>max_players then raise exception '%は%〜%人で遊べます（現在%人です）',game_name,min_players,max_players,player_count; end if;
 return new;
end; $function$;

create table if not exists private.ai_barenai_drawing_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  topic text not null,
  aliases text[] not null default '{}',
  snapshot_image text,
  ai_answer text,
  ai_confidence integer,
  human_answers jsonb not null default '{}'::jsonb
);
alter table private.ai_barenai_drawing_secrets enable row level security;
revoke all on private.ai_barenai_drawing_secrets from public, anon, authenticated;
alter table private.ai_barenai_drawing_secrets
  add column if not exists ai_claimed_at timestamptz,
  add column if not exists ai_claim_token text,
  add column if not exists ai_claim_round integer,
  add column if not exists ai_claim_revision integer,
  add column if not exists judging_claimed_at timestamptz,
  add column if not exists judging_claim_token text,
  add column if not exists judging_claim_round integer;

create or replace function public.ai_barenai_drawing_is_member(p_room_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms r where r.id=p_room_id and
    (r.host_id=p_actor_id or exists (select 1 from pg_catalog.jsonb_array_elements(r.players) p where p->>'userId'=p_actor_id::text)));
$$;

create or replace function public.ai_barenai_drawing_initialize(p_room_id uuid,p_actor_id uuid,p_topic text,p_aliases text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; ids text[]; drawer text; state jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if not found or r.game_type <> 'ai-barenai-drawing' or r.status <> 'playing' or r.host_id<>p_actor_id then raise exception 'Only the host can start AIにバレるな！お絵描き版'; end if;
 if r.game_state is not null and r.game_state<>'{}'::jsonb and r.game_state->>'phase' <> 'rule_setting' then raise exception 'このゲームはすでに開始しています'; end if;
 select array_agg(p->>'userId') into ids from pg_catalog.jsonb_array_elements(r.players) p;
 if coalesce(array_length(ids,1),0)<2 or coalesce(array_length(ids,1),0)>14 then raise exception '2〜14人で遊んでください'; end if;
 drawer := ids[1+floor(random()*array_length(ids,1))::int];
 delete from public.game_events
 where room_id=p_room_id
   and event_type in ('ai_barenai_drawing_line','ai_barenai_drawing_reset');
 state := jsonb_build_object('game','ai-barenai-drawing','version',1,'phase','drawing','drawerId',drawer,'round',1,'canvasRevision',0,'judgmentRevision',null,'answers','[]'::jsonb,'answerSubmittedPlayerIds','[]'::jsonb,'aiGuessReady',false,'judgmentHistory','[]'::jsonb,'result',null);
 insert into private.ai_barenai_drawing_secrets(room_id,topic,aliases)
 values(p_room_id,btrim(p_topic),coalesce(p_aliases,'{}'))
 on conflict(room_id) do update set
   topic=excluded.topic,
   aliases=excluded.aliases,
   snapshot_image=null,
   ai_answer=null,
   ai_confidence=null,
   human_answers='{}',
   ai_claimed_at=null,
   ai_claim_token=null,
   ai_claim_round=null,
   ai_claim_revision=null,
   judging_claimed_at=null,
   judging_claim_token=null,
   judging_claim_round=null;
 update public.rooms set game_state=state where id=p_room_id; return state;
end; $$;

create or replace function public.ai_barenai_drawing_submit_stroke(p_room_id uuid,p_stroke jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; rev integer; uid uuid:=auth.uid();
begin
 select * into r from public.rooms where id=p_room_id for update;
 if uid is null or not public.ai_barenai_drawing_is_member(p_room_id,uid) or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or r.game_state->>'phase'<>'drawing' or r.game_state->>'drawerId'<>uid::text or r.game_state->>'judgmentRevision' is not null then raise exception '描く人だけが描画できます'; end if;
 if pg_catalog.jsonb_typeof(p_stroke)<>'object' or pg_catalog.octet_length(p_stroke::text)>250000 then raise exception 'Invalid stroke data'; end if;
 rev:=coalesce((r.game_state->>'canvasRevision')::integer,0);
 insert into public.game_events(room_id,event_type,payload,actor_id) values(p_room_id,'ai_barenai_drawing_line',jsonb_build_object('playerId',uid::text,'revision',rev,'stroke',p_stroke),uid);
 return true;
end; $$;

create or replace function public.ai_barenai_drawing_reset_canvas(p_room_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 return public.ai_barenai_drawing_reset_canvas_authorized(p_room_id, auth.uid());
end; $$;

create or replace function public.ai_barenai_drawing_reset_canvas_authorized(p_room_id uuid,p_actor_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; uid uuid:=p_actor_id; old_rev integer; new_rev integer;
begin
 select * into r from public.rooms where id=p_room_id for update;
 if uid is null or not public.ai_barenai_drawing_is_member(p_room_id,uid) or r.game_type<>'ai-barenai-drawing' or r.status<>'playing'
   or r.game_state->>'phase'<>'drawing' or r.game_state->>'drawerId'<>uid::text or r.game_state->>'judgmentRevision' is not null then
   raise exception 'いまは絵をリセットできません'; end if;
 old_rev:=coalesce((r.game_state->>'canvasRevision')::integer,0); new_rev:=old_rev+1;
 delete from public.game_events where room_id=p_room_id and event_type='ai_barenai_drawing_line'
   and (payload->>'revision')::integer=old_rev;
 insert into public.game_events(room_id,event_type,payload,actor_id) values(p_room_id,'ai_barenai_drawing_reset',jsonb_build_object('revision',new_rev),uid);
 update public.rooms set game_state=jsonb_set(r.game_state,'{canvasRevision}',to_jsonb(new_rev)) where id=p_room_id;
 return true;
end; $$;

create or replace function public.ai_barenai_drawing_begin_judging(p_room_id uuid,p_actor_id uuid,p_snapshot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; uid uuid; rev integer; state jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update; uid:=p_actor_id;
 if not found or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or r.game_state->>'phase'<>'drawing' or r.game_state->>'drawerId'<>uid::text or r.game_state->>'judgmentRevision' is not null or p_snapshot is null or p_snapshot not like 'data:image/png;base64,%' or pg_catalog.octet_length(p_snapshot)>5000000 then raise exception '描く人だけが判定できます'; end if;
 rev:=coalesce((r.game_state->>'canvasRevision')::integer,0); state:=r.game_state;
 state:=jsonb_set(state,'{phase}','"answering"'); state:=jsonb_set(state,'{judgmentRevision}',to_jsonb(rev)); state:=jsonb_set(state,'{answers}','[]'::jsonb); state:=jsonb_set(state,'{answerSubmittedPlayerIds}','[]'::jsonb); state:=jsonb_set(state,'{aiGuessReady}','false'::jsonb);
 update private.ai_barenai_drawing_secrets set snapshot_image=p_snapshot,ai_answer=null,ai_confidence=null,human_answers='{}' where room_id=p_room_id;
 update public.rooms set game_state=state where id=p_room_id; return state;
end; $$;

create or replace function public.ai_barenai_drawing_submit_answer(p_room_id uuid,p_actor_id uuid,p_answer text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; state jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update; state:=r.game_state;
 if not found or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or not public.ai_barenai_drawing_is_member(p_room_id,p_actor_id) or state->>'phase'<>'answering' or state->>'drawerId'=p_actor_id::text then raise exception '回答できません'; end if;
 if p_answer is null or char_length(btrim(p_answer))=0 or char_length(p_answer)>200 then raise exception '回答を入力してください'; end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements_text(state->'answerSubmittedPlayerIds') x where x=p_actor_id::text) then raise exception '回答は一度だけです'; end if;
 -- Keep answer text private until every answer has been submitted.
 state:=jsonb_set(state,'{answerSubmittedPlayerIds}',coalesce(state->'answerSubmittedPlayerIds','[]'::jsonb)||to_jsonb(p_actor_id::text));
 update private.ai_barenai_drawing_secrets set human_answers=human_answers||jsonb_build_object(p_actor_id::text,btrim(p_answer)) where room_id=p_room_id;
 update public.rooms set game_state=state where id=p_room_id; return state;
end; $$;

create or replace function public.ai_barenai_drawing_get_topic(p_room_id uuid,p_actor_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; answer text;
begin
 select * into r from public.rooms where id=p_room_id;
 if not found or not public.ai_barenai_drawing_is_member(p_room_id,p_actor_id)
   or r.game_type<>'ai-barenai-drawing'
   or (r.game_state->>'phase' not in ('drawing','answering','revealing') and r.game_state->>'phase'<>'game_over')
   or (r.game_state->>'phase' <> 'game_over' and r.game_state->>'drawerId'<>p_actor_id::text) then
   raise exception 'お題を表示できません';
 end if;
 select topic into answer from private.ai_barenai_drawing_secrets where room_id=p_room_id;
 return answer;
end; $$;

create or replace function public.ai_barenai_drawing_claim_guess(p_room_id uuid,p_actor_id uuid,p_claim_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; state jsonb; sec private.ai_barenai_drawing_secrets%rowtype; rev integer; round_no integer;
begin
 select * into r from public.rooms where id=p_room_id for update; state:=r.game_state;
 if not found or not public.ai_barenai_drawing_is_member(p_room_id,p_actor_id) or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or state->>'phase'<>'answering' then raise exception 'AI回答を開始できません'; end if;
 select * into sec from private.ai_barenai_drawing_secrets where room_id=p_room_id for update;
 if sec.ai_answer is not null then return jsonb_build_object('claimed',false,'ready',true); end if;
 if sec.ai_claimed_at is not null and sec.ai_claimed_at>now()-interval '45 seconds' then return jsonb_build_object('claimed',false); end if;
 rev:=(state->>'judgmentRevision')::integer; round_no:=(state->>'round')::integer;
 update private.ai_barenai_drawing_secrets set ai_claimed_at=now(),ai_claim_token=p_claim_token,ai_claim_round=round_no,ai_claim_revision=rev where room_id=p_room_id;
 return jsonb_build_object('claimed',true,'token',p_claim_token,'round',round_no,'revision',rev,'snapshot',sec.snapshot_image);
end; $$;

create or replace function public.ai_barenai_drawing_complete_guess(p_room_id uuid,p_actor_id uuid,p_claim_token text,p_claim_round integer,p_claim_revision integer,p_answer text,p_confidence integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; state jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update; state:=r.game_state;
 if not found or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or not public.ai_barenai_drawing_is_member(p_room_id,p_actor_id) or state->>'phase'<>'answering' then return state; end if;
 update private.ai_barenai_drawing_secrets set ai_answer=left(coalesce(nullif(btrim(p_answer),''),'AI回答を取得できませんでした'),200),ai_confidence=greatest(0,least(100,coalesce(p_confidence,0))),ai_claimed_at=null,ai_claim_token=null,ai_claim_round=null,ai_claim_revision=null
 where room_id=p_room_id and ai_answer is null and ai_claim_token=p_claim_token and ai_claim_round=p_claim_round and ai_claim_revision=p_claim_revision and (state->>'round')::integer=p_claim_round and (state->>'judgmentRevision')::integer=p_claim_revision;
 if found then state:=jsonb_set(state,'{aiGuessReady}','true'::jsonb); update public.rooms set game_state=state where id=p_room_id; end if;
 return state;
end; $$;

create or replace function public.ai_barenai_drawing_claim_judging(p_room_id uuid,p_actor_id uuid,p_claim_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; state jsonb; sec private.ai_barenai_drawing_secrets%rowtype; expected integer;
begin
 select * into r from public.rooms where id=p_room_id for update; state:=r.game_state;
 if not found or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or not public.ai_barenai_drawing_is_member(p_room_id,p_actor_id) or state->>'phase'<>'answering' or state->>'aiGuessReady'<>'true' then return jsonb_build_object('claimed',false); end if;
 expected:=pg_catalog.jsonb_array_length(r.players)-1;
 select * into sec from private.ai_barenai_drawing_secrets where room_id=p_room_id for update;
 if jsonb_object_length(sec.human_answers)<expected then return jsonb_build_object('claimed',false); end if;
 if sec.judging_claimed_at is not null and sec.judging_claimed_at>now()-interval '90 seconds' then return jsonb_build_object('claimed',false); end if;
 update private.ai_barenai_drawing_secrets set judging_claimed_at=now(),judging_claim_token=p_claim_token,judging_claim_round=(state->>'round')::integer where room_id=p_room_id;
 return jsonb_build_object('claimed',true,'token',p_claim_token,'round',(state->>'round')::integer,'topic',sec.topic,'aliases',sec.aliases,'answers',sec.human_answers,'ai_answer',sec.ai_answer,'ai_confidence',sec.ai_confidence);
end; $$;

create or replace function public.ai_barenai_drawing_complete_judging_claim(p_room_id uuid,p_actor_id uuid,p_claim_token text,p_claim_round integer,p_human_correct boolean,p_ai_correct boolean,p_judgment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; state jsonb; winner text; final_phase text;
begin
 select * into r from public.rooms where id=p_room_id for update; state:=r.game_state;
 if not found or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or not public.ai_barenai_drawing_is_member(p_room_id,p_actor_id) or state->>'phase'<>'answering' or (state->>'round')::integer<>p_claim_round then return state; end if;
 if not exists(select 1 from private.ai_barenai_drawing_secrets where room_id=p_room_id and judging_claim_token=p_claim_token and judging_claim_round=p_claim_round and judging_claimed_at>now()-interval '2 minutes') then return state; end if;
 winner:=case when p_ai_correct then 'ai' when p_human_correct then 'humans' else 'draw' end; final_phase:=case when p_ai_correct or p_human_correct then 'game_over' else 'revealing' end;
 state:=jsonb_set(state,'{phase}',to_jsonb(final_phase)); state:=jsonb_set(state,'{result}',p_judgment); state:=jsonb_set(state,'{judgmentHistory}',coalesce(state->'judgmentHistory','[]'::jsonb)||jsonb_build_array(p_judgment));
 update private.ai_barenai_drawing_secrets set judging_claimed_at=null,judging_claim_token=null,judging_claim_round=null where room_id=p_room_id;
 update public.rooms set game_state=state where id=p_room_id; return state;
end; $$;

create or replace function public.ai_barenai_drawing_continue(p_room_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; state jsonb;
begin
 select * into r from public.rooms where id=p_room_id for update; state:=r.game_state;
 if not found or r.game_type<>'ai-barenai-drawing' or r.status<>'playing' or state->>'phase'<>'revealing' or state->>'drawerId'<>p_actor_id::text then raise exception '描画を再開できません'; end if;
 state:=jsonb_set(state,'{phase}','"drawing"'); state:=jsonb_set(state,'{judgmentRevision}','null'::jsonb); state:=jsonb_set(state,'{answers}','[]'::jsonb); state:=jsonb_set(state,'{answerSubmittedPlayerIds}','[]'::jsonb); state:=jsonb_set(state,'{aiGuessReady}','false'::jsonb); state:=jsonb_set(state,'{result}','null'::jsonb); state:=jsonb_set(state,'{round}',to_jsonb((state->>'round')::integer+1));
 update public.rooms set game_state=state where id=p_room_id; return state;
end; $$;

revoke all on function public.ai_barenai_drawing_initialize(uuid,uuid,text,text[]) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_is_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_submit_stroke(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_reset_canvas(uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_reset_canvas_authorized(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_begin_judging(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_submit_answer(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_continue(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_get_topic(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_claim_guess(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_complete_guess(uuid,uuid,text,integer,integer,text,integer) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_claim_judging(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_barenai_drawing_complete_judging_claim(uuid,uuid,text,integer,boolean,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.ai_barenai_drawing_initialize(uuid,uuid,text,text[]) to service_role;
grant execute on function public.ai_barenai_drawing_is_member(uuid,uuid) to service_role;
grant execute on function public.ai_barenai_drawing_submit_stroke(uuid,jsonb) to authenticated,service_role;
grant execute on function public.ai_barenai_drawing_reset_canvas(uuid) to authenticated,service_role;
grant execute on function public.ai_barenai_drawing_reset_canvas_authorized(uuid,uuid) to service_role;
grant execute on function public.ai_barenai_drawing_begin_judging(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_drawing_submit_answer(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_drawing_continue(uuid,uuid) to service_role;
grant execute on function public.ai_barenai_drawing_get_topic(uuid,uuid) to service_role;
grant execute on function public.ai_barenai_drawing_claim_guess(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_drawing_complete_guess(uuid,uuid,text,integer,integer,text,integer) to service_role;
grant execute on function public.ai_barenai_drawing_claim_judging(uuid,uuid,text) to service_role;
grant execute on function public.ai_barenai_drawing_complete_judging_claim(uuid,uuid,text,integer,boolean,boolean,jsonb) to service_role;

-- New game state is server-owned; clients may only mutate it through the RPCs.
create or replace function public.reject_ai_barenai_drawing_direct_state_update() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and old.game_type='ai-barenai-drawing' and new.game_state is distinct from old.game_state and not (new.status='waiting' and new.game_state='{}'::jsonb) then raise exception 'お絵描き版AIにバレるなの状態はサーバー操作でのみ変更できます'; end if;
 return new;
end; $$;
drop trigger if exists reject_ai_barenai_drawing_direct_state_update_trigger on public.rooms;
create trigger reject_ai_barenai_drawing_direct_state_update_trigger before update of game_state on public.rooms for each row execute function public.reject_ai_barenai_drawing_direct_state_update();

commit;
