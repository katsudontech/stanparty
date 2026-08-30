import { describe, expect, it } from 'vitest';
import { createDefaultAiBarenaiDrawingState, normalizeAiBarenaiDrawingState } from './types';

describe('drawing game public state', () => {
  it('invalid or unrelated state normalizes to a safe public default', () => {
    expect(normalizeAiBarenaiDrawingState({ game: 'ai-barenai', topic: '秘密' })).toEqual(createDefaultAiBarenaiDrawingState());
  });
  it('does not define topic or aliases in the public state shape', () => {
    const state = createDefaultAiBarenaiDrawingState();
    expect(state).not.toHaveProperty('topic');
    expect(state).not.toHaveProperty('aliases');
  });
});
