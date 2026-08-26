export const HOST_RECONNECT_GRACE_PERIOD_MS = 90_000;

export interface HostAutoKickSnapshot {
  roomId: string;
  isHost: boolean;
  roomStatus: 'waiting' | 'playing' | 'finished' | null;
  players: ReadonlyArray<{ userId: string }>;
  onlineUserIds: readonly string[];
  isPresenceSynced: boolean;
  hostUserId: string | null;
}

interface HostAutoKickSchedulerOptions {
  getLatestSnapshot: () => HostAutoKickSnapshot;
  removePlayer: (roomId: string, userId: string) => Promise<void>;
  onRemovalError?: (error: unknown) => void;
  gracePeriodMs?: number;
}

interface PlayerTimer {
  roomId: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

function canManageDisconnectedPlayers(snapshot: HostAutoKickSnapshot): boolean {
  return snapshot.isHost && snapshot.isPresenceSynced && snapshot.roomStatus === 'waiting';
}

function isRemovalCandidate(snapshot: HostAutoKickSnapshot, userId: string): boolean {
  return (
    canManageDisconnectedPlayers(snapshot) &&
    userId !== snapshot.hostUserId &&
    snapshot.players.some((player) => player.userId === userId) &&
    !snapshot.onlineUserIds.includes(userId)
  );
}

export class HostAutoKickScheduler {
  private readonly timers = new Map<string, PlayerTimer>();
  private readonly getLatestSnapshot: () => HostAutoKickSnapshot;
  private readonly removePlayer: (roomId: string, userId: string) => Promise<void>;
  private readonly onRemovalError?: (error: unknown) => void;
  private readonly gracePeriodMs: number;

  constructor({
    getLatestSnapshot,
    removePlayer,
    onRemovalError,
    gracePeriodMs = HOST_RECONNECT_GRACE_PERIOD_MS
  }: HostAutoKickSchedulerOptions) {
    this.getLatestSnapshot = getLatestSnapshot;
    this.removePlayer = removePlayer;
    this.onRemovalError = onRemovalError;
    this.gracePeriodMs = gracePeriodMs;
  }

  reconcile(snapshot: HostAutoKickSnapshot): void {
    if (!canManageDisconnectedPlayers(snapshot)) {
      this.clearAll();
      return;
    }

    const playerIds = new Set(snapshot.players.map((player) => player.userId));
    const onlineUserIds = new Set(snapshot.onlineUserIds);

    for (const [userId, timer] of this.timers) {
      const shouldCancel =
        timer.roomId !== snapshot.roomId ||
        !playerIds.has(userId) ||
        userId === snapshot.hostUserId ||
        onlineUserIds.has(userId);

      if (shouldCancel) this.clearTimer(userId);
    }

    for (const player of snapshot.players) {
      if (
        player.userId === snapshot.hostUserId ||
        onlineUserIds.has(player.userId) ||
        this.timers.has(player.userId)
      ) {
        continue;
      }

      this.scheduleRemoval(snapshot.roomId, player.userId);
    }
  }

  dispose(): void {
    this.clearAll();
  }

  private scheduleRemoval(roomId: string, userId: string): void {
    const timeoutId = setTimeout(() => {
      const timer = this.timers.get(userId);
      if (!timer || timer.timeoutId !== timeoutId) return;

      this.timers.delete(userId);

      const latestSnapshot = this.getLatestSnapshot();
      if (latestSnapshot.roomId !== roomId || !isRemovalCandidate(latestSnapshot, userId)) {
        return;
      }

      void this.removePlayer(roomId, userId).catch((error: unknown) => {
        this.onRemovalError?.(error);
      });
    }, this.gracePeriodMs);

    this.timers.set(userId, { roomId, timeoutId });
  }

  private clearTimer(userId: string): void {
    const timer = this.timers.get(userId);
    if (!timer) return;

    clearTimeout(timer.timeoutId);
    this.timers.delete(userId);
  }

  private clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer.timeoutId);
    }
    this.timers.clear();
  }
}
