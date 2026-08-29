'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';
import { normalizeAiBarenaiGameState, type AiBarenaiGameState } from '../types';

export function useAiBarenaiGame(room: RoomState, isHost: boolean) {
  const gameState = normalizeAiBarenaiGameState(room.game_state);
  const [topic, setTopic] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);
  const call = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) throw new Error('認証セッションがありません');
    const response = await fetch('/api/ai-barenai', { method: 'POST', headers: {'content-type': 'application/json', Authorization: `Bearer ${session.session.access_token}`}, body: JSON.stringify({action, roomId: room.id, ...payload}) });
    const result = await response.json() as {error?: string; data?: AiBarenaiGameState; answer?: string};
    if (!response.ok) throw new Error(result.error || 'ゲーム操作に失敗しました');
    return result;
  }, [room.id]);
  const handleInitialize = useCallback((hintsPerRound: number) => call('initialize', {hintsPerRound}), [call]);
  const handleHint = useCallback((hint: string) => call('hint', {hint}), [call]);
  const handleAnswer = useCallback((answer: string) => call('answer', {answer}), [call]);
  const handleNextRound = useCallback(() => call('next-round'), [call]);
  const handleTopic = useCallback(async () => { const result = await call('topic'); if (result.answer) setTopic(result.answer); }, [call]);

  useEffect(() => {
    if (!isHost || gameState.phase !== 'answering') return;
    let active = true;
    const runProgress = async () => {
      const key = `${gameState.round}:resume`;
      if (inFlight.current === key) return;
      inFlight.current = key;
      try { await call('resume'); } catch { /* the next lease retry can recover a transient failure */ }
      finally { if (active && inFlight.current === key) inFlight.current = null; }
    };
    void runProgress();
    const timer = window.setInterval(() => void runProgress(), 12_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [call, gameState.phase, gameState.round, isHost]);
  return { gameState, topic, handleInitialize, handleHint, handleAnswer, handleNextRound, handleTopic };
}
