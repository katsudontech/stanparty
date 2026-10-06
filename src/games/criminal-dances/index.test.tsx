import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardConfirmation, CriminalDancesCardTile, CriminalDancesLastPlayedCard, CriminalDancesModal, CriminalDancesSecret, CriminalDancesStartScreen, resultLabel } from './index';
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
  it('shows a compact host start screen and locks guests to waiting', () => {
    const start = () => Promise.resolve();
    const players = [
      { userId: 'host', name: 'ホスト', avatarUrl: '', isHost: true, color: '#fff', isOnline: true },
      { userId: 'guest', name: 'ゲスト', avatarUrl: '', isHost: false, color: '#000', isOnline: true },
      { userId: 'guest2', name: 'ゲスト2', avatarUrl: '', isHost: false, color: '#000', isOnline: true },
    ];
    const hostHtml = renderToStaticMarkup(createElement(CriminalDancesStartScreen, { isHost: true, busy: false, error: null, players, onStart: start }));
    const busyHostHtml = renderToStaticMarkup(createElement(CriminalDancesStartScreen, { isHost: true, busy: true, error: null, players, onStart: start }));
    const guestHtml = renderToStaticMarkup(createElement(CriminalDancesStartScreen, { isHost: false, busy: false, error: null, players, onStart: start }));
    expect(hostHtml).toContain('ゲームを始める');
    expect(hostHtml).toContain('最後の1枚まで、犯人を追え');
    expect(hostHtml).toContain('第一発見者が事件を始める');
    expect(hostHtml).toContain('3人');
    expect(hostHtml).toContain('4枚');
    expect(hostHtml).toContain('3/8');
    expect(hostHtml).toContain('ホスト');
    expect(hostHtml).not.toContain('ゲームを中断してロビーへ戻る');
    expect(busyHostHtml).toContain('準備中…');
    expect(busyHostHtml).toContain('aria-busy="true"');
    expect(guestHtml).toContain('ホストが開始するまでお待ちください');
    expect(guestHtml).not.toContain('ゲームを始める');
    expect(guestHtml).not.toContain('<button');
  });

  it('renders physical card selection affordances with the selected state and effect label', () => {
    const html = renderToStaticMarkup(createElement(CriminalDancesCardTile, {
      card: { id: 'detective-1', type: 'detective' }, selected: true, disabled: false, onSelect: () => {},
    }));
    expect(html).toContain('criminal-card--detective');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('探偵');
    expect(html).toContain('type="button"');
    const locked = renderToStaticMarkup(createElement(CriminalDancesCardTile, {
      card: { id: 'culprit-1', type: 'culprit' }, selected: false, disabled: true, reason: '最後の1枚だけ使えます', onSelect: () => {},
    }));
    expect(locked).toContain('aria-disabled="true"');
    expect(locked).not.toContain('disabled=""');
  });

  it('renders the durable last-played card as a prominent battle card', () => {
    const html = renderToStaticMarkup(createElement(CriminalDancesLastPlayedCard, {
      card: { actorId: 'p1', cardType: 'detective' }, actorName: 'プレイヤー1',
    }));
    expect(html).toContain('最後に使ったカード');
    expect(html).toContain('criminal-card--battle criminal-last-played__card');
    expect(html).toContain('探偵');
    expect(html).toContain('プレイヤー1');
  });

  it('keeps modal close controls available to keyboard and pointer users', () => {
    const html = renderToStaticMarkup(createElement(CriminalDancesModal, { title: 'カード詳細', labelledBy: 'card-title', onClose: () => {} }, createElement('p', null, '説明')));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="card-title"');
    expect(html.match(/aria-label="閉じる"/g)).toHaveLength(1);
  });

  it('renders private boy and witness information with a confirmation action', () => {
    const boy = renderToStaticMarkup(createElement(CriminalDancesSecret, {
      reveal: { kind: 'boy', culpritPlayerId: 'p2' }, culpritName: 'プレイヤー2', canConfirm: true, onConfirm: () => {},
    }));
    const witness = renderToStaticMarkup(createElement(CriminalDancesSecret, {
      reveal: { kind: 'witness', targetId: 'p3', cards: [{ id: 'ephemeral-a', type: 'alibi' }, { id: 'ephemeral-b', type: 'culprit' }] }, culpritName: '不明', canConfirm: true, onConfirm: () => {},
    }));
    expect(boy).toContain('プレイヤー2');
    expect(boy).toContain('確認して続ける');
    expect(witness).toContain('アリバイ');
    expect(witness).toContain('犯人');
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
