import {
  CARBONATION_RATE,
  DANGER_NOISE_PROBABILITIES,
  DANGER_THRESHOLDS,
  MAX_ACCEPTED_SHAKE_AMOUNT,
  MAX_TURN_SCORE,
  SCORE_LEVELS,
} from './constants';

export function clampShakeAmount(amount: number): number {
  return Math.min(MAX_ACCEPTED_SHAKE_AMOUNT, Math.max(0, Number.isFinite(amount) ? amount : 0));
}

export function scoreForShakeAmount(amount: number): number {
  const safeAmount = clampShakeAmount(amount);
  let score = 0;
  for (const level of SCORE_LEVELS) {
    if (safeAmount >= level.minimumAmount) score = level.score;
  }
  return Math.min(MAX_TURN_SCORE, score);
}

export function carbonationIncreaseForShakeAmount(amount: number): number {
  return clampShakeAmount(amount) * CARBONATION_RATE;
}

export function dangerLevelForCarbonation(carbonation: number, limit: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(limit) || limit <= 0) return 1;
  const ratio = Math.max(0, carbonation) / limit;
  const level = ratio < DANGER_THRESHOLDS[0] ? 1
    : ratio < DANGER_THRESHOLDS[1] ? 2
      : ratio < DANGER_THRESHOLDS[2] ? 3
        : ratio < DANGER_THRESHOLDS[3] ? 4 : 5;
  return level as 1 | 2 | 3 | 4 | 5;
}

export function noisyDangerLevel(baseLevel: 1 | 2 | 3 | 4 | 5, random = Math.random()): 1 | 2 | 3 | 4 | 5 {
  const safeRandom = Number.isFinite(random) ? Math.min(0.999999, Math.max(0, random)) : 0;
  const magnitude = safeRandom < DANGER_NOISE_PROBABILITIES.exact ? 0
    : safeRandom < DANGER_NOISE_PROBABILITIES.exact + DANGER_NOISE_PROBABILITIES.oneStep ? 1 : 2;
  if (magnitude === 0) return baseLevel;
  const direction = Math.floor(safeRandom * 1000) % 2 === 0 ? -1 : 1;
  return Math.max(1, Math.min(5, baseLevel + direction * magnitude)) as 1 | 2 | 3 | 4 | 5;
}

export function nextTurnIndex(turnIndex: number, orderLength: number): number {
  if (orderLength <= 0) return 0;
  return (Math.trunc(turnIndex) + 1) % orderLength;
}

export function scoreWithBurst(totalScore: number, burst: boolean): number {
  return burst ? -999 : totalScore;
}

export interface RankedScore { playerId: string; score: number; rank: number }

export function rankScores(scores: Record<string, number>): RankedScore[] {
  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
  return entries.map(([playerId, score], index) => ({
    playerId,
    score,
    rank: index === 0 || score < entries[index - 1][1] ? index + 1 : entries.findIndex(([, value]) => value === score) + 1,
  }));
}

