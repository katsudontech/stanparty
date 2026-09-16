import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FAKE_ARTIST_STATE, type FakeArtistGameState } from '../types';
import { DrawingPhase } from './DrawingPhase';
import { GuessingPhase } from './GuessingPhase';
import { ResultPhase } from './ResultPhase';
import { TurnOrder } from './TurnOrder';
import { VoteBreakdown } from './VoteBreakdown';

vi.mock('./Canvas', () => ({ Canvas: () => <div>Canvas</div> }));
vi.mock('@/components/shared/Avatar', async () => import('../../../components/shared/Avatar'));
const players = Array.from({ length: 10 }, (_, i) => ({
  userId: `p${i}`, name: `プレイヤー${i}とても長い名前`, color: '#123456', avatarUrl: '', isHost: i === 0, isOnline: true,
}));
const gameState: FakeArtistGameState = {
  ...DEFAULT_FAKE_ARTIST_STATE, phase: 'drawing', currentTurnPlayerId: 'p2',
  turnOrder: ['p2', 'p1', 'p0', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
  playerStates: Object.fromEntries(players.map((p, i) => [p.userId, { role: i === 9 ? 'questioner' : i === 2 ? 'fake_artist' : 'artist', color: '#abcdef', score: 0 }])),
  votes: { p0: 'p2', p1: 'p2', p2: 'p1' }, theme: '猫', themeGenre: '動物',
};
const common = { players, gameState, roomId: 'room', myUserId: 'p2' };
const noop = async () => {};

describe('Fake Artist phase displays', () => {
  it('only renders the turn notification for the active player', () => {
    expect(renderToStaticMarkup(createElement(DrawingPhase, common))).toContain('あなたの番です！');
    for (const myUserId of ['p1', null]) {
      expect(renderToStaticMarkup(createElement(DrawingPhase, { ...common, myUserId }))).not.toContain('あなたの番です！');
    }
  });
  it('preserves drawing order, highlights only the current player and includes the non-drawing questioner', () => {
    const html = renderToStaticMarkup(createElement(TurnOrder, common));
    const labels = [...html.matchAll(/<li[^>]*aria-label="([^"]*)"/g)].map(match => match[1]);
    expect(labels).toHaveLength(10);
    gameState.turnOrder.forEach((id, i) => expect(labels[i]).toContain(`${i + 1}. ${players.find(p => p.userId === id)!.name}`));
    expect(labels[9]).toContain('出題者 / 描画なし');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(labels[0]).toContain('いまの番');
    expect(html).toContain('background-color:#abcdef');
    expect(html).toContain('grid-cols-4');
    expect(html).toContain('truncate');
  });
  it('renders voter to target pairs, including graceful fallback for old games and departed players', () => {
    const html = renderToStaticMarkup(createElement(VoteBreakdown, common));
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain('の投票先');
    expect(html.indexOf(players[0].name)).toBeLessThan(html.indexOf(players[2].name));
    expect(renderToStaticMarkup(createElement(VoteBreakdown, { players, gameState: { ...gameState, votes: {} } }))).toContain('投票の記録がありません');
    expect(renderToStaticMarkup(createElement(VoteBreakdown, { players: [], gameState }))).toContain('退出したプレイヤー');
  });
  it('shows the fake artist and votes to everyone in guessing without disclosing the theme', () => {
    for (const myUserId of ['p0', 'p1', 'p2']) {
      const html = renderToStaticMarkup(createElement(GuessingPhase, { ...common, myUserId, gameState: { ...gameState, phase: 'guessing' }, hostId: 'p0', onGuessSubmit: noop, onJudgeSubmit: noop }));
      expect(html).toContain(`${players[2].name}さんでした`);
      expect(html).toContain('投票結果');
      expect(html).not.toContain('猫');
    }
  });
  it('shows reveal, votes and roles in order, retaining the winner, theme and canvas', () => {
    const html = renderToStaticMarkup(createElement(ResultPhase, { ...common, gameState: { ...gameState, phase: 'result', winner: 'fake_artist' }, isHost: false, onResetGame: noop }));
    expect(html.indexOf('さんでした')).toBeLessThan(html.indexOf('投票結果'));
    expect(html.indexOf('投票結果')).toBeLessThan(html.indexOf('プレイヤーの役職'));
    for (const text of ['エセ芸術家の勝利！', '猫', 'Canvas', '出題者', '芸術家']) expect(html).toContain(text);
  });
});
