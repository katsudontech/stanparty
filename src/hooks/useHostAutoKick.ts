import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Player, RoomState } from '@/games/core/types';

export function useHostAutoKick(
  roomId: string,
  isHost: boolean,
  roomState: RoomState | null,
  players: Player[],
  onlineUserIds: string[],
  myUserId: string | null
) {
    const roomStatus = roomState?.status;

    useEffect(() => {
        if (!isHost || roomStatus !== 'waiting' || onlineUserIds.length === 0) {
            return;
        }

        const disconnectedUsers = players.filter((player) =>
            player.userId !== myUserId && !onlineUserIds.includes(player.userId)
        );

        if (disconnectedUsers.length === 0) return;

        console.log('通信切断の可能性があるユーザーを検知（5秒後に退出させます）:', disconnectedUsers);

        const timer = setTimeout(async () => {
            const supabase = createClient();
            const { error } = await supabase.rpc('remove_room_players', {
                p_room_id: roomId,
                p_user_ids: disconnectedUsers.map((player) => player.userId)
            });

            if (error) {
                console.error('切断プレイヤーの退出処理に失敗しました:', error);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [isHost, roomStatus, players, onlineUserIds, myUserId, roomId]);
}
