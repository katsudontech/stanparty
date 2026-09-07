import type { PinchItem } from './items';

export type PinchPhase = 'rule_setting' | 'turn_setup' | 'presenting' | 'voting' | 'result' | 'finished';

export interface PinchRevealedItem extends PinchItem { revealedAt: number }
export interface PinchResult { success: boolean; yes: number; no: number; playerId: string }
export interface PinchGameState {
  game: 'pinch-hint';
  version: 1;
  matchId: string;
  stateRevision: number;
  phase: PinchPhase;
  rounds: number;
  round: number;
  turnIndex: number;
  totalTurns: number;
  turnOrder: string[];
  currentPlayerId: string | null;
  topic: string | null;
  requiredCount: number;
  revealedItems: PinchRevealedItem[];
  votedPlayerIds: string[];
  scores: Record<string, number>;
  result: PinchResult | null;
}

export interface PinchPrivateState {
  hand: PinchItem[];
  selection: string[] | null;
  vote: 'yes' | 'no' | null;
  matchId?: string;
  turnIndex?: number;
  stateRevision?: number;
}

export function createDefaultPinchState(): PinchGameState {
  return {
    game: 'pinch-hint', version: 1, matchId: '', stateRevision: 0, phase: 'rule_setting', rounds: 1, round: 1,
    turnIndex: 0, totalTurns: 0, turnOrder: [], currentPlayerId: null,
    topic: null, requiredCount: 1, revealedItems: [], votedPlayerIds: [],
    scores: {}, result: null,
  };
}

export function normalizePinchState(value: unknown): PinchGameState {
  const fallback = createDefaultPinchState();
  if (!isPinchGameState(value)) return fallback;
  const state = value as Partial<PinchGameState>;
  return {
    ...fallback, ...state,
    turnOrder: Array.isArray(state.turnOrder) ? state.turnOrder : [],
    revealedItems: Array.isArray(state.revealedItems) ? state.revealedItems : [],
    votedPlayerIds: Array.isArray(state.votedPlayerIds) ? state.votedPlayerIds : [],
    scores: state.scores && typeof state.scores === 'object' ? state.scores : {},
    result: state.result && typeof state.result === 'object' ? state.result : null,
  };
}

export function isPinchGameState(value: unknown): value is PinchGameState {
  return typeof value === 'object' && value !== null
    && (value as { game?: unknown }).game === 'pinch-hint'
    && (value as { version?: unknown }).version === 1;
}
