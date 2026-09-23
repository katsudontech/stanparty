export const WAITING_ROOM_REFRESH_INTERVAL_MS = 10_000;

export function scheduleWaitingRoomRefresh(
  status: 'waiting' | 'playing' | 'finished' | null | undefined,
  refreshRoom: () => Promise<void>
): () => void {
  if (status !== 'waiting') return () => {};

  const refreshInterval = window.setInterval(() => {
    void refreshRoom();
  }, WAITING_ROOM_REFRESH_INTERVAL_MS);

  return () => window.clearInterval(refreshInterval);
}
