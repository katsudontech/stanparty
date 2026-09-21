import { describe, expect, it } from 'vitest';
import { MAX_ACCEPTED_SHAKE_AMOUNT, MAX_TURN_SCORE, SCORE_LEVELS } from './constants';
import { carbonationIncreaseForShakeAmount, dangerLevelForCarbonation, nextTurnIndex, noisyDangerLevel, rankScores, scoreForShakeAmount, scoreWithBurst } from './rules';

describe('carbonated-shake rules', () => {
  it('keeps the accepted amount and score cap derived from the final level', () => {
    const finalLevel = SCORE_LEVELS.at(-1);

    expect(finalLevel).toBeDefined();
    expect(MAX_ACCEPTED_SHAKE_AMOUNT).toBe(finalLevel?.minimumAmount);
    expect(MAX_TURN_SCORE).toBe(finalLevel?.score);
  });

  it('uses progressive score levels and caps a turn at 15', () => {
    expect(scoreForShakeAmount(0)).toBe(0);
    expect(scoreForShakeAmount(1)).toBe(1);
    expect(scoreForShakeAmount(2)).toBe(3);
    expect(scoreForShakeAmount(3)).toBe(6);
    expect(scoreForShakeAmount(4)).toBe(10);
    expect(scoreForShakeAmount(100)).toBe(MAX_TURN_SCORE);
    expect(scoreForShakeAmount(5) / 5).toBeGreaterThan(scoreForShakeAmount(1) / 1);
  });

  it('calculates proportional carbonation', () => {
    expect(carbonationIncreaseForShakeAmount(2)).toBe(carbonationIncreaseForShakeAmount(1) * 2);
    expect(carbonationIncreaseForShakeAmount(-1)).toBe(0);
  });

  it('maps carbonation to five danger levels and clamps noise', () => {
    expect(dangerLevelForCarbonation(0, 100)).toBe(1);
    expect(dangerLevelForCarbonation(85, 100)).toBe(5);
    expect(noisyDangerLevel(1, 0.69)).toBe(1);
    expect(noisyDangerLevel(1, 0.96)).toBeGreaterThanOrEqual(1);
    expect(noisyDangerLevel(5, 0.96)).toBeLessThanOrEqual(5);
  });

  it('advances the fixed circular order', () => {
    expect(nextTurnIndex(0, 4)).toBe(1);
    expect(nextTurnIndex(3, 4)).toBe(0);
  });

  it('forces a burst player to -999 and ranks ties consistently', () => {
    expect(scoreWithBurst(30, true)).toBe(-999);
    expect(rankScores({ a: 31, b: 18, c: -999, d: 25 }).map((entry) => entry.playerId)).toEqual(['a', 'd', 'b', 'c']);
    expect(rankScores({ a: 5, b: 5 }).map((entry) => entry.rank)).toEqual([1, 1]);
  });
});
