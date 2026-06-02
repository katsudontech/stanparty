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
    useEffect(() => {
        // 自分がホストでない、データが未ロード、waitingでない場合は何もしない
        // ※ onlineUserIdsが空の時（ホスト自身のPresence接続が完了していない時）もスキップ
        if (!isHost || !roomState || roomState.status !== 'waiting' || onlineUserIds.length === 0) return;

        // DB上のプレイヤーのうち、Presenceのオンライン一覧（+ 念のため自分のID）にいない人を探す
        const disconnectedUsers = players.filter((p: Player) =>
            p.userId !== myUserId && !onlineUserIds.includes(p.userId)
        );

        if (disconnectedUsers.length > 0) {
            console.log('通信切断の可能性があるユーザーを検知（5秒後に退出させます）:', disconnectedUsers);
            
            // すぐにキックせず、5秒待つ（初回のラグや、一時的なリロードを救済するため）
            const timer = setTimeout(async () => {
                console.log('5秒経過したため、自動退出させます:', disconnectedUsers);
                const supabase = createClient();
                
                // 競合を防ぐため、キック直前に最新のDBデータを取得して更新する
                const { data } = await supabase.from('rooms').select('players').eq('id', roomId).single();
                
                if (data) {
                    const currentPlayers: Player[] = data.players || [];
                    const remainingPlayers = currentPlayers.filter((p: Player) => 
                        p.userId === myUserId || onlineUserIds.includes(p.userId)
                    );
                    await supabase.from('rooms').update({ players: remainingPlayers }).eq('id', roomId);
                }
            }, 5000);

            // 5秒以内にそのユーザーが復帰（onlineUserIdsが更新）したら、タイマーをキャンセルしてキックを無効化！
            return () => clearTimeout(timer);
        }
    }, [isHost, roomState?.status, players, onlineUserIds, myUserId, roomId]);
}
