import { describe, expect, it } from 'vitest';
import {
  COYOTE_CARDS,
  calculateCoyoteTotal,
  resolveCoyoteRound
} from './rules';
import type { CoyotePlayerState } from './types';

function players(
  cards: Array<[userId: string, hp: number, card: string]>
): Record<string, CoyotePlayerState> {
  return Object.fromEntries(
    cards.map(([userId, hp, currentCard]) => [
      userId,
      { hp, currentCard }
    ])
  );
}

describe('calculateCoyoteTotal', () => {
  it('通常カードとマイナスカードを合計する', () => {
    const result = calculateCoyoteTotal(
      [],
      players([
        ['a', 2, '5'],
        ['b', 2, '10'],
        ['c', 2, '-5']
      ])
    );

    expect(result).toEqual({ result: 10, questionRevealedCard: null });
  });

  it('doubleが最終結果を2倍にする', () => {
    const result = calculateCoyoteTotal(
      [],
      players([
        ['a', 2, '5'],
        ['b', 2, 'double']
      ])
    );

    expect(result.result).toBe(10);
  });

  it('max0が最大の通常カードを0として扱う', () => {
    const result = calculateCoyoteTotal(
      [],
      players([
        ['a', 2, '5'],
        ['b', 2, '10'],
        ['c', 2, 'max0']
      ])
    );

    expect(result.result).toBe(5);
  });

  it('questionが山札から公開したカードを合計する', () => {
    const result = calculateCoyoteTotal(
      ['10', '-5'],
      players([
        ['a', 2, '2'],
        ['b', 2, 'question']
      ]),
      () => 0
    );

    expect(result).toEqual({ result: 12, questionRevealedCard: '10' });
  });

  it('r0を0として合計する', () => {
    const result = calculateCoyoteTotal(
      [],
      players([
        ['a', 2, 'r0'],
        ['b', 2, '-5']
      ])
    );

    expect(result.result).toBe(-5);
  });
});

describe('resolveCoyoteRound', () => {
  it('敗者のHPを1減らし、入力stateは変更しない', () => {
    const original = players([
      ['a', 3, '5'],
      ['b', 3, '10']
    ]);

    const result = resolveCoyoteRound({
      loserId: 'a',
      coyotePlayers: original,
      currentDeck: ['r0', '1', '2'],
      playerIds: ['a', 'b'],
      random: () => 0
    });

    expect(result?.coyotePlayers.a.hp).toBe(2);
    expect(original.a.hp).toBe(3);
  });

  it('生存者が1人になったら勝者を確定する', () => {
    const result = resolveCoyoteRound({
      loserId: 'b',
      coyotePlayers: players([
        ['a', 1, '5'],
        ['b', 1, '10']
      ]),
      currentDeck: ['r0'],
      playerIds: ['a', 'b']
    });

    expect(result).toMatchObject({
      phase: 'result',
      winnerId: 'a',
      coyotePlayers: {
        a: { hp: 1 },
        b: { hp: 0 }
      }
    });
  });

  it('次ラウンドでは生存者へ再配布し、宣言状態を解除する', () => {
    const result = resolveCoyoteRound({
      loserId: 'a',
      coyotePlayers: players([
        ['a', 2, '5'],
        ['b', 2, '10']
      ]),
      currentDeck: ['r0', '1', '2'],
      playerIds: ['a', 'b'],
      random: () => 0
    });

    expect(result).toEqual({
      phase: 'playing',
      coyotePlayers: {
        a: { hp: 1, currentCard: 'r0' },
        b: { hp: 2, currentCard: '1' }
      },
      currentDeck: ['2'],
      coyoteCallerId: undefined,
      coyoteTotalValue: undefined,
      questionRevealedCard: undefined
    });
  });

  it('r0が山札からなくなったら全カードをリセットして配る', () => {
    const result = resolveCoyoteRound({
      loserId: 'a',
      coyotePlayers: players([
        ['a', 2, '5'],
        ['b', 2, '10']
      ]),
      currentDeck: ['1', '2', '3'],
      playerIds: ['a', 'b'],
      random: () => 0
    });

    expect(result?.phase).toBe('playing');
    if (result?.phase !== 'playing') throw new Error('次ラウンドへ遷移しませんでした');

    expect(result.currentDeck).toHaveLength(COYOTE_CARDS.length - 2);
    expect(result.coyotePlayers.a.currentCard).toBe('0');
    expect(result.coyotePlayers.b.currentCard).toBe('0');
  });
});
