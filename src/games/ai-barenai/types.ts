export type AiBarenaiPhase = 'rule_setting' | 'hinting' | 'answering' | 'revealing' | 'game_over';

export interface AiBarenaiHint { playerId: string; text: string }
export interface AiBarenaiRoundHints { round: number; hints: AiBarenaiHint[] }
export interface AiBarenaiAnswerHistory {
  round: number;
  humanAnswer: string;
  aiAnswer: string;
  aiConfidence: number;
  humanCorrect: boolean;
  aiCorrect: boolean;
  aiError: boolean;
}
/** Public state only. Never add topic, aliases, or unrevealed answer text here. */
export interface AiBarenaiGameState {
  game: 'ai-barenai'; version: 1; phase: AiBarenaiPhase; hintsPerRound: number;
  answererId: string | null; clueGiverOrder: string[]; assignmentCursor: number;
  currentAssigneeIds: string[]; submittedHintPlayerIds: string[];
  revealedHintHistory: AiBarenaiRoundHints[]; answerHistory: AiBarenaiAnswerHistory[]; round: number;
  humanAnswerSubmitted: boolean; aiGuessReady: boolean; result: AiBarenaiResult | null;
  aiError: boolean;
}
export interface AiBarenaiResult {
  winner: 'ai' | 'humans' | 'draw' | null; topic: string | null; humanAnswer: string;
  aiAnswer: string; aiConfidence: number; humanCorrect: boolean; aiCorrect: boolean; aiError?: boolean;
}
export function createDefaultAiBarenaiState(): AiBarenaiGameState {
  return { game: 'ai-barenai', version: 1, phase: 'rule_setting', hintsPerRound: 1,
    answererId: null, clueGiverOrder: [], assignmentCursor: 0, currentAssigneeIds: [],
    submittedHintPlayerIds: [], revealedHintHistory: [], answerHistory: [], round: 1,
    humanAnswerSubmitted: false, aiGuessReady: false, result: null, aiError: false };
}
export function isAiBarenaiGameState(value: unknown): value is AiBarenaiGameState {
  return typeof value === 'object' && value !== null && (value as {game?: unknown}).game === 'ai-barenai' && (value as {version?: unknown}).version === 1;
}
export function normalizeAiBarenaiGameState(value: unknown): AiBarenaiGameState {
  const fallback = createDefaultAiBarenaiState();
  if (!isAiBarenaiGameState(value)) return fallback;
  const v = value as Partial<AiBarenaiGameState>;
  const answerHistory = Array.isArray(v.answerHistory) && v.answerHistory.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const item = entry as Partial<AiBarenaiAnswerHistory>;
    return typeof item.round === 'number' && Number.isInteger(item.round) && item.round >= 1
      && typeof item.humanAnswer === 'string' && item.humanAnswer.trim().length > 0
      && typeof item.aiAnswer === 'string' && item.aiAnswer.trim().length > 0
      && typeof item.aiConfidence === 'number' && Number.isInteger(item.aiConfidence) && item.aiConfidence >= 0 && item.aiConfidence <= 100
      && typeof item.humanCorrect === 'boolean' && typeof item.aiCorrect === 'boolean'
      && typeof item.aiError === 'boolean';
  }) ? v.answerHistory as AiBarenaiAnswerHistory[] : [];
  return { ...fallback, ...v,
    clueGiverOrder: Array.isArray(v.clueGiverOrder) ? v.clueGiverOrder : [],
    currentAssigneeIds: Array.isArray(v.currentAssigneeIds) ? v.currentAssigneeIds : [],
    submittedHintPlayerIds: Array.isArray(v.submittedHintPlayerIds) ? v.submittedHintPlayerIds : [],
    revealedHintHistory: Array.isArray(v.revealedHintHistory) ? v.revealedHintHistory : [],
    answerHistory,
    result: v.result && typeof v.result === 'object' ? v.result : null };
}
