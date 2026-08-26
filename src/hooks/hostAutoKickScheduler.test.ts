import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOST_RECONNECT_GRACE_PERIOD_MS,
  HostAutoKickScheduler,
  type HostAutoKickSnapshot
} from './hostAutoKickScheduler';

const roomId = 'room-1';
const hostUserId = 'host';
const players = [{ userId: hostUserId }, { userId: 'player-1' }, { userId: 'player-2' }];

function createSnapshot(
  overrides: Partial<HostAutoKickSnapshot> = {}
): HostAutoKickSnapshot {
  return {
    roomId,
    isHost: true,
    roomStatus: 'waiting',
    players,
    onlineUserIds: [hostUserId],
    isPresenceSynced: true,
    hostUserId,
    ...overrides
  };
}

function createScheduler(initialSnapshot: HostAutoKickSnapshot) {
  let latestSnapshot = initialSnapshot;
  const removePlayer = vi.fn(async () => {});
  const scheduler = new HostAutoKickScheduler({
    getLatestSnapshot: () => latestSnapshot,
    removePlayer
  });

  return {
    scheduler,
    removePlayer,
    setLatestSnapshot(snapshot: HostAutoKickSnapshot, reconcile = true) {
      latestSnapshot = snapshot;
      if (reconcile) scheduler.reconcile(snapshot);
    }
  };
}

describe('HostAutoKickScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Presenceの初回sync完了前は削除タイマーを開始しない', async () => {
    const initialSnapshot = createSnapshot({
      onlineUserIds: [],
      isPresenceSynced: false
    });
    const { scheduler, removePlayer } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS * 2);

    expect(removePlayer).not.toHaveBeenCalled();
  });

  it('89秒以内に再接続した参加者は削除しない', async () => {
    const initialSnapshot = createSnapshot();
    const { scheduler, removePlayer, setLatestSnapshot } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(89_000);

    setLatestSnapshot(createSnapshot({
      onlineUserIds: [hostUserId, 'player-1']
    }));
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS);

    expect(removePlayer).toHaveBeenCalledTimes(1);
    expect(removePlayer).toHaveBeenCalledWith(roomId, 'player-2');
  });

  it('90秒継続してオフラインの参加者だけを削除する', async () => {
    const initialSnapshot = createSnapshot({
      onlineUserIds: [hostUserId, 'player-2']
    });
    const { scheduler, removePlayer } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS - 1);
    expect(removePlayer).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(removePlayer).toHaveBeenCalledOnce();
    expect(removePlayer).toHaveBeenCalledWith(roomId, 'player-1');
  });

  it('playingへ移行した場合は90秒経過しても削除しない', async () => {
    const initialSnapshot = createSnapshot();
    const { scheduler, removePlayer, setLatestSnapshot } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(45_000);
    setLatestSnapshot(createSnapshot({ roomStatus: 'playing' }));
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS);

    expect(removePlayer).not.toHaveBeenCalled();
  });

  it('削除直前の最新onlineUserIdsでオンラインなら削除しない', async () => {
    const initialSnapshot = createSnapshot({
      onlineUserIds: [hostUserId, 'player-2']
    });
    const { scheduler, removePlayer, setLatestSnapshot } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS - 1);

    setLatestSnapshot(
      createSnapshot({ onlineUserIds: [hostUserId, 'player-1', 'player-2'] }),
      false
    );
    await vi.advanceTimersByTimeAsync(1);

    expect(removePlayer).not.toHaveBeenCalled();
  });

  it('複数人の切断猶予をそれぞれの切断時刻から管理する', async () => {
    const initialSnapshot = createSnapshot({
      onlineUserIds: [hostUserId, 'player-2']
    });
    const { scheduler, removePlayer, setLatestSnapshot } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(30_000);

    setLatestSnapshot(createSnapshot());
    await vi.advanceTimersByTimeAsync(60_000);

    expect(removePlayer).toHaveBeenCalledTimes(1);
    expect(removePlayer).toHaveBeenNthCalledWith(1, roomId, 'player-1');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(removePlayer).toHaveBeenCalledTimes(2);
    expect(removePlayer).toHaveBeenNthCalledWith(2, roomId, 'player-2');
  });

  it('ホスト自身はオフラインでも削除対象にしない', async () => {
    const initialSnapshot = createSnapshot({
      players: [{ userId: hostUserId }],
      onlineUserIds: []
    });
    const { scheduler, removePlayer } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS);

    expect(removePlayer).not.toHaveBeenCalled();
  });

  it('disposeですべての参加者タイマーを解除する', async () => {
    const initialSnapshot = createSnapshot();
    const { scheduler, removePlayer } = createScheduler(initialSnapshot);

    scheduler.reconcile(initialSnapshot);
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(HOST_RECONNECT_GRACE_PERIOD_MS);

    expect(removePlayer).not.toHaveBeenCalled();
  });
});
