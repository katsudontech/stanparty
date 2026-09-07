import { describe, expect, it } from 'vitest';
import { getSharedRank } from './rules';

describe('pinch-hint ranking', () => {
  it('assigns the same rank to tied scores', () => {
    expect(getSharedRank(4, [4, 4, 2])).toBe(1);
    expect(getSharedRank(2, [4, 4, 2])).toBe(3);
  });
});
