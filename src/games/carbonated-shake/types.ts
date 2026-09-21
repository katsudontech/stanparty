export type CarbonatedShakePhase = 'shaking' | 'hint_pending' | 'hint_display' | 'finished';

export interface CarbonatedShakePublicPlayer {
  totalScore: number;
  turnScore: number;
}

export interface CarbonatedShakeGameState {
  game: 'carbonated-shake';
  version: 1;
  matchId: string;
  stateRevision: number;
  phase: CarbonatedShakePhase;
  turnOrder: string[];
  turnIndex: number;
  turnNumber: number;
  currentPlayerId: string | null;
  scores: Record<string, CarbonatedShakePublicPlayer>;
  displayUntil: string | null;
  pendingHintDeadline: string | null;
  burstPlayerId: string | null;
}

export interface CarbonatedShakePrivateHint {
  level: 1 | 2 | 3 | 4 | 5;
  matchId: string;
  turnNumber: number;
}

export function createDefaultCarbonatedShakeState(): CarbonatedShakeGameState {
  return {
    game: 'carbonated-shake', version: 1, matchId: '', stateRevision: 0,
    phase: 'shaking', turnOrder: [], turnIndex: 0, turnNumber: 1,
    currentPlayerId: null, scores: {}, displayUntil: null,
    pendingHintDeadline: null, burstPlayerId: null,
  };
}

export function normalizeCarbonatedShakeState(value: unknown): CarbonatedShakeGameState {
  const fallback = createDefaultCarbonatedShakeState();
  if (!isCarbonatedShakeState(value)) return fallback;
  const state = value as Partial<CarbonatedShakeGameState>;
  const rawScores = state.scores && typeof state.scores === 'object' ? state.scores : {};
  const scores: Record<string, CarbonatedShakePublicPlayer> = {};
  for (const [playerId, value] of Object.entries(rawScores)) {
    if (!value || typeof value !== 'object') continue;
    const score = value as Partial<CarbonatedShakePublicPlayer>;
    scores[playerId] = {
      totalScore: Number.isFinite(score.totalScore) ? Number(score.totalScore) : 0,
      turnScore: Number.isFinite(score.turnScore) ? Number(score.turnScore) : 0,
    };
  }
  return {
    ...fallback, ...state,
    turnOrder: Array.isArray(state.turnOrder) ? state.turnOrder.filter((id): id is string => typeof id === 'string') : [],
    scores,
    displayUntil: typeof state.displayUntil === 'string' ? state.displayUntil : null,
    pendingHintDeadline: typeof state.pendingHintDeadline === 'string' ? state.pendingHintDeadline : null,
    burstPlayerId: typeof state.burstPlayerId === 'string' ? state.burstPlayerId : null,
  };
}

export function isCarbonatedShakeState(value: unknown): value is CarbonatedShakeGameState {
  return typeof value === 'object' && value !== null
    && (value as { game?: unknown }).game === 'carbonated-shake'
    && (value as { version?: unknown }).version === 1;
}

