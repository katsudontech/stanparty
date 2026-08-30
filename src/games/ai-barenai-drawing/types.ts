import type { CanvasPath } from 'react-sketch-canvas';

export type AiBarenaiDrawingPhase = 'rule_setting' | 'drawing' | 'answering' | 'revealing' | 'game_over';
export interface DrawingAnswer { playerId: string; answer: string; correct?: boolean }
export interface DrawingJudgment { round: number; aiAnswer: string; aiConfidence: number; answers: DrawingAnswer[]; aiCorrect: boolean; humanCorrect: boolean; winner: 'ai'|'humans'|'draw' }
export interface AiBarenaiDrawingState {
  game: 'ai-barenai-drawing'; version: 1; phase: AiBarenaiDrawingPhase;
  drawerId: string | null; round: number; canvasRevision: number;
  judgmentRevision: number | null; answers: DrawingAnswer[]; answerSubmittedPlayerIds: string[];
  aiGuessReady: boolean; judgmentHistory: DrawingJudgment[]; result: DrawingJudgment | null;
}
export interface DrawingLinePayload { playerId: string; revision: number; stroke: CanvasPath }
export interface DrawingResetPayload { revision: number }
export function createDefaultAiBarenaiDrawingState(): AiBarenaiDrawingState {
  return { game: 'ai-barenai-drawing', version: 1, phase: 'rule_setting', drawerId: null, round: 1,
    canvasRevision: 0, judgmentRevision: null, answers: [], answerSubmittedPlayerIds: [], aiGuessReady: false, judgmentHistory: [], result: null };
}
export function normalizeAiBarenaiDrawingState(value: unknown): AiBarenaiDrawingState {
  const fallback = createDefaultAiBarenaiDrawingState();
  if (typeof value !== 'object' || value === null || (value as {game?: unknown}).game !== 'ai-barenai-drawing') return fallback;
  const v = value as Partial<AiBarenaiDrawingState>;
  return {...fallback, ...v, answers: Array.isArray(v.answers) ? v.answers : [], answerSubmittedPlayerIds: Array.isArray(v.answerSubmittedPlayerIds) ? v.answerSubmittedPlayerIds : [], judgmentHistory: Array.isArray(v.judgmentHistory) ? v.judgmentHistory : [], result: v.result && typeof v.result === 'object' ? v.result : null};
}
