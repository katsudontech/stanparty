import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getReactionMenuIndex, openRoomReactionSubscription, RoomReactionHeaderActions, RoomReactionsProvider } from './RoomReactions';

const players = [{ userId: '00000000-0000-4000-8000-000000000001', name: 'Alice', avatarUrl: '', isHost: true, color: '#ef4444', isOnline: true }];

describe('RoomReactionHeaderActions', () => {
  it('renders an accessible 44px touch target with the required label', () => {
    const html = renderToStaticMarkup(createElement(
      RoomReactionsProvider,
      { roomId: '00000000-0000-4000-8000-000000000002', myUserId: players[0].userId, players },
      createElement(RoomReactionHeaderActions),
    ));
    expect(html).toContain('aria-label="リアクションを送る"');
    expect(html).toContain('min-h-11 min-w-11');
    expect(html).not.toContain('aria-haspopup="menu"');
    expect(html).toContain('接続中…');
  });

  it('opens the private recipient topic and removes the channel on cleanup', async () => {
    const events: Record<string, unknown> = {};
    const channel = {
      on: (_type: string, _filter: unknown, callback: (value: { payload: unknown }) => void) => { events.payload = callback; return channel; },
      subscribe: (callback: (status: string) => void) => { events.status = callback; return channel; },
    };
    const supabase = {
      channel: (topic: string, config: unknown) => { events.topic = topic; events.config = config; return channel; },
      removeChannel: (value: unknown) => { events.removed = value; return Promise.resolve(); },
    } as never;
    const received: unknown[] = [];
    const statuses: string[] = [];
    const subscription = await openRoomReactionSubscription(supabase, 'room-id', 'user-id', (payload) => received.push(payload), (status) => statuses.push(status), async () => {});
    (events.status as (status: string) => void)('SUBSCRIBED');
    (events.payload as (value: { payload: unknown }) => void)({ payload: { id: 'reaction-1' } });
    expect(events.topic).toBe('room-reactions:room-id:user-id');
    expect(events.config).toEqual({ config: { private: true } });
    expect(statuses).toEqual(['SUBSCRIBED']);
    expect(received).toEqual([{ id: 'reaction-1' }]);
    subscription.unsubscribe();
    expect(events.removed).toBe(channel);
  });

  it('does not create a channel when authentication resolves after unmount', async () => {
    let authenticateFinished!: () => void;
    const authentication = new Promise<void>((resolve) => { authenticateFinished = resolve; });
    const supabase = { channel: () => { throw new Error('must not subscribe'); } } as never;
    let active = true;
    const opening = openRoomReactionSubscription(supabase, 'room-id', 'user-id', () => {}, () => {}, async () => authentication, () => active);
    active = false;
    authenticateFinished();
    const subscription = await opening;
    expect(subscription.channel).toBeNull();
  });

  it('supports keyboard traversal and boundary keys in the reaction panel', () => {
    expect(getReactionMenuIndex(0, 6, 'ArrowRight')).toBe(1);
    expect(getReactionMenuIndex(0, 6, 'ArrowLeft')).toBe(5);
    expect(getReactionMenuIndex(3, 6, 'Home')).toBe(0);
    expect(getReactionMenuIndex(3, 6, 'End')).toBe(5);
    expect(getReactionMenuIndex(0, 0, 'ArrowRight')).toBeNull();
  });
});
