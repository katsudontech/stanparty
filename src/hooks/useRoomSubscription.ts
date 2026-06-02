import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

import type { RoomState, Player } from '@/games/core/types';

export function useRoomSubscription(roomId: string, myUserId?: string | null) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // クライアントインスタンスを作成（コンポーネントマウント時に実行）
    const supabase = createClient();
    let isMounted = true;

    // 1. 初回のルームデータを取得する関数
    const fetchInitialRoom = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) {
        console.error('ルームの取得に失敗しました:', error);
        if (isMounted) setError(error as any);
        return;
      }

      if (isMounted && data) {
        setRoomState(data as RoomState);
        setPlayers((data.players as Player[]) || []);
      }
    };

    fetchInitialRoom();

    // 2. Supabase Realtimeでルームの変更を購読（サブスクライブ）
    const channel = supabase
      .channel(`room_updates_${roomId}`) // チャンネル名は一意にする
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // 更新イベントのみ監視（削除も監視する場合は '*'）
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`, // このルームIDの行だけを監視
        },
        (payload) => {
          // 変更があったら、新しいデータ(payload.new)をStateに反映する
          if (isMounted) {
            const newData = payload.new as RoomState;
            setRoomState(newData);
            setPlayers(newData.players || []);
          }
        }
      )
      .subscribe();

    // 3. Presence機能でオンラインユーザーを監視
    const presenceChannel = supabase.channel(`room_presence_${roomId}`);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        if (isMounted) {
          const state = presenceChannel.presenceState();
          // state は { [key: string]: [{ user_id: '...' }] } の構造
          const onlineIds = Object.values(state).flatMap(presences => 
            presences.map((p: any) => p.user_id)
          );
          setOnlineUserIds(Array.from(new Set(onlineIds)));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && myUserId) {
          // 自分が参加中であることをPresenceに登録（ハートビート開始）
          await presenceChannel.track({ user_id: myUserId });
        }
      });

    // 4. クリーンアップ関数
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      // Untrack は removeChannel で自動的に行われることが多いですが、念のため
      if (myUserId) {
        presenceChannel.untrack().catch(() => {});
      }
      supabase.removeChannel(presenceChannel);
    };
  }, [roomId, myUserId]);

  return { roomState, players, onlineUserIds, error };
}
