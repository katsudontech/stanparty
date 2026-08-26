import { describe, expect, it } from 'vitest';

import { GAME_CATALOG, getGamePlayerCountError } from './catalog';

describe('game catalog details', () => {
  it('ロビーで各ゲームの詳しいルールを表示できる', () => {
    GAME_CATALOG.forEach((game) => {
      expect(game.description.length).toBeGreaterThanOrEqual(2);
      expect(game.steps.length).toBeGreaterThanOrEqual(4);
      expect(game.tips.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('game player count', () => {
  it.each([
    ['fake-artist', 2, 'エセ芸術家は3人以上で遊べます。あと1人必要です'],
    ['coyote', 1, 'Coyoteは2人以上で遊べます。あと1人必要です'],
    ['ito', 1, 'itoは2人以上で遊べます。あと1人必要です'],
  ])('%s は最少人数未満で開始できない', (gameId, playerCount, expectedMessage) => {
    expect(getGamePlayerCountError(gameId, playerCount)).toBe(expectedMessage);
  });

  it.each([
    ['fake-artist', 3],
    ['fake-artist', 10],
    ['coyote', 2],
    ['coyote', 10],
    ['ito', 2],
    ['ito', 14],
  ])('%s は対応人数の範囲内なら開始できる', (gameId, playerCount) => {
    expect(getGamePlayerCountError(gameId, playerCount)).toBeNull();
  });

  it.each([
    ['fake-artist', 11, 'エセ芸術家は10人までで遊べます'],
    ['coyote', 11, 'Coyoteは10人までで遊べます'],
    ['ito', 15, 'itoは14人までで遊べます'],
  ])('%s は最大人数を超えると開始できない', (gameId, playerCount, expectedMessage) => {
    expect(getGamePlayerCountError(gameId, playerCount)).toBe(expectedMessage);
  });

  it('未対応のゲームは開始できない', () => {
    expect(getGamePlayerCountError('unknown', 4)).toBe('選択したゲームは現在プレイできません');
  });
});
