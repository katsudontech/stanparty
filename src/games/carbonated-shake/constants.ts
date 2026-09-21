export const CARBONATION_RATE = 16;
export const MAX_TURN_SCORE = 15;

/**
 * This curve is duplicated in the private carbonated_shake_tuning SQL
 * function. Keep the two representations in sync when tuning the game.
 */
export const SCORE_LEVELS = [
  { minimumAmount: 1, score: 1 },
  { minimumAmount: 2, score: 3 },
  { minimumAmount: 3, score: 6 },
  { minimumAmount: 4, score: 10 },
  { minimumAmount: 5, score: 15 },
] as const;

export const MAX_ACCEPTED_SHAKE_AMOUNT = SCORE_LEVELS.find((level) => level.score >= MAX_TURN_SCORE)?.minimumAmount ?? 0;

export const CARBONATION_LIMIT_MIN = 90;
export const CARBONATION_LIMIT_MAX = 110;
export const HINT_DURATION_MS = 700;
export const PENDING_HINT_TIMEOUT_MS = 3000;
export const SERVER_UPDATE_INTERVAL_MS = 120;

export const DANGER_THRESHOLDS = [0.2, 0.4, 0.6, 0.8] as const;
export const DANGER_NOISE_PROBABILITIES = {
  exact: 0.7,
  oneStep: 0.25,
  twoSteps: 0.05,
} as const;

export const MOTION_NOISE_THRESHOLD = 1.35;
export const MOTION_NORMALIZATION = 0.18;
export const MOTION_MAX_GAP_SECONDS = 0.25;
export const MOTION_GRAVITY_SMOOTHING = 0.12;
