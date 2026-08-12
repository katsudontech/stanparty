import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

import type { GameEvent } from '@/games/core/types';

export function useGameEvents<T = unknown>(roomId: string, eventType?: string) {
  const [events, setEvents] = useState<GameEvent<T>[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    // ゲームイベントの監視チャンネルを作成
    const channel = supabase
      .channel(`game_events_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // イベントは「追加（INSERT）」されるのみ
          schema: 'public',
          table: 'game_events',
          filter: `room_id=eq.${roomId}`, // この部屋のイベントだけを取得
        },
        (payload) => {
          if (isMounted) {
            const newEvent = payload.new as GameEvent<T>;
            // 特定のイベントタイプ（例：'draw_line'）のみを取得したい場合のフィルタリング
            if (!eventType || newEvent.event_type === eventType) {
              setEvents((prev) => [...prev, newEvent]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, eventType]);

  // ちなみに、イベントを「送信」する関数もここに用意しておくと、各ゲーム側から使いやすくなります
  const sendEvent = async (type: string, payload: T) => {
    const supabase = createClient();
    const { error } = await supabase.from('game_events').insert({
      room_id: roomId,
      event_type: type,
      payload: payload,
    });
    if (error) {
      console.error('イベントの送信に失敗しました:', error);
    }
  };

  return { events, sendEvent };
}
