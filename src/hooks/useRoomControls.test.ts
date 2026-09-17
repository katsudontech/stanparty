import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn() }));
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: () => ({ update: mocks.update }) }),
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
