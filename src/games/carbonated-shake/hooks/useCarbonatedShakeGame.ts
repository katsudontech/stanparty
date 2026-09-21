'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';
import { scoreForShakeAmount } from '../rules';
import { HINT_DURATION_MS, PENDING_HINT_TIMEOUT_MS, SERVER_UPDATE_INTERVAL_MS } from '../constants';
import { normalizeCarbonatedShakeState, type CarbonatedShakePrivateHint } from '../types';

function readableError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'object' && value !== null && 'message' in value) return new Error(String(value.message));
  return new Error(fallback);
}

export function useCarbonatedShakeGame(room: RoomState, myUserId: string) {
  const roomState = normalizeCarbonatedShakeState(room.game_state);
  const [authoritativeState, setAuthoritativeState] = useState<ReturnType<typeof normalizeCarbonatedShakeState> | null>(null);
  const state = authoritativeState && authoritativeState.matchId === roomState.matchId && authoritativeState.stateRevision >= roomState.stateRevision ? authoritativeState : roomState;
  const [error, setError] = useState<string | null>(null);
  const [localAmount, setLocalAmount] = useState(0);
  const [hint, setHint] = useState<CarbonatedShakePrivateHint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const amountRef = useRef(0);
  const sequenceRef = useRef(0);
  const turnKeyRef = useRef('');
  const sendRef = useRef<Promise<unknown> | null>(null);
  const lastHintKeyRef = useRef('');
  const advanceTurnRef = useRef<(() => Promise<void>) | null>(null);
  const supabaseRef = useRef(createClient());

  const isMyTurn = state.phase === 'shaking' && state.currentPlayerId === myUserId;
  const turnKey = `${state.matchId}:${state.turnNumber}`;

  useEffect(() => {
    if (turnKeyRef.current === turnKey) return;
    turnKeyRef.current = turnKey;
    amountRef.current = 0;
    sequenceRef.current = 0;
    setLocalAmount(0);
    setHint(null);
  }, [turnKey]);

  const call = useCallback(async <T,>(name: string, args: Record<string, unknown>): Promise<T | null> => {
    const { data, error: rpcError } = await supabaseRef.current.rpc(name, args);
    if (rpcError) throw readableError(rpcError, 'ゲーム操作に失敗しました');
    if (data && typeof data === 'object' && 'game' in data && (data as { game?: unknown }).game === 'carbonated-shake') {
      const next = normalizeCarbonatedShakeState(data);
      setAuthoritativeState((previous) => previous && previous.matchId === next.matchId && previous.stateRevision > next.stateRevision ? previous : next);
    }
    return data as T | null;
  }, []);

  const initialize = useCallback(async () => {
    try {
      await call('carbonated_shake_initialize', { p_room_id: room.id });
    } catch (caught: unknown) {
      setError(readableError(caught, 'ゲームを開始できませんでした').message);
      throw caught;
    }
  }, [call, room.id]);

  const applyAmount = useCallback(async (amount: number, sequence: number) => {
    if (!isMyTurn || !state.matchId) return;
    return call('carbonated_shake_apply_shake', {
      p_room_id: room.id,
      p_match_id: state.matchId,
      p_turn_number: state.turnNumber,
      p_sequence: sequence,
      p_total_shake_amount: amount,
    });
  }, [call, isMyTurn, room.id, state.matchId, state.turnNumber]);

  const queueShakeAmount = useCallback((amount: number) => {
    if (!isMyTurn || !Number.isFinite(amount) || amount <= 0) return;
    amountRef.current += amount;
    setLocalAmount(amountRef.current);
  }, [isMyTurn]);

  const flushShake = useCallback(async () => {
    if (!isMyTurn || amountRef.current <= 0) return null;
    if (sendRef.current) {
      const previousResult = await sendRef.current;
      if (previousResult && typeof previousResult === 'object' && 'phase' in previousResult && (previousResult as { phase?: unknown }).phase !== 'shaking') return previousResult;
      if (!isMyTurn || amountRef.current <= 0) return previousResult;
    }
    const sequence = ++sequenceRef.current;
    const request = applyAmount(amountRef.current, sequence);
    sendRef.current = request;
    try { return await request; } finally {
      if (sendRef.current === request) sendRef.current = null;
    }
  }, [applyAmount, isMyTurn]);

  useEffect(() => {
    if (!isMyTurn) return;
    const timer = window.setInterval(() => {
      if (amountRef.current <= 0 || sendRef.current) return;
      void flushShake().catch((caught: unknown) => setError(readableError(caught, 'シェイクを同期できませんでした').message));
    }, SERVER_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [flushShake, isMyTurn]);

  const finishTurn = useCallback(async () => {
    if (!isMyTurn) return;
    setError(null);
    try {
      const result = await flushShake() as { phase?: unknown } | null;
      if (result?.phase && result.phase !== 'shaking') return;
      await call('carbonated_shake_finish_turn', {
        p_room_id: room.id,
        p_match_id: state.matchId,
        p_turn_number: state.turnNumber,
      });
    } catch (caught: unknown) {
      setError(readableError(caught, 'ターンを終了できませんでした').message);
      throw caught;
    }
  }, [call, flushShake, isMyTurn, room.id, state.matchId, state.turnNumber]);

  const loadHint = useCallback(async () => {
    if (state.phase !== 'hint_pending' || state.currentPlayerId !== myUserId || !state.matchId) return;
    const key = `${state.matchId}:${state.turnNumber}`;
    if (lastHintKeyRef.current === key) return;
    lastHintKeyRef.current = key;
    setHintLoading(true);
    try {
      const result = await call<CarbonatedShakePrivateHint | null>('carbonated_shake_consume_hint', {
        p_room_id: room.id,
        p_match_id: state.matchId,
        p_turn_number: state.turnNumber,
      });
      if (result?.level && result.matchId === state.matchId && result.turnNumber === state.turnNumber && turnKeyRef.current === `${state.matchId}:${state.turnNumber}`) {
        setHint(result);
        window.setTimeout(() => {
          if (turnKeyRef.current === key) setHint(null);
        }, HINT_DURATION_MS);
        window.setTimeout(() => {
          const advance = advanceTurnRef.current;
          if (turnKeyRef.current === key && advance) void advance().catch(() => {});
        }, HINT_DURATION_MS + 20);
      }
    } catch (caught: unknown) {
      lastHintKeyRef.current = '';
      setError(readableError(caught, '危険度を読み込めませんでした').message);
    } finally {
      setHintLoading(false);
    }
  }, [call, myUserId, room.id, state.currentPlayerId, state.matchId, state.phase, state.turnNumber]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadHint(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHint]);

  const advanceTurn = useCallback(async () => {
    if (!state.matchId) return;
    await call('carbonated_shake_advance_turn', {
      p_room_id: room.id,
      p_match_id: state.matchId,
      p_turn_number: state.turnNumber,
    });
  }, [call, room.id, state.matchId, state.turnNumber]);

  useEffect(() => { advanceTurnRef.current = advanceTurn; }, [advanceTurn]);

  useEffect(() => {
    if (state.phase !== 'hint_pending' || !state.pendingHintDeadline) return;
    const delay = Math.max(0, new Date(state.pendingHintDeadline).getTime() - Date.now()) + 20;
    let attempts = 0;
    let timer: number | undefined;
    let cancelled = false;
    const attempt = () => {
      void advanceTurn().catch(() => { attempts += 1; if (!cancelled && attempts < 8) timer = window.setTimeout(attempt, 500); });
    };
    timer = window.setTimeout(attempt, delay);
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [advanceTurn, state.pendingHintDeadline, state.phase]);

  useEffect(() => {
    if (state.phase !== 'hint_display' || !state.displayUntil) return;
    const recoveryDelay = Math.max(0, PENDING_HINT_TIMEOUT_MS - HINT_DURATION_MS);
    const delay = Math.max(0, new Date(state.displayUntil).getTime() - Date.now()) + recoveryDelay;
    let attempts = 0;
    let timer: number | undefined;
    let cancelled = false;
    const attempt = () => {
      void advanceTurn().catch(() => { attempts += 1; if (!cancelled && attempts < 8) timer = window.setTimeout(attempt, 500); });
    };
    timer = window.setTimeout(attempt, delay || HINT_DURATION_MS);
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [advanceTurn, myUserId, state.currentPlayerId, state.displayUntil, state.phase]);

  return {
    state,
    error,
    setError,
    hint,
    hintLoading,
    isMyTurn,
    localAmount,
    plannedScore: scoreForShakeAmount(localAmount),
    initialize,
    queueShakeAmount,
    flushShake,
    finishTurn,
    advanceTurn,
    loadHint,
  };
}
