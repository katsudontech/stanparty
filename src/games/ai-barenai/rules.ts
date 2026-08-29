import type { AiBarenaiResult } from './types';
export const MIN_AI_BARENAI_PLAYERS = 2;
export const MAX_AI_BARENAI_PLAYERS = 14;
export function isValidAiBarenaiPlayerCount(count: number): boolean { return Number.isInteger(count) && count >= MIN_AI_BARENAI_PLAYERS && count <= MAX_AI_BARENAI_PLAYERS; }
export function getCyclicAssignments(order: string[], cursor: number, count: number): string[] {
  if (!order.length || count <= 0) return [];
  const n = Math.min(Math.trunc(count), order.length), start = ((Math.trunc(cursor) % order.length) + order.length) % order.length;
  return Array.from({length: n}, (_, i) => order[(start + i) % order.length]);
}
export function nextAssignmentCursor(cursor: number, count: number, orderLength: number): number {
  if (orderLength <= 0) return 0;
  return (((Math.trunc(cursor) + Math.max(0, Math.trunc(count))) % orderLength) + orderLength) % orderLength;
}
export function normalizeCandidate(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase(); }
export function isExactTopicMatch(candidate: string, answer: string, aliases: readonly string[]): boolean {
  const normalized = normalizeCandidate(candidate);
  return Boolean(normalized) && (normalized === normalizeCandidate(answer) || aliases.some((alias) => normalized === normalizeCandidate(alias)));
}
export function getAnswerMatchResult(candidate: string, answer: string, aliases: readonly string[]): 'correct' | 'semantic-needed' | 'wrong' {
  return isExactTopicMatch(candidate, answer, aliases) ? 'correct' : candidate.trim() ? 'semantic-needed' : 'wrong';
}
export function selectWinner(humanCorrect: boolean, aiCorrect: boolean): AiBarenaiResult['winner'] { return aiCorrect ? 'ai' : humanCorrect ? 'humans' : 'draw'; }
export function validateGeminiGuess(value: unknown): { answer: string; confidence: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as {answer?: unknown; confidence?: unknown};
  return typeof v.answer === 'string' && v.answer.trim() && typeof v.confidence === 'number' && Number.isInteger(v.confidence) && v.confidence >= 0 && v.confidence <= 100
    ? {answer: v.answer.trim().slice(0, 200), confidence: v.confidence} : null;
}
export function validateGeminiSemantic(value: unknown): boolean | null {
  return typeof value === 'object' && value !== null && typeof (value as {correct?: unknown}).correct === 'boolean'
    ? (value as {correct: boolean}).correct : null;
}
export interface AiBarenaiGuessHistoryEntry { round: number; humanAnswer: string; aiAnswer: string }
export function sanitizeAiBarenaiGuessHistory(value: unknown, currentRound: number): AiBarenaiGuessHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const item = entry as {round?: unknown; humanAnswer?: unknown; aiAnswer?: unknown};
    if (typeof item.round !== 'number' || !Number.isInteger(item.round) || item.round < 1 || item.round >= currentRound
      || typeof item.humanAnswer !== 'string' || !item.humanAnswer.trim()
      || typeof item.aiAnswer !== 'string' || !item.aiAnswer.trim()) return [];
    return [{round: item.round, humanAnswer: item.humanAnswer.trim(), aiAnswer: item.aiAnswer.trim()}];
  });
}
export function buildAiBarenaiGuessPrompt(hints: unknown, answerHistory: unknown, currentRound: number): string {
  const safeHints = Array.isArray(hints) ? hints.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const item = entry as {round?: unknown; hints?: unknown};
    if (!Number.isInteger(item.round) || !Array.isArray(item.hints)) return [];
    const roundHints = item.hints.filter((hint): hint is string => typeof hint === 'string').map((hint) => hint.trim()).filter(Boolean);
    return [{round: item.round, hints: roundHints}];
  }) : [];
  const previousAnswers = sanitizeAiBarenaiGuessHistory(answerHistory, currentRound);
  return `あなたは言葉当てゲームの回答者です。
これまでに提示されたすべてのヒントと、過去ラウンドの回答から、隠されたお題を推測してください。

情報が少なくても、必ず現時点で最も可能性が高いものを1つだけ回答してください。
「分かりません」「判断できません」や複数候補の回答は認められません。
さらに、その回答が正解であるとどの程度確信しているかを0〜100の整数で示してください。

以下は公開済みヒントと、完了した過去ラウンドの回答だけです。
${JSON.stringify({hints: safeHints, previousAnswers})}

指定されたJSON形式だけを返してください。`;
}
export function buildPublicResult(input: Omit<AiBarenaiResult, 'topic'> & { topic: string }, phase: 'revealing' | 'game_over'): AiBarenaiResult {
  return { ...input, topic: phase === 'game_over' ? input.topic : null };
}
