'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RoomState } from '@/games/core/types';
import { useActionLock } from '@/hooks/useActionLock';
import { createClient } from '@/lib/supabase/client';
import type { Action, PrivateState, PublicState } from './rules';

class SkullResponseError extends Error {}

function message(error: unknown) {
  return error instanceof SkullResponseError ? error.message : '通信に失敗しました。接続を確認してください';
}

export function useSkullGame(room: RoomState) {
  const supabase = useMemo(() => createClient(), []);
  const { acquire, release, pending } = useActionLock();
  const [snapshot, setSnapshot] = useState<PrivateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidate = room.game_state as PublicState | null;
  const publicState = candidate?.game === 'skull' ? candidate : null;
  const matchId = publicState?.matchId;
  const revision = publicState?.revision;

  const callApi = useCallback(async (payload: Record<string, unknown>, signal?: AbortSignal): Promise<PrivateState> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new SkullResponseError('接続が切れています。ページを読み込み直してください');
    const response = await fetch('/api/skull', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: room.id, ...payload }),
      signal,
    });
    const body = await response.json() as { data?: PrivateState; error?: string };
    if (!response.ok || !body.data) throw new SkullResponseError(body.error ?? 'ゲーム操作に失敗しました');
    return body.data;
  }, [room.id, supabase]);

  const accept = useCallback((data: PrivateState) => {
    setSnapshot(previous => previous?.matchId === data.matchId && previous.revision > data.revision ? previous : data);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await callApi({ action: 'snapshot' }, signal);
      if (signal?.aborted) return;
      accept(data);
      setError(null);
    } catch (caught: unknown) {
      if (!signal?.aborted) setError(message(caught));
    }
  }, [accept, callApi]);

  useEffect(() => {
    if (!matchId) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [matchId, refresh, revision]);

  useEffect(() => {
    if (!matchId) return;
    const controller = new AbortController();
    const reconnect = () => {
      if (!document.hidden) void refresh(controller.signal);
    };
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    return () => {
      controller.abort();
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', reconnect);
    };
  }, [matchId, refresh]);

  const privateState = snapshot && (!publicState ||
    (snapshot.matchId === publicState.matchId && snapshot.revision >= publicState.revision)) ? snapshot : null;
  const state = privateState ?? publicState;

  async function initialize() {
    if (!acquire()) return;
    setError(null);
    try {
      accept(await callApi({ action: 'initialize', epoch: room.skull_epoch ?? 0 }));
    } catch (caught: unknown) {
      setError(message(caught));
    } finally {
      release();
    }
  }

  async function action(action: Action, value?: string | number) {
    if (!privateState || !acquire()) return;
    setError(null);
    try {
      accept(await callApi({
        action, value, actionId: crypto.randomUUID(), matchId: privateState.matchId,
        expectedRevision: privateState.revision, round: privateState.round, phase: privateState.phase,
      }));
    } catch (caught: unknown) {
      await refresh();
      setError(message(caught));
    } finally {
      release();
    }
  }

  return { state, error, initializing: !state && room.status === 'playing', busy: pending || !privateState, pending, initialize, action, refresh };
}
