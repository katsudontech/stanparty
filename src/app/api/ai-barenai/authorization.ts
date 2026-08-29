export type AiBarenaiAction = 'initialize'|'hint'|'answer'|'topic'|'guess'|'judge'|'next-round'|'resume';

export const HOST_ONLY_ACTIONS = ['initialize', 'guess', 'judge', 'next-round', 'resume'] as const satisfies readonly AiBarenaiAction[];

export function isAiBarenaiHostAction(action: AiBarenaiAction): boolean {
  return (HOST_ONLY_ACTIONS as readonly string[]).includes(action);
}
