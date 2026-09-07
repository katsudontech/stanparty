'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomState } from '@/games/core/types';
import { createClient } from '@/lib/supabase/client';
import { normalizePinchState, type PinchPrivateState } from '../types';

const EMPTY_PRIVATE: PinchPrivateState = { hand: [], selection: null, vote: null };

function errorMessage(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'object' && value !== null && 'message' in value) return new Error(String(value.message));
  return new Error(fallback);
}

export function usePinchHintGame(room: RoomState) {
  const state = normalizePinchState(room.game_state);
  const [privateState, setPrivateState] = useState<PinchPrivateState>(EMPTY_PRIVATE);
  const [error, setError] = useState<string | null>(null);
  const [privateLoading, setPrivateLoading] = useState(true);
  const privateRequestRef = useRef(0);

  const loadPrivate = useCallback(async () => {
    const requestId = ++privateRequestRef.current;
    setPrivateLoading(true);
    try {
      const { data, error: rpcError } = await createClient().rpc('pinch_hint_get_private', { p_room_id: room.id });
      if (rpcError) throw errorMessage(rpcError, '手札を読み込めませんでした');
      if (requestId !== privateRequestRef.current) return;
      const value = data as Partial<PinchPrivateState> | null;
      if (value?.matchId !== state.matchId || value?.turnIndex !== state.turnIndex || value?.stateRevision !== state.stateRevision) return;
      setPrivateState({ hand: Array.isArray(value?.hand) ? value.hand : [], selection: Array.isArray(value?.selection) ? value.selection : null, vote: value?.vote === 'yes' || value?.vote === 'no' ? value.vote : null, matchId: value.matchId, turnIndex: value.turnIndex, stateRevision: value.stateRevision });
    } finally {
      if (requestId === privateRequestRef.current) setPrivateLoading(false);
    }
  }, [room.id, state.matchId, state.stateRevision, state.turnIndex]);

  useEffect(() => {
    if (state.phase === 'rule_setting' || state.phase === 'finished') {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void loadPrivate().catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError, '手札を読み込めませんでした').message);
      });
    }, 0);
    return () => { active = false; privateRequestRef.current += 1; window.clearTimeout(timer); };
  }, [loadPrivate, state.matchId, state.phase, state.stateRevision, state.turnIndex]);

  useEffect(() => {
    if (state.phase === 'rule_setting' || state.phase === 'finished') return;
    const refresh = () => { void loadPrivate().catch(() => {}); };
    const handleVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadPrivate, state.matchId, state.phase, state.stateRevision, state.turnIndex]);

  const run = useCallback(async <T,>(action: () => unknown) => {
    setError(null);
    const result = await action() as { data: T | null; error: unknown };
    if (result.error) throw errorMessage(result.error, '操作に失敗しました');
    return result.data;
  }, []);

  const initialize = useCallback((rounds: number) => run(() => createClient().rpc('pinch_hint_initialize', { p_room_id: room.id, p_rounds: rounds })), [room.id, run]);
  const prepare = useCallback((selection: string[], turnIndex: number, matchId: string) => run(() => createClient().rpc('pinch_hint_prepare', { p_room_id: room.id, p_selection: selection, p_expected_turn_index: turnIndex, p_expected_match_id: matchId })), [room.id, run]);
  const reveal = useCallback((expectedIndex: number, turnIndex: number, matchId: string) => run(() => createClient().rpc('pinch_hint_reveal', { p_room_id: room.id, p_expected_index: expectedIndex, p_expected_turn_index: turnIndex, p_expected_match_id: matchId })), [room.id, run]);
  const finishPresentation = useCallback((turnIndex: number, matchId: string) => run(() => createClient().rpc('pinch_hint_finish_presentation', { p_room_id: room.id, p_expected_turn_index: turnIndex, p_expected_match_id: matchId })), [room.id, run]);
  const vote = useCallback(async (choice: 'yes' | 'no', turnIndex: number, matchId: string) => {
    const result = await run(() => createClient().rpc('pinch_hint_vote', { p_room_id: room.id, p_vote: choice, p_expected_turn_index: turnIndex, p_expected_match_id: matchId }));
    await loadPrivate();
    return result;
  }, [loadPrivate, room.id, run]);
  const nextTurn = useCallback((turnIndex: number, matchId: string) => run(() => createClient().rpc('pinch_hint_next_turn', { p_room_id: room.id, p_expected_turn_index: turnIndex, p_expected_match_id: matchId })), [room.id, run]);

  return { state, privateState, privateLoading, error, setError, initialize, prepare, reveal, finishPresentation, vote, nextTurn, reloadPrivate: loadPrivate };
}
