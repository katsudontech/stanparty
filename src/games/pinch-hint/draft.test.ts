import { describe, expect, it } from 'vitest';
import { getPinchDraftKey, parsePinchDraft } from './draft';

describe('pinch-hint preparation draft', () => {
  it('separates drafts by room, match, turn, and player', () => {
    const first = getPinchDraftKey('room', 'match-a', 0, 'player-a');
    expect(first).not.toBe(getPinchDraftKey('room', 'match-b', 0, 'player-a'));
    expect(first).not.toBe(getPinchDraftKey('room', 'match-a', 1, 'player-a'));
    expect(first).not.toBe(getPinchDraftKey('room', 'match-a', 0, 'player-b'));
  });

  it('ignores malformed and non-string local drafts', () => {
    expect(parsePinchDraft('["rope", 2, null, "banana"]')).toEqual(['rope', 'banana']);
    expect(parsePinchDraft('{"selection":"rope"}')).toEqual([]);
    expect(parsePinchDraft('not json')).toEqual([]);
    expect(parsePinchDraft(null)).toEqual([]);
  });
});

