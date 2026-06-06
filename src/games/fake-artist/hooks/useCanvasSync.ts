import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DrawLinePayload } from '../types';
import type { GameEvent } from '@/games/core/types';
import type { CanvasPath } from 'react-sketch-canvas';

interface UseCanvasSyncProps {
  roomId: string;
  myUserId: string | null;
  onInitialStrokesLoaded: (strokes: CanvasPath[]) => void;
  onNewStrokeReceived: (stroke: CanvasPath) => void;
  onStrokeDeleted?: () => void;
}

export function useCanvasSync({ roomId, myUserId, onInitialStrokesLoaded, onNewStrokeReceived, onStrokeDeleted }: UseCanvasSyncProps) {
  const supabase = createClient();
  const initializedRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // 過去のストロークを初期ロード（1回だけ実行）
    const fetchInitialStrokes = async () => {
      if (initializedRoomIdRef.current === roomId) return;
      initializedRoomIdRef.current = roomId;

      const { data, error } = await supabase
        .from('game_events')
        .select('*')
        .eq('room_id', roomId)
        .eq('event_type', 'draw_line')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('ストロークの取得に失敗しました:', error);
        return;
      }

      if (data && data.length > 0) {
        const strokes = data
          .map((event: GameEvent<DrawLinePayload>) => event.payload?.stroke)
          .filter(Boolean);
        onInitialStrokesLoaded(strokes);
      }
    };

    fetchInitialStrokes();

    // リアルタイムサブスクリプションの設定
    const channel = supabase
      .channel(`canvas_sync_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_events',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEvent = payload.new as GameEvent<DrawLinePayload>;
            if (newEvent.event_type === 'draw_line' && newEvent.payload?.stroke) {
              // 自分自身のイベントは確実に無視する
              if (myUserId && newEvent.payload.playerId === myUserId) {
                return;
              }
              onNewStrokeReceived(newEvent.payload.stroke);
            }
          } else if (payload.eventType === 'DELETE') {
            if (onStrokeDeleted) {
              onStrokeDeleted();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, myUserId, onInitialStrokesLoaded, onNewStrokeReceived]);

  // 新しいストロークをDBに保存
  const insertStroke = useCallback(async (playerId: string, stroke: CanvasPath) => {
    const payload: DrawLinePayload = { playerId, stroke };
    
    const { error } = await supabase
      .from('game_events')
      .insert({
        room_id: roomId,
        event_type: 'draw_line',
        payload,
      });

    if (error) {
      console.error('ストロークの保存に失敗しました:', error);
    }
  }, [roomId]);

  return { insertStroke };
}
