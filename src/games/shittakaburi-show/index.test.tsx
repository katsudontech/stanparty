import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShittakaburiShowScreen } from './index';
import { applyAction, createGameState, toPrivateState, type State } from './rules';
import type { RoomState } from '@/games/core/types';
const ids=['A','B','C'];
const room={id:'room',host_id:'A',game_type:'shittakaburi-show',status:'playing',players:ids.map(userId=>({userId,name:userId})),game_state:{}} as RoomState;
function render(s:State|null,actor='A') { return renderToStaticMarkup(createElement(ShittakaburiShowScreen,{roomState:room,myUserId:actor,onBackToLobby:async()=>{},state:s?toPrivateState(s,actor):null,error:null,action:async()=>true,retry:()=>{},initialize:async()=>{},snapshotAvailable:false})); }
function act(s:State,actor:string,action:string,value?:string) {return applyAction(s,actor,'A',action,value,`${s.revision}-${actor}`,()=>0);}
describe('game phase screens',()=>{
  it('shows registration statuses then personal roles and shared speaking order',()=>{
    let s=createGameState(ids);expect(render(s)).toContain('あなたの言葉');expect(render(null,'B')).toContain('ホストの開始を待っています');
    for(const id of ids)s=act(s,id,'word',id+'-secret');
    expect(render(s)).toContain('あなたが出題者です');expect(render(s,'B')).toContain('知ったかぶり役');expect(render(s)).toContain('全員の発表後は自由に質問');
    s=act(s,'A','start-vote');expect(render(s)).toContain('いちばん本当っぽい解説をしたのは誰？');expect(render(s,'B')).toContain('この単語を出したのは誰？');
    expect(render(s)).not.toContain('aria-pressed="false">A</button>');
  });
  it('reveals only votes first then author and detailed score breakdown and replay',()=>{
    let s=createGameState(ids);for(const id of ids)s=act(s,id,'word',id+'-secret');s=act(s,'A','start-vote');
    for(const id of ids)s=act(s,id,'vote',id==='A'?'B':'A');
    const votes=render(s);expect(votes).toContain('出題者を発表');expect(votes).not.toContain('あなたが出題者です');expect(votes).not.toContain('本当の出題者は');expect(votes).not.toContain('累計ランキング');
    s=act(s,'A','reveal-author');expect(render(s)).toContain('本当の出題者は A');expect(render(s)).toContain('正解1点');expect(render(s)).toContain('次のお題へ');
    s=act(s,'A','end');expect(render(s)).toContain('最終ランキング');expect(render(s)).toContain('ロビーに戻る・もう一度遊ぶ');expect(render(s)).not.toContain('C-secret');
  });
});
