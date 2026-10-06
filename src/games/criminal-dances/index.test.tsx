import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardConfirmation, CriminalDancesStartScreen, resultLabel } from './index';
import type { CriminalDancesPrivateState } from './types';

const resultState = (reason: 'culprit_escaped' | 'detective_caught'): CriminalDancesPrivateState => ({
  game: 'criminal-dances',
  version: 1,
  matchId: 'match',
  revision: 4,
  phase: 'finished',
  turnOrder: ['winner', 'culprit', 'other'],
  currentPlayerIndex: 0,
  round: 2,
  firstDiscovererPlayerId: 'winner',
  firstDiscovererPlayed: true,
  players: {
    winner: { id: 'winner', handCount: 0, played: [], conspirator: false },
    culprit: { id: 'culprit', handCount: 0, played: [], conspirator: false },
    other: { id: 'other', handCount: 0, played: [], conspirator: false },
  },
  lastAction: null,
  pending: null,
  outcome: {
    reason,
    culpritPlayerId: 'culprit',
    captorPlayerId: 'winner',
    winners: ['winner'],
    conspirators: [],
  },
  incidentText: null,
  revealedCardType: null,
  myPlayerId: 'winner',
  myHand: [],
  privateReveal: null,
});

describe('criminal dances UI projections', () => {
  it('shows the fixed settings and host-only start action before cards are dealt', () => {
    const start = () => Promise.resolve();
    const players = [
      { userId: 'host', name: 'ホスト', avatarUrl: '', isHost: true, color: '#fff', isOnline: true },
      { userId: 'guest', name: 'ゲスト', avatarUrl: '', isHost: false, color: '#000', isOnline: true },
      { userId: 'guest2', name: 'ゲスト2', avatarUrl: '', isHost: false, color: '#000', isOnline: true },
    ];
    const hostHtml = renderToStaticMarkup(createElement(CriminalDancesStartScreen, { isHost: true, busy: false, error: null, players, onStart: start, onAbort: start }));
    const guestHtml = renderToStaticMarkup(createElement(CriminalDancesStartScreen, { isHost: false, busy: false, error: null, players, onStart: start, onAbort: start }));
    expect(hostHtml).toContain('この設定で開始');
    expect(hostHtml).toContain('3〜8人');
    expect(hostHtml).toContain('3人（3〜8人）');
    expect(hostHtml).toContain('ホスト');
    expect(hostHtml).toContain('1人4枚');
    expect(guestHtml).toContain('ホストが設定を確認して開始するまでお待ちください');
    expect(guestHtml).not.toContain('この設定で開始');
  });

  it('renders an enabled trade confirmation independently of whose turn it is', () => {
    const html = renderToStaticMarkup(createElement(CardConfirmation, { allowed: true, trade: true, onConfirm: () => {} }));
    expect(html).toContain('渡すカードを確定');
    expect(html).not.toContain('disabled');
    expect(renderToStaticMarkup(createElement(CardConfirmation, { allowed: false, trade: false, onConfirm: () => {} }))).toContain('disabled');
  });

  it('renders victory and defeat labels for every player when the culprit escapes', () => {
    const state = resultState('culprit_escaped');
    const html = renderToStaticMarkup(createElement('div', null,
      resultLabel(state, 'winner'),
      resultLabel(state, 'culprit'),
      resultLabel(state, 'other'),
    ));
    expect(html).toContain('勝利');
    expect(html.match(/敗北/g)).toHaveLength(2);
  });

  it('keeps non-winning players distinguishable when detectives catch the culprit', () => {
    const state = resultState('detective_caught');
    expect(resultLabel(state, 'winner')).toBe('勝利');
    expect(resultLabel(state, 'culprit')).toBe('敗北');
    expect(resultLabel(state, 'other')).toBe('その他');
  });
});
