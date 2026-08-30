import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CanvasPath } from 'react-sketch-canvas';
import type { DrawingLinePayload, DrawingResetPayload } from '../types';

export function useDrawingCanvasSync(roomId: string, myUserId: string, onInitial: (paths: CanvasPath[]) => void, onStroke: (path: CanvasPath) => void, onReset: () => void) {
  const [ready, setReady] = useState(false);
  const [historyError, setHistoryError] = useState<string|null>(null);
  const [realtimeError, setRealtimeError] = useState<string|null>(null);
  const instance = useId().replaceAll(':', '');
  const seen = useRef(new Set<string>());
  const loading = useRef(false);
  const loaded = useRef(false);
  const buffered = useRef<Array<{id:string;created_at:string;event_type:string;payload:DrawingLinePayload|DrawingResetPayload}>>([]);
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    loading.current = true;
    loaded.current = false;
    buffered.current = [];
    seen.current = new Set();
    let loadInFlight = false;
    let reloadRequested = false;
    const apply = (event: {id:string;created_at:string;event_type:string;payload:DrawingLinePayload|DrawingResetPayload}) => {
      if (seen.current.has(event.id)) return;
      seen.current.add(event.id);
      if (event.event_type === 'ai_barenai_drawing_reset') onReset();
      else if (event.event_type === 'ai_barenai_drawing_line' && 'stroke' in event.payload && event.payload.playerId !== myUserId) onStroke(event.payload.stroke);
    };
    const load = async () => {
      if (loadInFlight) {
        reloadRequested = true;
        return;
      }
      loadInFlight = true;
      loading.current = true;
      loaded.current = false;
      setReady(false);
      const { data, error: fetchError } = await supabase.from('game_events').select('*').eq('room_id', roomId)
        .in('event_type', ['ai_barenai_drawing_line', 'ai_barenai_drawing_reset']).order('created_at', {ascending: true});
      if (!mounted) {
        loadInFlight = false;
        loading.current = false;
        return;
      }
      if (fetchError) {
        setHistoryError(fetchError.message);
        loadInFlight = false;
        loading.current = false;
        return;
      }
      const events = (data ?? []) as Array<{id:string;created_at:string;event_type:string;payload:DrawingLinePayload|DrawingResetPayload}>;
      seen.current = new Set(events.map((e) => e.id));
      let paths: CanvasPath[] = [];
      for (const event of events) {
        if (event.event_type === 'ai_barenai_drawing_reset') paths = [];
        else if (event.event_type === 'ai_barenai_drawing_line' && 'stroke' in event.payload) paths.push(event.payload.stroke);
      }
      onInitial(paths); setReady(true);
      setHistoryError(null);
      loaded.current = true;
      loading.current = false;
      const queued = buffered.current.splice(0).sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      queued.forEach(apply);
      loadInFlight = false;
      loading.current = false;
      if (reloadRequested) {
        reloadRequested = false;
        void load();
      }
    };
    const channel = supabase.channel(`ai_barenai_drawing_canvas_${roomId}_${instance}`)
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'game_events', filter:`room_id=eq.${roomId}`}, (payload) => {
        const event = payload.new as {id:string;created_at:string;event_type:string;payload:DrawingLinePayload|DrawingResetPayload};
        if (loading.current || !loaded.current) {
          buffered.current.push(event);
          return;
        }
        apply(event);
      }).subscribe((status) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') {
          setRealtimeError(null);
          void load();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setReady(false);
          setRealtimeError('描画のリアルタイム同期に接続できませんでした');
        }
      });
    void load();
    return () => { mounted = false; void supabase.removeChannel(channel); };
  }, [roomId, myUserId, instance, onInitial, onStroke, onReset]);
  const submitStroke = useCallback(async (stroke: CanvasPath) => {
    const {error: rpcError} = await createClient().rpc('ai_barenai_drawing_submit_stroke', {p_room_id: roomId, p_stroke: stroke});
    if (rpcError) throw new Error(rpcError.message);
  }, [roomId]);
  const reset = useCallback(async () => {
    const {error: rpcError} = await createClient().rpc('ai_barenai_drawing_reset_canvas', {p_room_id: roomId});
    if (rpcError) throw new Error(rpcError.message);
  }, [roomId]);
  return {ready, error: historyError || realtimeError, submitStroke, reset};
}
