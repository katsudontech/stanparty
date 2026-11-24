import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGameState, type State } from '@/games/shittakaburi-show/rules';
const mocks = vi.hoisted(() => ({createClient:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.createClient}));
import { POST } from './route';
const roomId='00000000-0000-4000-8000-000000000001';
const ids=Array.from({length:14},(_,i)=>`00000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`);
let state:State;
let room:Record<string,unknown>;
let writes:number;
function req(actor:string, body:Record<string,unknown>, auth=true) { return new Request('https://example.test/api/shittakaburi-show',{method:'POST',headers:{authorization:auth?`Bearer ${actor}`:'','content-type':'application/json'},body:JSON.stringify({roomId,...body})}); }
function command(actor:string,action:string,value?:string,actionId=`action-${actor}-${state.revision}`,extra:Record<string,unknown>={}) { return POST(req(actor,{action,value,actionId,matchId:state.matchId,expectedRevision:state.revision,round:state.round,phase:state.phase,...extra})); }
beforeEach(()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','service');
  state=createGameState(ids,()=>0,'match'); writes=0;
  room={id:roomId,host_id:ids[0],game_type:'shittakaburi-show',status:'playing',players:ids.map(userId=>({userId})),game_state:{},shittakaburi_show_epoch:0};
  const query={select:()=>query,eq:()=>query,single:async()=>({data:structuredClone(room),error:null})};
  mocks.createClient.mockImplementation((_url:string,key:string)=>key==='anon'?{auth:{getUser:async(token:string)=>({data:{user:{id:token}},error:null})}}:{from:()=>query,rpc:async(name:string,args:Record<string,unknown>)=>{
    if(name==='shittakaburi_show_read_state') return {data:structuredClone(state),error:null};
    if(name==='shittakaburi_show_commit_action') {
      if(state.processedActionIds.includes(String(args.p_action_id))) return {data:null,error:null};
      if(args.p_expected_revision!==state.revision) return {data:null,error:{message:'stale revision'}};
      state=args.p_state as State; writes++; return {data:null,error:null};
    }
    if(name==='shittakaburi_show_commit_initial') {state=args.p_state as State;return {data:null,error:null};}
    throw new Error('Unexpected RPC');
  }});
});
describe('authenticated private game API',()=>{
  it('rejects missing auth, nonmembers, missing metadata and nonhost initialization',async()=>{
    expect((await POST(req(ids[0],{},false))).status).toBe(401);
    expect((await POST(req('stranger',{action:'snapshot'}))).status).toBe(403);
    expect((await POST(req(ids[0],{action:'word',value:'word'}))).status).toBe(400);
    expect((await POST(req(ids[1],{action:'initialize'}))).status).toBe(403);
  });
  it('commits all 14 simultaneous submissions and votes with CAS retries, hides secrets, and scores only once',async()=>{
    const words=await Promise.all(ids.map((actor,index)=>command(actor,'word',`秘密${index}`,`word-action-${index}`)));
    expect(words.map(r=>r.status)).toEqual(Array(14).fill(200)); expect(state.ready).toHaveLength(14); expect(state.phase).toBe('discussion');
    const response=await POST(req(ids[1],{action:'snapshot'})); const {data}=await response.json();
    expect(data).not.toHaveProperty('submissions');expect(data).not.toHaveProperty('ownerId');expect(data.myWord).toBeNull();
    expect((await command(ids[1],'start-vote')).status).toBe(400);
    expect((await command(ids[0],'start-vote')).status).toBe(200);
    const votes=await Promise.all(ids.map((actor,index)=>command(actor,'vote',ids[(index+1)%14],`vote-action-${index}`)));
    expect(votes.map(r=>r.status)).toEqual(Array(14).fill(200)); expect(state.phase).toBe('votes');
    const reveal=await POST(req(ids[0],{action:'snapshot'}));expect((await reveal.json()).data).toMatchObject({authorId:null,roundPoints:null,scores:null,isAuthor:null});
    expect((await command(ids[0],'reveal-author',undefined,'reveal-once')).status).toBe(200);const revision=state.revision;const scores=structuredClone(state.scores);
    expect((await command(ids[0],'reveal-author',undefined,'reveal-once',{expectedRevision:revision-1,phase:'votes'})).status).toBe(200);expect(state.revision).toBe(revision);expect(state.scores).toEqual(scores);
    expect((await command(ids[0],'reveal-author',undefined,'reveal-again')).status).toBe(400);
    expect(writes).toBe(30);
  });
  it('rejects delayed round actions and cannot replace a committed vote',async()=>{
    for(const actor of ids) state=applyAction(state,actor,ids[0],'word','word',`setup-${actor}`,()=>0);
    state=applyAction(state,ids[0],ids[0],'start-vote',null,'start-vote');
    expect((await command(ids[0],'vote',ids[1],'vote-once')).status).toBe(200);const revision=state.revision;
    expect((await command(ids[0],'vote',ids[2],'vote-once',{expectedRevision:revision-1})).status).toBe(200);
    expect((await command(ids[0],'vote',ids[2],'vote-twice')).status).toBe(400);expect(state.votes[ids[0]]).toBe(ids[1]);expect(state.revision).toBe(revision);
    expect((await command(ids[1],'vote',ids[2],'old-round',{round:state.round-1})).status).toBe(409);
    expect((await command(ids[1],'vote',ids[2],'old-match',{matchId:'old'})).status).toBe(409);
  });
});
