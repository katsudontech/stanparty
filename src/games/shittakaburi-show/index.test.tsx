import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShittakaburiShowScreen } from './index';
import { applyAction, createGameState, toPrivateState, type State } from './rules';
import type { RoomState } from '@/games/core/types';
const ids=['A','B','C'];
const room={id:'room',host_id:'A',game_type:'shittakaburi-show',status:'playing',players:ids.map(userId=>({userId,name:userId})),game_state:{}} as RoomState;
function render(s:State|null,actor='A',isAuthor?:boolean) { return renderToStaticMarkup(createElement(ShittakaburiShowScreen,{roomState:room,myUserId:actor,onBackToLobby:async()=>{},state:s?{...toPrivateState(s,actor),...(isAuthor === undefined ? {} : {isAuthor})}:null,error:null,action:async()=>true,retry:()=>{},initialize:async()=>{},snapshotAvailable:false})); }
function act(s:State,actor:string,action:string,value?:string) {return applyAction(s,actor,'A',action,value,`${s.revision}-${actor}`,()=>0);}
describe('game phase screens',()=>{
  it('shows registration guidance and shared speaking order without exposing personal roles',()=>{
    let s=createGameState(ids);expect(render(s)).toContain('自分だけが知っているお題を書こう！');expect(render(s)).toContain('言葉だけを入力して、意味はまだ書かないでください。');expect(render(null,'B')).toContain('ホストの開始を待っています');
    for(const id of ids)s=act(s,id,'word',id+'-secret');
    expect(render(s)).not.toContain('shitta-role');expect(render(s)).not.toContain('あなたが出題者です');expect(render(s)).toContain('全員の発表後は自由に質問');expect(render(s,'A',true)).toBe(render(s,'A',false));
    s=act(s,'A','start-vote');expect(render(s)).toContain('投票する相手を選ぼう');expect(render(s)).toContain('出題者以外の人は、この単語を出したと思う人へ。出題者は、いちばん本当っぽい解説をした人へ投票してください。');expect(render(s,'A',true)).toBe(render(s,'A',false));expect(render(s)).not.toContain('shitta-role');
    expect(render(s)).not.toContain('aria-pressed="false">A</button>');
  });
  it('reveals only votes first then author and detailed score breakdown and replay',()=>{
    let s=createGameState(ids);for(const id of ids)s=act(s,id,'word',id+'-secret');s=act(s,'A','start-vote');
    for(const id of ids)s=act(s,id,'vote',id==='A'?'B':'A');
    const votes=render(s);expect(votes).toContain('出題者を発表');expect(votes).not.toContain('あなたが出題者です');expect(votes).not.toContain('本当の出題者は');expect(votes).not.toContain('累計ランキング');
    s=act(s,'A','reveal-author');expect(render(s)).toContain('本当の出題者は A');expect(render(s)).toContain('正解1点');expect(render(s)).toContain('次のお題へ');
    s=act(s,'A','end');expect(render(s)).toContain('最終ランキング');expect(render(s)).toContain('>ロビーに戻る</button>');expect(render(s)).not.toContain('ロビーに戻る・もう一度遊ぶ');expect(render(s)).not.toContain('C-secret');
  });
});
