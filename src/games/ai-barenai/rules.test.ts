import { describe, expect, it } from 'vitest';
import { buildAiBarenaiGuessPrompt, buildPublicResult, getAnswerMatchResult, getCyclicAssignments, nextAssignmentCursor, selectWinner, validateGeminiGuess, validateGeminiSemantic } from './rules';

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
  it('includes only prior-round answer strings in the Gemini context', () => {
    const prompt = buildAiBarenaiGuessPrompt(
      [{round: 2, hints: ['青い', '海']}],
      [
        {round: 1, humanAnswer: '人間の答え', aiAnswer: 'AIの答え', aiConfidence: 91, humanCorrect: false, aiCorrect: true, aiError: false, topic: '秘密のお題', aliases: ['別名']},
        {round: 2, humanAnswer: '現在ラウンドの答え', aiAnswer: '現在ラウンドのAI答え', aiConfidence: 10, humanCorrect: true, aiCorrect: false, aiError: false},
      ],
      2,
    );
    expect(prompt).toContain('人間の答え');
    expect(prompt).toContain('AIの答え');
    expect(prompt).toContain('青い');
    expect(prompt).not.toContain('現在ラウンドの答え');
    expect(prompt).not.toContain('現在ラウンドのAI答え');
    expect(prompt).not.toContain('秘密のお題');
    expect(prompt).not.toContain('別名');
    expect(prompt).not.toContain('aiConfidence');
    expect(prompt).not.toContain('humanCorrect');
  });
});
