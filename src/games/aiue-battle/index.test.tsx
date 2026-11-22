import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiueBoards } from './index';
import { createGameState, toPrivateState } from './rules';
describe('private aiue board rendering', () => {
  it('renders eight seven-cell boards, with hidden opponent padding and visible owner padding', () => {
    const ids=['a','b','c','d','e','f','g','h'];
    const state=createGameState(ids);
    state.phase='playing';
    state.secrets=Object.fromEntries(ids.map(id=>[id,['あ','い','×','×','×','×','×']]));
    state.players.b.cells[0]='あ';
    state.lastAttack={id:'attack-shared',actorId:'a',kana:'あ',hit:true,bonus:true,revealed:{b:[0]}};
    const html=renderToStaticMarkup(createElement(AiueBoards,{state:toPrivateState(state,'a'),myUserId:'a',name:id=>id}));
    expect((html.match(/<article/g)??[])).toHaveLength(8);
    expect((html.match(/<span/g)??[])).toHaveLength(56);
    expect((html.match(/>×</g)??[])).toHaveLength(5);
    expect((html.match(/>\?</g)??[])).toHaveLength(48);
    expect(html).toContain('is-public is-flipping');
    state.phase='finished';
    const result=renderToStaticMarkup(createElement(AiueBoards,{state:toPrivateState(state,'a'),myUserId:'a',name:id=>id}));
    expect((result.match(/>×</g)??[])).toHaveLength(5);
    expect((result.match(/>\?</g)??[])).toHaveLength(48);
  });
});
