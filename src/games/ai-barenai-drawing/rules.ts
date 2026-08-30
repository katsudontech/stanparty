import { getAnswerMatchResult, validateGeminiGuess, validateGeminiSemantic } from '../ai-barenai/rules';
export { getAnswerMatchResult, validateGeminiGuess, validateGeminiSemantic };
export function selectDrawingWinner(humanCorrect: boolean, aiCorrect: boolean): 'ai'|'humans'|'draw' { return aiCorrect ? 'ai' : humanCorrect ? 'humans' : 'draw'; }
export function canResetDrawing(phase: string, actorId: string, drawerId: string|null, judgmentRevision: number|null): boolean { return phase === 'drawing' && actorId === drawerId && judgmentRevision === null; }
