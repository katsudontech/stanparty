import { describe, expect, it, vi } from 'vitest';
import { REACTION_PRESETS, ReactionInbox, ReactionToastQueue, parseReactionPayload, validateReactionBody } from './roomReactionsProtocol';

describe('room reaction protocol', () => {
  it('keeps the six public presets and accepts only their emoji values', () => {
    expect(REACTION_PRESETS.map((reaction) => reaction.emoji)).toEqual(['👏', '😂', '👍', '😮', '🤔', '🎉']);
    expect(validateReactionBody({ roomId: '00000000-0000-4000-8000-000000000001', emoji: '👏' })).toEqual({
      roomId: '00000000-0000-4000-8000-000000000001', emoji: '👏',
    });
  });

  it('rejects malformed room IDs, custom emoji, and extra primitive payloads', () => {
    expect(validateReactionBody({ roomId: 'room', emoji: '👏' })).toBeNull();
    expect(validateReactionBody({ roomId: '00000000-0000-4000-8000-000000000001', emoji: '🔥' })).toBeNull();
    expect(validateReactionBody(null)).toBeNull();
    expect(validateReactionBody({ roomId: '00000000-0000-4000-8000-000000000001', emoji: 1 })).toBeNull();
  });

  it('deduplicates IDs, enforces sender spacing, and rejects spoofed roster names', () => {
    const inbox = new ReactionInbox();
    const players = [{ userId: 'sender', name: 'Alice' }];
    const make = (id: string, sentAt: number, senderName = 'Alice') => ({ id, emoji: '👏', senderId: 'sender', senderName, sentAt });
    expect(inbox.accept(make('reaction-1', 10_000), players, 10_000)?.id).toBe('reaction-1');
    expect(inbox.accept(make('reaction-1', 10_001), players, 10_001)).toBeNull();
    expect(inbox.accept(make('reaction-2', 10_500), players, 10_500)).toBeNull();
    expect(inbox.accept(make('reaction-3', 11_001, 'Mallory'), players, 11_001)).toBeNull();
    expect(inbox.accept(make('reaction-4', 11_001), players, 11_001)?.id).toBe('reaction-4');
  });

  it('ignores malformed, unsupported, and expired incoming broadcasts', () => {
    const valid = { id: 'reaction-1', emoji: '👏', senderId: 'sender', senderName: 'Alice', sentAt: 100_000 };
    for (const value of [null, [], { ...valid, id: 1 }, { ...valid, emoji: '🔥' },
      { ...valid, senderId: null }, { ...valid, senderName: 'x'.repeat(81) },
      { ...valid, sentAt: '100000' }, { ...valid, sentAt: NaN }, { ...valid, sentAt: 1 }]) {
      expect(parseReactionPayload(value, 100_000)).toBeNull();
    }
  });

  it('bounds visible toasts and clears expiry timers during connection cleanup', () => {
    vi.useFakeTimers();
    try {
      const updates: string[][] = [];
      const queue = new ReactionToastQueue((items) => updates.push(items.map((item) => item.id)));
      const make = (id: string) => ({ id, emoji: '👏' as const, label: '拍手', senderId: 'sender', senderName: 'Alice', sentAt: 10_000 });
      queue.add(make('reaction-1')); queue.add(make('reaction-2')); queue.add(make('reaction-3')); queue.add(make('reaction-4'));
      expect(updates.at(-1)).toEqual(['reaction-2', 'reaction-3', 'reaction-4']);
      expect(vi.getTimerCount()).toBe(3);
      queue.clear(false);
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(3_000);
      expect(updates.at(-1)).toEqual(['reaction-2', 'reaction-3', 'reaction-4']);
      queue.add(make('reaction-5'));
      vi.advanceTimersByTime(2_999);
      expect(updates.at(-1)).toEqual(['reaction-5']);
      vi.advanceTimersByTime(1);
      expect(updates.at(-1)).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
