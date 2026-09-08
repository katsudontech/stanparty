import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  setters: [] as ReturnType<typeof vi.fn>[],
  status: undefined as undefined | ((status: string) => void),
  change: undefined as undefined | ((payload: unknown) => void),
  read: vi.fn(),
}));
vi.mock('react', () => ({
  useEffect: (effect: () => void) => mocks.effects.push(effect),
  useCallback: (callback: unknown) => callback,
  useId: () => 'test',
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const setter = vi.fn();
    mocks.setters.push(setter);
    return [initial, setter];
  },
}));
vi.mock('@/lib/supabase/realtime', () => ({ authenticateRealtime: async () => {} }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => {
      const channel = {
        on: (_type: unknown, _filter: unknown, callback: (payload: unknown) => void) => { mocks.change = callback; return channel; },
        subscribe: (callback: (status: string) => void) => { mocks.status = callback; return channel; },
      };
      return channel;
    },
    from: () => {
      const query = { select: () => query, eq: () => query, order: mocks.read, maybeSingle: mocks.read };
      return query;
    },
    removeChannel: vi.fn(),
  }),
}));
import { useRoomSubscription } from './useRoomSubscription';
import { useVotingSync } from '../games/fake-artist/hooks/useVotingSync';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const vote = (id: string) => ({ id, actor_id: id, event_type: 'vote', created_at: '2026-09-08' });
const room = (status: string) => ({ id: 'room', host_id: 'host', players: [], game_type: 'fake-artist', status });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.effects = [];
  mocks.setters = [];
  mocks.status = undefined;
});

it('recovers votes submitted while the host was disconnected and finalizes once', async () => {
  mocks.read.mockResolvedValueOnce({ data: [vote('host')] }).mockResolvedValue({ data: [vote('host'), vote('a'), vote('b')] });
  const finalize = vi.fn().mockResolvedValue(undefined);
  useVotingSync({ roomId: 'room', myUserId: 'host', isHost: true, playersCount: 3, onAllVoted: finalize });
  mocks.effects.forEach(effect => effect());
  mocks.status?.('SUBSCRIBED');
  await flush();
  expect(finalize).not.toHaveBeenCalled();
  mocks.status?.('CHANNEL_ERROR');
  mocks.status?.('SUBSCRIBED');
  await flush();
  expect(mocks.read).toHaveBeenCalledTimes(2);
  expect(finalize).toHaveBeenCalledOnce();
  mocks.change?.({ new: vote('b') });
  expect(finalize).toHaveBeenCalledOnce();
});

it('does not enable voting when an old query finishes after disconnection', async () => {
  let resolve!: (value: unknown) => void;
  mocks.read.mockReturnValue(new Promise(done => { resolve = done; }));
  useVotingSync({ roomId: 'room', myUserId: 'host', isHost: true, playersCount: 3, onAllVoted: vi.fn() });
  mocks.effects.forEach(effect => effect());
  mocks.status?.('SUBSCRIBED');
  mocks.status?.('CHANNEL_ERROR');
  resolve({ data: [vote('host')] });
  await flush();
  expect(mocks.setters[2]).not.toHaveBeenCalledWith(true);
});

it('loads the post-subscription room even when the initial request is still pending', async () => {
  let resolve!: (value: unknown) => void;
  mocks.read.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce({ data: room('playing') });
  useRoomSubscription('room', 'guest');
  mocks.effects.forEach(effect => effect());
  await flush();
  mocks.status?.('SUBSCRIBED');
  await flush();
  resolve({ data: room('waiting') });
  await flush();
  expect(mocks.read).toHaveBeenCalledTimes(2);
  expect(mocks.setters[0]).toHaveBeenLastCalledWith(room('playing'));
  expect(mocks.setters[0]).not.toHaveBeenCalledWith(room('waiting'));
});
