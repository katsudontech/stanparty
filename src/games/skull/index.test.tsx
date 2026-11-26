import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkullRound } from './index';
import { applyAction, createGameState, toPrivateState, type Action, type GameState } from './rules';

const create = () => createGameState(['a', 'b', 'c'], 'match', () => 0);
const step = (state: GameState, actor: string, action: Action, value?: string | number) =>
  applyAction(state, actor, 'a', action, value, `action-${state.revision}`, () => 0);
const render = (game: GameState, user = 'a') =>
  renderToStaticMarkup(createElement(SkullRound, {
    state: toPrivateState(game, user), myUserId: user, host: user === 'a', busy: false, name: id => id,
    action: async () => {}, onBackToLobby: async () => {},
  }));

describe('Skull table', () => {
  it('renders all stacks face down and leaves private choices out of the default markup', () => {
    const opening = step(create(), 'a', 'place', '4');
    const own = render(opening);
    expect(own).toContain('長押しで自分のディスクを見る');
    expect(own).toContain('aria-label="裏向き"');
    expect(own).not.toContain('aria-label="ドクロ"');
    expect(own).not.toContain('aria-label="花"');
    expect(own).not.toContain('置くディスクを選ぶ');
    expect(own).toContain('置きました');
    const other = render(opening, 'b');
    expect(other).toContain('置くディスクを選ぶ');
    expect(other).not.toContain('aria-label="ドクロ"');
    expect(other).not.toContain('aria-label="花"');
  });

  it('offers only the legal reveal targets, then privately offers discard selection', () => {
    let state = create();
    for (const id of ['a', 'b', 'c']) state = step(state, id, 'place', id === 'a' ? '4' : '1');
    state = step(state, 'a', 'bid', 3);
    expect(render(state)).toContain('aの山の一番上をめくる');
    expect(render(state)).not.toContain('bの山の一番上をめくる');
    expect(render(state, 'b')).not.toContain('一番上をめくる');
    state = step(state, 'a', 'reveal', 'a');
    expect(render(state)).toContain('失うディスクを選ぶ');
    expect(render(state, 'b')).not.toContain('失うディスクを選ぶ');
    state = step(state, 'a', 'choose-loss', '1');
    expect(render(state)).toContain('次のラウンドへ');
    expect(render(state)).not.toContain('失ったディスクは');
    expect(render(state)).not.toContain('aria-label="花"');
    expect(render(state, 'b')).not.toContain('次のラウンドへ');
  });

  it('shows an eliminated participant the public result and the host the finished lobby action', () => {
    let state = create();
    state.seats[1].discs = state.seats[1].discs.slice(-1);
    state.seats[2].discs = [];
    state.starterId = 'b';
    state = step(step(state, 'a', 'place', '1'), 'b', 'place', '4');
    state = step(state, 'b', 'bid', 2);
    state = step(state, 'b', 'reveal', 'b');
    state = step(state, 'b', 'choose-loss', '4');
    const eliminated = render(state, 'b');
    expect(eliminated).toContain('最後までディスクが残りました');
    expect(eliminated).toContain('aria-label="裏向き"');
    expect(eliminated).not.toContain('aria-label="花"');
    expect(eliminated).not.toContain('長押し');
    expect(eliminated).not.toContain('>ロビーに戻る<');
    expect(render(state)).toContain('>ロビーに戻る<');
  });
});
