import { describe, expect, it } from 'vitest';

import { DEFAULT_FAKE_ARTIST_STATE } from './types';

describe('fake artist default rule settings', () => {
  it('お題の自動選択が初期状態で有効になっている', () => {
    expect(DEFAULT_FAKE_ARTIST_STATE.ruleSettings).toEqual({
      roundLimit: 2,
      autoThemeSelection: true,
      questionerDraws: false,
    });
  });

  it('ターンの世代番号が0で初期化される', () => {
    expect(DEFAULT_FAKE_ARTIST_STATE.turnRevision).toBe(0);
  });
});
