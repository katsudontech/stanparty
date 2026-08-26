import { useEffect, useLayoutEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  HostAutoKickScheduler,
  type HostAutoKickSnapshot
} from '@/hooks/hostAutoKickScheduler';
import type { Player, RoomState } from '@/games/core/types';

export function useHostAutoKick(
  roomId: string,
  isHost: boolean,
  roomState: RoomState | null,
  players: Player[],
  onlineUserIds: string[],
  isPresenceSynced: boolean,
  myUserId: string | null
) {
  const roomStatus = roomState?.status ?? null;
  const hostUserId = roomState?.host_id ?? myUserId;
  const latestSnapshotRef = useRef<HostAutoKickSnapshot>({
    roomId,
    isHost,
    roomStatus,
    players,
    onlineUserIds,
    isPresenceSynced,
    hostUserId
  });
  const schedulerRef = useRef<HostAutoKickScheduler | null>(null);

  useLayoutEffect(() => {
    latestSnapshotRef.current = {
      roomId,
      isHost,
      roomStatus,
      players,
      onlineUserIds,
      isPresenceSynced,
      hostUserId
    };
  }, [
    hostUserId,
    isHost,
    isPresenceSynced,
    onlineUserIds,
    players,
    roomId,
    roomStatus
  ]);

  useEffect(() => {
    const scheduler = new HostAutoKickScheduler({
      getLatestSnapshot: () => latestSnapshotRef.current,
      removePlayer: async (targetRoomId, userId) => {
        const supabase = createClient();
        const { error } = await supabase.rpc('remove_room_players', {
          p_room_id: targetRoomId,
          p_user_ids: [userId]
        });

        if (error) throw error;
      },
      onRemovalError: (error) => {
        console.error('切断プレイヤーの退出処理に失敗しました:', error);
      }
    });

    schedulerRef.current = scheduler;

    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, []);

  useEffect(() => {
    schedulerRef.current?.reconcile(latestSnapshotRef.current);
  }, [isHost, isPresenceSynced, myUserId, onlineUserIds, players, roomId, roomState]);
}
