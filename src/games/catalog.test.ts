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

  it('各ゲームに固有のSEOコピーがある', () => {
    const seoCopies = GAME_CATALOG.map((game) => game.seo);

    expect(new Set(seoCopies.map((seo) => seo.title)).size).toBe(GAME_CATALOG.length);
    expect(new Set(seoCopies.map((seo) => seo.description)).size).toBe(GAME_CATALOG.length);
    expect(new Set(seoCopies.map((seo) => seo.heading)).size).toBe(GAME_CATALOG.length);
    seoCopies.forEach((seo) => {
      expect(seo.title).toContain('Web');
      expect(seo.description).toContain('スマホ');
      expect(seo.intro).toContain('ブラウザ');
      expect(seo.ctaLabel.length).toBeGreaterThan(0);
    });
  });

  it('コヨーテのSEOコピーは検索結果向けに定義されている', () => {
    const coyote = GAME_CATALOG.find((game) => game.id === 'coyote');

    expect(coyote?.seo.title).toBe('コヨーテ Web版｜スマホ・ブラウザで友達と遊べる');
    expect(coyote?.seo.description).toBe('カードゲーム「コヨーテ」をスマホのブラウザで遊べます。2〜10人対応、アカウント登録不要。友達とルームを作ってリアルタイムでプレイできます。');
    expect(coyote?.seo.heading).toContain('コヨーテ（Coyote）');
  });
});

describe('game player count', () => {
  it.each([
    ['fake-artist', 2, 'エセ芸術家は3人以上で遊べます。あと1人必要です'],
    ['coyote', 1, 'Coyoteは2人以上で遊べます。あと1人必要です'],
    ['ito', 1, 'itoは2人以上で遊べます。あと1人必要です'],
    ['ai-barenai', 1, 'AIにバレるな！は2人以上で遊べます。あと1人必要です'],
    ['ai-barenai-drawing', 1, 'AIにバレるな！お絵かき版は2人以上で遊べます。あと1人必要です'],
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
    ['ai-barenai', 2],
    ['ai-barenai', 14],
    ['ai-barenai-drawing', 2],
    ['ai-barenai-drawing', 14],
  ])('%s は対応人数の範囲内なら開始できる', (gameId, playerCount) => {
    expect(getGamePlayerCountError(gameId, playerCount)).toBeNull();
  });

  it.each([
    ['fake-artist', 11, 'エセ芸術家は10人までで遊べます'],
    ['coyote', 11, 'Coyoteは10人までで遊べます'],
    ['ito', 15, 'itoは14人までで遊べます'],
    ['ai-barenai', 15, 'AIにバレるな！は14人までで遊べます'],
    ['ai-barenai-drawing', 15, 'AIにバレるな！お絵かき版は14人までで遊べます'],
  ])('%s は最大人数を超えると開始できない', (gameId, playerCount, expectedMessage) => {
    expect(getGamePlayerCountError(gameId, playerCount)).toBe(expectedMessage);
  });

  it('未対応のゲームは開始できない', () => {
    expect(getGamePlayerCountError('unknown', 4)).toBe('選択したゲームは現在プレイできません');
  });
});
