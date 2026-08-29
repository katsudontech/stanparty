import { describe, expect, it } from 'vitest';
import { isAiBarenaiHostAction } from './authorization';

describe('AIにバレるな！のホスト専用操作', () => {
  it('進行操作はホスト専用', () => {
    for (const action of ['initialize', 'guess', 'judge', 'next-round', 'resume'] as const) {
      expect(isAiBarenaiHostAction(action)).toBe(true);
    }
  });

  it('参加者操作とお題表示はホスト専用ではない', () => {
    for (const action of ['hint', 'answer', 'topic'] as const) {
      expect(isAiBarenaiHostAction(action)).toBe(false);
    }
  });
});
