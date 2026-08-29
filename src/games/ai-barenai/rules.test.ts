import { describe, expect, it } from 'vitest';
import { buildPublicResult, getAnswerMatchResult, getCyclicAssignments, nextAssignmentCursor, selectWinner, validateGeminiGuess, validateGeminiSemantic } from './rules';

describe('AIにバレるな！ rules', () => {
  it('matches NFKC, case, and safe whitespace exactly', () => {
    expect(getAnswerMatchResult('  Ｐｉｚｚａ\n', 'Pizza', [])).toBe('correct');
    expect(getAnswerMatchResult('  New   York ', 'Tokyo', ['NEW YORK'])).toBe('correct');
    expect(getAnswerMatchResult('ピザ屋', 'ピザ', [])).toBe('semantic-needed');
  });
  it('cycles assignment order and wraps', () => {
    expect(getCyclicAssignments(['a','b','c','d'], 0, 1)).toEqual(['a']);
    expect(getCyclicAssignments(['a','b','c','d'], 2, 2)).toEqual(['c','d']);
    expect(getCyclicAssignments(['a','b','c','d'], 3, 3)).toEqual(['d','a','b']);
    expect(nextAssignmentCursor(3, 3, 4)).toBe(2);
  });
  it('AI wins ties', () => {
    expect(selectWinner(true, true)).toBe('ai');
    expect(selectWinner(true, false)).toBe('humans');
    expect(selectWinner(false, false)).toBe('draw');
  });
  it('validates structured Gemini guesses', () => {
    expect(validateGeminiGuess({answer: '猫', confidence: 88})).toEqual({answer: '猫', confidence: 88});
    expect(validateGeminiGuess({answer: '猫', confidence: 101})).toBeNull();
    expect(validateGeminiGuess({answer: '', confidence: 20})).toBeNull();
  });
  it('hides topic until the final game-over result', () => {
    const input = {winner: 'draw' as const, topic: '秘密', humanAnswer: 'x', aiAnswer: 'y', aiConfidence: 20, humanCorrect: false, aiCorrect: false};
    expect(buildPublicResult(input, 'revealing').topic).toBeNull();
    expect(buildPublicResult(input, 'game_over').topic).toBe('秘密');
  });
  it('validates semantic Gemini responses', () => {
    expect(validateGeminiSemantic({correct: true})).toBe(true);
    expect(validateGeminiSemantic({correct: 'true'})).toBeNull();
  });
});
