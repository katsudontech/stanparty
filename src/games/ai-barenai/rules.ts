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
export interface AiBarenaiReaction {
  opening: string;
  decisiveHint: string;
  decisiveMoment: string;
  closing: string;
}
const REACTION_PART_MAX_LENGTH = 80;
const REACTION_TOTAL_MAX_LENGTH = 520;
function normalizeReactionPart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const part = value.normalize('NFKC').replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim()
    .replace(/^[。！？.!?]+|[。！？.!?]+$/gu, '').trim().split(/[。！？.!?]/u)[0].trim();
  if (!part) return null;
  return part.slice(0, REACTION_PART_MAX_LENGTH);
}
export function getRevealedHintTexts(hints: unknown): string[] {
  if (!Array.isArray(hints)) return [];
  return hints.flatMap((round) => {
    if (typeof round !== 'object' || round === null) return [];
    const values = (round as {hints?: unknown}).hints;
    if (!Array.isArray(values)) return [];
    return values.flatMap((hint) => {
      const text = typeof hint === 'string' ? hint : typeof hint === 'object' && hint !== null ? (hint as {text?: unknown}).text : null;
      if (typeof text !== 'string' || !text.trim()) return [];
      return [text.normalize('NFKC').replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim()];
    });
  });
}
export function selectAiReactionHint(hints: unknown, proposedHint?: unknown): string | null {
  const actualHints = getRevealedHintTexts(hints);
  if (!actualHints.length) return null;
  const proposed = typeof proposedHint === 'string' ? normalizeCandidate(proposedHint) : '';
  return actualHints.find((hint) => normalizeCandidate(hint) === proposed) ?? actualHints[actualHints.length - 1];
}
export function validateAiBarenaiReaction(value: unknown, hints: unknown): AiBarenaiReaction | null {
  if (typeof value !== 'object' || value === null) return null;
  const reaction = value as {opening?: unknown; decisiveHint?: unknown; decisiveMoment?: unknown; closing?: unknown};
  const opening = normalizeReactionPart(reaction.opening);
  const decisiveMoment = normalizeReactionPart(reaction.decisiveMoment);
  const closing = normalizeReactionPart(reaction.closing);
  const decisiveHint = selectAiReactionHint(hints, reaction.decisiveHint);
  if (!opening || !closing || !decisiveHint) return null;
  const mentionsHint = decisiveMoment && normalizeCandidate(decisiveMoment).replace(/\s+/gu, '').includes(normalizeCandidate(decisiveHint).replace(/\s+/gu, ''));
  return {opening, decisiveHint, decisiveMoment: mentionsHint ? decisiveMoment : `「${decisiveHint}」が決め手になって、答えが分かりました`, closing};
}
export function composeAiBarenaiReaction(reaction: AiBarenaiReaction): string {
  const opening = normalizeReactionPart(reaction.opening) ?? 'ヒントからお題を見抜けました';
  const decisiveMoment = normalizeReactionPart(reaction.decisiveMoment) ?? `「${reaction.decisiveHint}」が決め手になって、答えが分かりました`;
  const closing = normalizeReactionPart(reaction.closing) ?? 'とても楽しかったです';
  const sentence = `${opening}。${decisiveMoment}。${closing}。`;
  return sentence.slice(0, REACTION_TOTAL_MAX_LENGTH);
}
export function buildAiBarenaiReactionFallback(hints: unknown): string {
  return composeAiBarenaiReaction({
    opening: 'ヒントからお題を見抜けました',
    decisiveHint: selectAiReactionHint(hints) ?? 'ヒント',
    decisiveMoment: `「${selectAiReactionHint(hints) ?? 'ヒント'}」が決め手になって、答えが分かりました`,
    closing: 'とても楽しかったです',
  });
}
export function buildAiBarenaiReactionPrompt(hints: unknown, aiAnswer: unknown): string {
  const safeHints = getRevealedHintTexts(hints);
  const safeAnswer = typeof aiAnswer === 'string' ? aiAnswer.normalize('NFKC').trim().slice(0, 200) : '';
  return `あなたは言葉当てゲームのAIです。AIが正解したときの短い感想を日本語で作ってください。正解の文章は自分が正解したときの感想をお願いします。
以下の公開済みヒントとAIの最終回答だけを使い、opening、decisiveMoment、closingはそれぞれ短い一文にしてください。decisiveHintには、必ず以下のヒントのいずれか1つをそのまま入れてください。decisiveMomentには、decisiveHintがどのように答えの決め手になったかを自然な一文で説明し、decisiveHintの内容を明記してください。
${JSON.stringify({hints: safeHints, aiAnswer: safeAnswer})}
指定されたJSON形式だけを返してください。`;
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

過去ラウンドの回答は、すべて不正解だった回答です。
過去の人間回答・AI回答と同じ回答を繰り返してはいけません。

新しく追加されたヒントを重視して候補を更新し、
過去に回答されていないものから最も可能性の高い答えを1つ返してください。
${JSON.stringify({hints: safeHints, previousAnswers})}

指定されたJSON形式だけを返してください。`;
}
export function buildPublicResult(input: Omit<AiBarenaiResult, 'topic'> & { topic: string }, phase: 'revealing' | 'game_over'): AiBarenaiResult {
  return { ...input, topic: phase === 'game_over' ? input.topic : null };
}
