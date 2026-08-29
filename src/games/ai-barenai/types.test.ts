import { describe, expect, it } from 'vitest';
import { createDefaultAiBarenaiState, normalizeAiBarenaiGameState } from './types';

describe('AIにバレるな！ state answer history', () => {
  it('defaults new and old states to an empty answer history', () => {
    expect(createDefaultAiBarenaiState().answerHistory).toEqual([]);
    expect(normalizeAiBarenaiGameState({game: 'ai-barenai', version: 1}).answerHistory).toEqual([]);
    expect(normalizeAiBarenaiGameState({game: 'ai-barenai', version: 1, answerHistory: {round: 1}}).answerHistory).toEqual([]);
  });

  it('keeps a fully valid answer history entry', () => {
    const entry = {round: 1, humanAnswer: '猫', aiAnswer: '犬', aiConfidence: 72, humanCorrect: true, aiCorrect: false, aiError: false};
    expect(normalizeAiBarenaiGameState({game: 'ai-barenai', version: 1, answerHistory: [entry]}).answerHistory).toEqual([entry]);
    expect(normalizeAiBarenaiGameState({game: 'ai-barenai', version: 1, answerHistory: [entry, {round: 2}]}).answerHistory).toEqual([]);
  });
});
