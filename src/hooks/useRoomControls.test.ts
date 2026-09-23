import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), rpc: vi.fn() }));
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: () => ({ update: mocks.update }), rpc: mocks.rpc }),
}));
import { useRoomControls } from './useRoomControls';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ eq: mocks.eq });
  vi.stubGlobal('alert', vi.fn());
});

it('shares one lobby reset between the header and game controls', async () => {
  let resolve!: (result: { error: null }) => void;
  mocks.eq.mockImplementation(() => new Promise(yes => { resolve = yes; }));
  const controls = useRoomControls('room');
  const header = controls.handleBackToLobby();
  const footer = controls.handleBackToLobby();
  expect(header).toBe(footer);
  expect(mocks.update).toHaveBeenCalledOnce();
  resolve({ error: null });
  await header;
});

it('releases a failed lobby request so it can be retried', async () => {
  mocks.eq.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ error: null });
  const controls = useRoomControls('room');
  await expect(controls.handleBackToLobby()).rejects.toThrow('offline');
  await expect(controls.handleBackToLobby()).resolves.toBeUndefined();
  expect(mocks.update).toHaveBeenCalledTimes(2);
});


it('kicks a waiting-room player through the scoped RPC', async () => {
  mocks.rpc.mockResolvedValue({ error: null });
  const controls = useRoomControls('room');
  await expect(controls.handleKickPlayer('guest')).resolves.toBeUndefined();
  expect(mocks.rpc).toHaveBeenCalledWith('kick_waiting_room_player', {
    p_room_id: 'room',
    p_user_id: 'guest'
  });
});

it('turns kick RPC failures into a useful retryable error', async () => {
  mocks.rpc.mockResolvedValue({ error: new Error('permission denied') });
  const controls = useRoomControls('room');
  await expect(controls.handleKickPlayer('guest')).rejects.toThrow('参加者を退出させられませんでした');
});
