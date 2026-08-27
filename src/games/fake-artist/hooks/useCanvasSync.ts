import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DrawLinePayload, UndoLinePayload } from '../types';
import type { GameEvent } from '@/games/core/types';
import type { CanvasPath } from 'react-sketch-canvas';

interface UseCanvasSyncProps {
  roomId: string;
  myUserId: string | null;
  onInitialStrokesLoaded: (strokes: CanvasPath[]) => void;
  onNewStrokeReceived: (stroke: CanvasPath) => void;
  onStrokeDeleted?: () => void;
}

type CanvasEvent = GameEvent<DrawLinePayload | UndoLinePayload>;

export function useCanvasSync({ roomId, myUserId, onInitialStrokesLoaded, onNewStrokeReceived, onStrokeDeleted }: UseCanvasSyncProps) {
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const initialLoadCompleteRef = useRef(false);
  const realtimeSubscribedRef = useRef(false);
  const snapshotLoadingRef = useRef(false);
  const snapshotReloadRequestedRef = useRef(false);
  const bufferedEventsRef = useRef<CanvasEvent[]>([]);
  const channelInstanceId = useId().replaceAll(':', '');

  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    let isMounted = true;

    seenEventIdsRef.current = new Set();
    initialLoadCompleteRef.current = false;
    realtimeSubscribedRef.current = false;
    snapshotLoadingRef.current = false;
    snapshotReloadRequestedRef.current = false;
    bufferedEventsRef.current = [];

    const applyEvent = (event: CanvasEvent, wasBuffered = false) => {
      if (seenEventIdsRef.current.has(event.id)) return;

      if (event.event_type === 'draw_line') {
        const payload = event.payload as DrawLinePayload;
        if (!payload?.stroke) return;

        seenEventIdsRef.current.add(event.id);
        if (!myUserId || payload.playerId !== myUserId) {
          onNewStrokeReceived(payload.stroke);
        }
        return;
      }

      if (event.event_type === 'undo_line') {
        const payload = event.payload as UndoLinePayload;
        seenEventIdsRef.current.add(event.id);

        // The initial query may already exclude the deleted stroke. Only pop
        // when this client had actually applied the target event.
        const targetWasApplied = Boolean(
          payload?.targetEventId && seenEventIdsRef.current.delete(payload.targetEventId)
        );
        if (!wasBuffered || targetWasApplied) {
          onStrokeDeleted?.();
        }
      }
    };

    const fetchStrokeSnapshot = async () => {
      if (snapshotLoadingRef.current) {
        snapshotReloadRequestedRef.current = true;
        return;
      }

      snapshotLoadingRef.current = true;
      setIsSyncReady(false);
      let lastSnapshotSucceeded = false;

      do {
        snapshotReloadRequestedRef.current = false;

        const { data, error } = await supabase
          .from('game_events')
          .select('*')
          .eq('room_id', roomId)
          .eq('event_type', 'draw_line')
          .order('created_at', { ascending: true });

        if (!isMounted) {
          snapshotLoadingRef.current = false;
          return;
        }

        if (error) {
          lastSnapshotSucceeded = false;
          setHistoryError(error.message || '描画履歴の取得に失敗しました');
          continue;
        }

        const initialEvents = (data || []) as GameEvent<DrawLinePayload>[];
        const strokes: CanvasPath[] = [];
        const snapshotEventIds = new Set<string>();

        for (const event of initialEvents) {
          if (!event.payload?.stroke) continue;
          snapshotEventIds.add(event.id);
          strokes.push(event.payload.stroke);
        }

        // Replace the local snapshot before replaying events received while the
        // query was in flight. This also reconciles the gap before Realtime is
        // fully subscribed.
        seenEventIdsRef.current = snapshotEventIds;
        onInitialStrokesLoaded(strokes);
        initialLoadCompleteRef.current = true;
        lastSnapshotSucceeded = true;

        const bufferedEvents = bufferedEventsRef.current
          .splice(0)
          .sort((left, right) => {
            const createdAtOrder = left.created_at.localeCompare(right.created_at);
            return createdAtOrder || left.id.localeCompare(right.id);
          });
        for (const event of bufferedEvents) applyEvent(event, true);

        setHistoryError(null);
      } while (snapshotReloadRequestedRef.current);

      snapshotLoadingRef.current = false;
      setIsSyncReady(lastSnapshotSucceeded && realtimeSubscribedRef.current);
    };

    const channel = supabase
      .channel(`canvas_sync_${roomId}_${channelInstanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const event = payload.new as CanvasEvent;
          if (event.event_type !== 'draw_line' && event.event_type !== 'undo_line') return;

          if (snapshotLoadingRef.current || !initialLoadCompleteRef.current) {
            bufferedEventsRef.current.push(event);
            return;
          }

          applyEvent(event);
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;

        if (status === 'SUBSCRIBED') {
          realtimeSubscribedRef.current = true;
          setRealtimeError(null);
          setIsSyncReady(false);
          // Reconcile once the subscription is active. If the immediate query
          // is still running, it requests one more snapshot afterward.
          void fetchStrokeSnapshot();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeSubscribedRef.current = false;
          setIsSyncReady(false);
          setRealtimeError('描画のリアルタイム同期に接続できませんでした');
        }
      });

    // Reading an already completed drawing must not depend on Realtime being
    // connected. Start restoring persisted strokes immediately.
    void fetchStrokeSnapshot();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [channelInstanceId, roomId, myUserId, onInitialStrokesLoaded, onNewStrokeReceived, onStrokeDeleted]);

  // The RPC inserts the stroke and advances the turn under one room-row lock.
  const insertStroke = useCallback(async (stroke: CanvasPath) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fake_artist_submit_stroke', {
      p_room_id: roomId,
      p_stroke: stroke,
    });

    if (error || !data) {
      console.error('ストロークの保存に失敗しました:', error);
      throw new Error(error?.message || 'ストロークの保存に失敗しました');
    }
  }, [roomId]);

  return { insertStroke, isSyncReady, syncError: historyError || realtimeError };
}
