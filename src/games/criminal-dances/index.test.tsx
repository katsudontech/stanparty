import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardConfirmation, resultLabel } from './index';
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
