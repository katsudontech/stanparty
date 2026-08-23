import { describe, expect, it } from 'vitest';

import {
  dealItoCards,
  drawRandomTheme,
  getIncorrectItoCardIds,
  getMaxCardsPerPlayer,
  isItoOrderCorrect,
  isValidItoPlayerCount,
  moveCardInOrder,
} from './rules';

const cards = [
  { id: 'a:1', ownerId: 'a', ownerCardNumber: 1, value: 10, hint: '' },
  { id: 'b:1', ownerId: 'b', ownerCardNumber: 1, value: 30, hint: '' },
  { id: 'c:1', ownerId: 'c', ownerCardNumber: 1, value: 20, hint: '' },
];

describe('ito rules', () => {
  it('2〜14人を有効な参加人数として扱う', () => {
    expect(isValidItoPlayerCount(1)).toBe(false);
    expect(isValidItoPlayerCount(2)).toBe(true);
    expect(isValidItoPlayerCount(14)).toBe(true);
    expect(isValidItoPlayerCount(15)).toBe(false);
  });

  it('人数に応じた1人あたりの最大枚数を計算する', () => {
    expect(getMaxCardsPerPlayer(4)).toBe(25);
    expect(getMaxCardsPerPlayer(14)).toBe(7);
    expect(getMaxCardsPerPlayer(0)).toBe(0);
  });

  it('全員に指定枚数を重複なしで配る', () => {
    const dealtCards = dealItoCards(['a', 'b', 'c'], 2, () => 0.5);

    expect(dealtCards).toHaveLength(6);
    expect(new Set(dealtCards.map((card) => card.value)).size).toBe(6);
    expect(dealtCards.filter((card) => card.ownerId === 'a')).toHaveLength(2);
  });

  it('配布可能枚数を超える指定を拒否する', () => {
    expect(() => dealItoCards(['a', 'b'], 51)).toThrow('1〜50枚');
  });

  it('カードを未配置の状態から指定位置に入れられる', () => {
    expect(moveCardInOrder(['a:1', 'b:1'], 'c:1', 1)).toEqual(['a:1', 'c:1', 'b:1']);
  });

  it('配置済みカードを重複させずに移動できる', () => {
    expect(moveCardInOrder(['a:1', 'b:1', 'c:1'], 'a:1', 2)).toEqual([
      'b:1',
      'c:1',
      'a:1',
    ]);
  });

  it('完全な昇順を成功と判定する', () => {
    expect(isItoOrderCorrect(cards, ['a:1', 'c:1', 'b:1'])).toBe(true);
  });

  it('未配置カードがあれば成功にしない', () => {
    expect(isItoOrderCorrect(cards, ['a:1', 'c:1'])).toBe(false);
  });

  it('逆順になった両側のカードを特定する', () => {
    expect(getIncorrectItoCardIds(cards, ['a:1', 'b:1', 'c:1'])).toEqual(['b:1', 'c:1']);
  });

  it('直前と異なるランダムなお題を選ぶ', () => {
    expect(drawRandomTheme(['A', 'B', 'C'], 'A', () => 0)).toBe('B');
  });
});
