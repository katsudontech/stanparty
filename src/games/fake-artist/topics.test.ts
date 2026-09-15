import { describe, expect, it } from 'vitest';
import { FAKE_ARTIST_TOPIC_CATEGORIES } from './topics';

describe('Fake Artist topic guide', () => {
  it('provides concrete manual topic candidates across the game genres', () => {
    expect(FAKE_ARTIST_TOPIC_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(FAKE_ARTIST_TOPIC_CATEGORIES.every((category) => category.starterExamples.length >= 2 && category.challengeExamples.length >= 3)).toBe(true);
    expect(new Set(FAKE_ARTIST_TOPIC_CATEGORIES.map((category) => category.name)).size).toBe(FAKE_ARTIST_TOPIC_CATEGORIES.length);
    const examples = FAKE_ARTIST_TOPIC_CATEGORIES.flatMap((category) => [...category.starterExamples, ...category.challengeExamples]);
    expect(new Set(examples).size).toBe(examples.length);
  });
});
