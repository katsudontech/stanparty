'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { RoomState } from '@/games/core/types';
import { createClient } from '@/lib/supabase/client';

import { normalizeAiBarenaiDrawingState } from '../types';

type DrawingAction = 'initialize' | 'judge' | 'answer' | 'continue' | 'topic' | 'resume';

interface ActionResponse {
  error?: string;
  data?: unknown;
  answer?: string;
}

export function useAiBarenaiDrawingGame(room: RoomState) {
  const state = normalizeAiBarenaiDrawingState(room.game_state);
  const [error, setError] = useState<string | null>(null);
  const resumeInFlightRef = useRef(false);

  const call = useCallback(async (
    action: DrawingAction,
    payload: Record<string, unknown> = {},
  ) => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('認証セッションがありません');

    const response = await fetch('/api/ai-barenai-drawing', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, roomId: room.id, ...payload }),
    });
    const result = await response.json() as ActionResponse;

    if (!response.ok) {
      throw new Error(result.error || '操作に失敗しました');
    }

    return result.data ?? result;
  }, [room.id]);

  const runAction = useCallback(async (
    action: DrawingAction,
    payload: Record<string, unknown> = {},
  ) => {
    setError(null);
    try {
      return await call(action, payload);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作に失敗しました');
      throw actionError;
    }
  }, [call]);

  useEffect(() => {
    if (state.phase !== 'answering') return;

    let active = true;
    const resumeProgress = async () => {
      if (resumeInFlightRef.current) return;
      resumeInFlightRef.current = true;
      try {
        await call('resume');
      } catch {
        // A later retry can recover an expired Gemini or judging claim.
      } finally {
        if (active) resumeInFlightRef.current = false;
      }
    };

    void resumeProgress();
    const timer = window.setInterval(() => void resumeProgress(), 12_000);
    return () => {
      active = false;
      resumeInFlightRef.current = false;
      window.clearInterval(timer);
    };
  }, [call, state.phase, state.round]);

  const initialize = useCallback(() => runAction('initialize'), [runAction]);
  const judge = useCallback(
    (snapshot: string) => runAction('judge', { snapshot }),
    [runAction],
  );
  const answer = useCallback(
    (value: string) => runAction('answer', { answer: value }),
    [runAction],
  );
  const continueDrawing = useCallback(() => runAction('continue'), [runAction]);
  const topic = useCallback(() => runAction('topic'), [runAction]);

  return {
    state,
    error,
    initialize,
    judge,
    answer,
    continueDrawing,
    topic,
  };
}
