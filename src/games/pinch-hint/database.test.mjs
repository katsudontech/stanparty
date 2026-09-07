import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const db = new PGlite();
const players = Array.from({length: 10}, (_, i) => `00000000-0000-4000-8000-${String(i+1).padStart(12, '0')}`);

function check(value, message) { assert.ok(value, message); }
await db.exec(`
create role service_role; create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.rooms (
 id uuid primary key default gen_random_uuid(), host_id uuid not null,
 game_type text not null default 'fake-artist', status text not null default 'waiting',
 players jsonb not null default '[]', game_state jsonb default '{}',
 room_name text not null default 'test', is_display_roomlist boolean default false,
 is_public boolean default false, created_at timestamptz default now()
);
grant select, update on public.rooms to authenticated;
create function public.is_room_member(p_room_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.rooms r where r.id=p_room_id and (r.host_id=auth.uid() or exists(select 1 from jsonb_array_elements(r.players) p where p->>'userId'=auth.uid()::text)))
$$;
`);
const permissions = await readFile(`${root}/supabase/migrations/20260812010000_game_action_permissions.sql`, 'utf8');
const permissionsFunction = permissions.slice(permissions.indexOf('create or replace function public.enforce_room_update_permissions()'), permissions.indexOf('create or replace function public.enforce_game_event_insert_permissions()'));
await db.exec(permissionsFunction);
const roomRpcs = await readFile(`${root}/supabase/migrations/20260812000000_anonymous_auth_rls.sql`, 'utf8');
await db.exec(roomRpcs.slice(roomRpcs.indexOf('create or replace function public.leave_room('), roomRpcs.indexOf('create or replace function public.update_my_room_profile(')));
await db.exec(`create trigger enforce_room_update_permissions_trigger before update on public.rooms for each row execute function public.enforce_room_update_permissions();`);
await db.exec(await readFile(`${root}/supabase/migrations/20260907000000_add_pinch_hint.sql`, 'utf8'));
const signatures = Object.fromEntries((await db.query(`select proname, proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'pinch_hint_%'`)).rows.map(r => [r.proname, r.proargnames]));
async function actor(id) {
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
 await db.exec('set role authenticated');
}
async function rpc(name, args) {
 const names = signatures[name];
 assert.ok(names, `RPC ${name} exists`);
 for (const n of names) assert.ok(n in args, `missing argument ${n} for ${name}`);
 const result = await db.query(`select public.${name}(${names.map((n,i)=>`${n} => $${i+1}`).join(',')}) result`, names.map(n => args[n]));
 return result.rows[0].result;
}
function stateArgs(roomId, state) {
 return {p_room_id:roomId,p_expected_turn_index:state.turnIndex,p_expected_match_id:state.matchId,p_match_id:state.matchId,p_expected_revision:state.stateRevision};
}
async function reject(fn, message) {
 try { await fn(); } catch (error) {
   assert.ok(['P0001', '42501'].includes(error.code), `${message}: unexpected error ${error.message}`);
   return;
 }
 throw new Error(`Expected rejection: ${message}`);
}
async function room(n) {
 await db.exec('reset role');
 const roster=players.slice(0,n).map((id,i)=>({userId:id,name:`Player${i+1}`,isHost:i===0,color:'#ef4444',isOnline:true,avatarUrl:''}));
 return (await db.query(`insert into public.rooms(host_id,game_type,status,players) values($1,'pinch-hint','playing',$2) returning id`, [players[0],JSON.stringify(roster)])).rows[0].id;
}
async function getPrivate(roomId, id) { await actor(id); return rpc('pinch_hint_get_private',{p_room_id:roomId}); }
async function runMatch(n, rounds, mode='allYes') {
 const roomId = await room(n);
 await actor(players[0]);
 let state = await rpc('pinch_hint_initialize',{p_room_id:roomId,p_rounds:rounds});
 check(state.totalTurns===n*rounds,'total turns');
 check(new Set(state.turnOrder).size===n,'unique fixed roster');
 check(state.requiredCount>=1 && state.requiredCount<=3,'random count range');
 const order=[...state.turnOrder];
 const seen=[];
 const seenTopics=new Set();
 for(let turn=0;turn<n*rounds;turn++) {
  check(state.turnIndex===turn,'correct turn index');
  check(typeof state.topic==='string' && state.topic.length>0,'valid fixed topic');
  check(!seenTopics.has(state.topic),'no repeated topics in a match');
  seenTopics.add(state.topic);
  check(state.requiredCount>=1 && state.requiredCount<=3,'valid item count on every turn');
  check(state.round===Math.floor(turn/n)+1,'correct round');
  const current=order[turn%n];
  check(state.currentPlayerId===current,'correct current player across rounds');
  check(state.votedPlayerIds.length===0,'fresh public voting each turn');
  seen.push(current);
  const hand=await getPrivate(roomId,current);
  check(hand.hand.length===3,'hand always three');
  const selected=hand.hand.slice(0,state.requiredCount).map(i=>i.id).reverse();
  const remaining=hand.hand.filter(i=>!selected.includes(i.id));
  if (turn===0) {
   await reject(()=>rpc('pinch_hint_prepare',{...stateArgs(roomId,state),p_selection:[]}), 'wrong selection length');
   await reject(()=>rpc('pinch_hint_prepare',{...stateArgs(roomId,state),p_selection:selected,p_expected_turn_index:99}), 'stale turn');
  }
  state=await rpc('pinch_hint_prepare',{...stateArgs(roomId,state),p_selection:selected});
  check(state.phase==='presenting','presentation starts');
  check(state.revealedItems.length===0,'no selected items public before reveal');
  check(!('hand' in state) && !('selection' in state), 'no private keys in public state');
  const recovered=await getPrivate(roomId,current);
  assert.deepEqual(recovered.selection,selected);
  await reject(()=>rpc('pinch_hint_finish_presentation',stateArgs(roomId,state)), 'finish before all reveals');
  for(let i=0;i<selected.length;i++) {
   state=await rpc('pinch_hint_reveal',{...stateArgs(roomId,state),p_expected_index:i});
   check(state.revealedItems[i].id===selected[i],'reveal ordered selection');
   check(state.revealedItems.length===i+1,'only revealed prefix public');
   await reject(()=>rpc('pinch_hint_reveal',{...stateArgs(roomId,state),p_expected_index:i}), 'duplicate reveal');
  }
  state=await rpc('pinch_hint_finish_presentation',stateArgs(roomId,state));
  await reject(()=>rpc('pinch_hint_vote',{...stateArgs(roomId,state),p_vote:'yes'}), 'presenter cannot vote');
  const voters=order.filter(id=>id!==current);
  let yes=0,no=0;
  for(let v=0;v<voters.length;v++) {
   await actor(voters[v]);
   if(v===0) await reject(()=>rpc('pinch_hint_vote',{...stateArgs(roomId,state),p_vote:null}), 'null vote');
   const vote=mode==='allNo' || (mode==='tie' && v%2===1) ? 'no':'yes';
   if(vote==='yes')yes++;else no++;
   state=await rpc('pinch_hint_vote',{...stateArgs(roomId,state),p_vote:vote});
   check(state.phase===(v===voters.length-1?'result':'voting'),'tally only after all voters');
   if(v<voters.length-1) await reject(()=>rpc('pinch_hint_vote',{...stateArgs(roomId,state),p_vote:vote}), 'duplicate vote');
  }
  check(state.result.success===(yes>no),'strict majority including ties');
  check(state.result.yes===yes && state.result.no===no,'vote counts reset per turn');
  const replenished=await getPrivate(roomId,current);
  check(replenished.hand.length===3,'hand refilled');
  for(const item of remaining)check(replenished.hand.some(i=>i.id===item.id),'unused item carried');
  await actor(players[0]);
  const previous=state;
  state=await rpc('pinch_hint_next_turn',stateArgs(roomId,state));
  await reject(()=>rpc('pinch_hint_next_turn',stateArgs(roomId,previous)),'duplicate next turn');
 }
 check(state.phase==='finished','match finishes');
 check(Object.values(state.scores).every(s=>s===(mode==='allYes'?rounds:0)),'individual final scores');
 for(const id of order)check(seen.filter(s=>s===id).length===rounds,'everyone gets exactly configured turns');
 await actor('ffffffff-ffff-4fff-8fff-ffffffffffff');
 await reject(()=>rpc('pinch_hint_get_private',{p_room_id:roomId}),'nonmember private read');
 await actor(players[0]);
 await reject(()=>db.query('select * from private.pinch_hint_player_state'),'private tables unavailable directly');
 await reject(()=>db.query("update public.rooms set game_state=game_state || '{\"scores\":{}}' where id=$1",[roomId]),'direct game state writes blocked');

}

// This runs the actual migration/RPCs as the authenticated role, with a minimal
// room/auth fixture and the repository's existing room-permission trigger.
afterAll(async () => { await db.close(); });
describe('pinch-hint PostgreSQL game flow', () => {
  it('fails ties with three players and prevents duplicate actions', async () => {
    await runMatch(3, 1, 'tie');
  }, 30000);
  it('completes four players × two rounds, preserving unused cards', async () => {
    await runMatch(4, 2);
  }, 30000);
  it('completes two players × three rounds with individual scores', async () => {
    await runMatch(2, 3);
  }, 30000);
  it('handles ten players across all three rounds without repeating topics', async () => {
    await runMatch(10, 3);
  }, 30000);
  it('awards no points for a no majority', async () => {
    await runMatch(2, 1, 'allNo');
  }, 30000);
  it('rejects invalid settings, other actors, changed rosters and stale match requests', async () => {
    const roomId = await room(3);
    await actor(players[1]);
    await reject(() => rpc('pinch_hint_initialize', {p_room_id:roomId,p_rounds:1}), 'nonhost start');
    await actor(players[0]);
    for (const rounds of [null, 0, 4]) {
      await reject(() => rpc('pinch_hint_initialize', {p_room_id:roomId,p_rounds:rounds}), 'invalid rounds');
    }
    let state = await rpc('pinch_hint_initialize', {p_room_id:roomId,p_rounds:1});
    const originalMatch = state.matchId;
    await reject(() => rpc('pinch_hint_initialize', {p_room_id:roomId,p_rounds:1}), 'repeated start');
    await reject(() => db.query('update public.rooms set players=$1 where id=$2', ['[]', roomId]), 'direct roster change');
    await actor(players[1]);
    await reject(() => db.query('select public.leave_room($1)', [roomId]), 'generic leave during match');
    await actor(players[0]);
    await reject(() => db.query('select public.remove_room_players($1,$2)', [roomId,[players[1]]]), 'generic kick during match');
    const presenter = state.currentPlayerId;
    const own = await getPrivate(roomId, presenter);
    const args = {...stateArgs(roomId,state),p_selection:own.hand.slice(0,state.requiredCount).map(item => item.id)};
    await actor(state.turnOrder.find(id => id !== presenter));
    await reject(() => rpc('pinch_hint_prepare',args), 'nonpresenter start');
    await actor(presenter);
    await reject(() => rpc('pinch_hint_prepare',{...args,p_expected_match_id:null}), 'missing match');
    await reject(() => rpc('pinch_hint_prepare',{...args,p_expected_match_id:'old-match'}), 'old match');
    await reject(() => rpc('pinch_hint_prepare',{...args,p_expected_turn_index:null}), 'missing turn');
    state = await rpc('pinch_hint_prepare',args);
    await reject(() => rpc('pinch_hint_prepare',args), 'selection locks when presenting');
    await reject(() => rpc('pinch_hint_reveal',{...stateArgs(roomId,state),p_expected_index:null}), 'missing reveal index');
    await actor(players[0]);
    await db.query("update public.rooms set status='waiting',game_state='{}' where id=$1",[roomId]);
    await reject(() => rpc('pinch_hint_get_private',{p_room_id:roomId}), 'private state inaccessible in lobby');
    await db.query("update public.rooms set status='playing' where id=$1",[roomId]);
    state = await rpc('pinch_hint_initialize',{p_room_id:roomId,p_rounds:1});
    check(state.matchId !== originalMatch, 'new match identity');
    const nextHand = await getPrivate(roomId,state.currentPlayerId);
    await reject(() => rpc('pinch_hint_prepare',{...stateArgs(roomId,state),p_expected_match_id:originalMatch,p_selection:nextHand.hand.slice(0,state.requiredCount).map(item=>item.id)}), 'old match at same turn index');
    await actor(null);
    await reject(() => rpc('pinch_hint_get_private',{p_room_id:roomId}), 'anonymous access');
  }, 30000);
  it('loads exactly the maintained fixed content and exposes only the callers own hand', async () => {
    const roomId = await room(4);
    await actor(players[0]);
    await rpc('pinch_hint_initialize',{p_room_id:roomId,p_rounds:1});
    await db.exec('reset role');
    const content = JSON.parse(await readFile(`${root}/src/games/pinch-hint/content.json`,'utf8'));
    const pools = (await db.query('select public.pinch_hint_item_pool() items, public.pinch_hint_topic_pool() topics')).rows[0];
    assert.deepEqual(pools,content);
    const privateRows = (await db.query('select player_id,hand from private.pinch_hint_player_state where room_id=$1',[roomId])).rows;
    for (const row of privateRows) {
      const own = await getPrivate(roomId,row.player_id);
      assert.deepEqual(own.hand,row.hand);
      check(own.hand.length===3 && new Set(own.hand.map(item=>item.id)).size===3,'unique starting hand');
      await reject(() => db.query("update private.pinch_hint_player_state set hand='[]' where room_id=$1",[roomId]),'no private direct mutation');
    }
  }, 30000);

});
