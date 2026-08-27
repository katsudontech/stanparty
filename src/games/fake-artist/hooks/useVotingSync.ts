import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GameEvent } from '@/games/core/types';

interface UseVotingSyncProps {
  roomId: string;
  myUserId: string | null;
  isHost: boolean;
  playersCount: number;
  onAllVoted: () => Promise<void>;
}

type VoteEvent = Pick<GameEvent, 'id' | 'event_type' | 'actor_id' | 'created_at'>;

export function useVotingSync({ roomId, myUserId, isHost, playersCount, onAllVoted }: UseVotingSyncProps) {
  const [votedPlayersCount, setVotedPlayersCount] = useState(0);
  const [hasCurrentPlayerVoted, setHasCurrentPlayerVoted] = useState(false);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [progressionError, setProgressionError] = useState<string | null>(null);

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const voterIdsRef = useRef<Set<string>>(new Set());
  const bufferedEventsRef = useRef<VoteEvent[]>([]);
  const initialLoadCompleteRef = useRef(false);
  const initialLoadStartedRef = useRef(false);
  const finalizationStartedRef = useRef(false);
  const onAllVotedRef = useRef(onAllVoted);
  const isHostRef = useRef(isHost);
  const playersCountRef = useRef(playersCount);
  const channelInstanceId = useId().replaceAll(':', '');

  useEffect(() => {
    onAllVotedRef.current = onAllVoted;
    isHostRef.current = isHost;
    playersCountRef.current = playersCount;
  }, [isHost, onAllVoted, playersCount]);

  const triggerAllVoted = useCallback(async (force = false) => {
    if (
      !isHostRef.current
      || finalizationStartedRef.current
      || (!force && voterIdsRef.current.size < playersCountRef.current)
    ) {
      return;
    }

    finalizationStartedRef.current = true;
    setIsFinalizing(true);
    setProgressionError(null);

    try {
      await onAllVotedRef.current();
    } catch (error) {
      finalizationStartedRef.current = false;
      setProgressionError(error instanceof Error ? error.message : '投票結果を確定できませんでした');
    } finally {
      setIsFinalizing(false);
    }
  }, []);

  const retryFinalization = useCallback(() => triggerAllVoted(true), [triggerAllVoted]);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    let isMounted = true;

    seenEventIdsRef.current = new Set();
    voterIdsRef.current = new Set();
    bufferedEventsRef.current = [];
    initialLoadCompleteRef.current = false;
    initialLoadStartedRef.current = false;
    finalizationStartedRef.current = false;

    const reconcileVoteState = () => {
      if (!isMounted) return;

      setVotedPlayersCount(voterIdsRef.current.size);
      setHasCurrentPlayerVoted(Boolean(myUserId && voterIdsRef.current.has(myUserId)));
      if (isHostRef.current && voterIdsRef.current.size >= playersCountRef.current) {
        void triggerAllVoted();
      }
    };

    const applyVoteEvent = (event: VoteEvent) => {
      if (event.event_type !== 'vote' || seenEventIdsRef.current.has(event.id)) return;

      seenEventIdsRef.current.add(event.id);
      voterIdsRef.current.add(event.actor_id || `event:${event.id}`);
    };

    const fetchInitialVotes = async () => {
      if (initialLoadCompleteRef.current || initialLoadStartedRef.current) return;
      initialLoadStartedRef.current = true;

      const { data, error } = await supabase
        .from('game_events')
        .select('id, event_type, actor_id, created_at')
        .eq('room_id', roomId)
        .eq('event_type', 'vote')
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (error) {
        initialLoadStartedRef.current = false;
        setSyncError(error.message || '投票状況の取得に失敗しました');
        return;
      }

      for (const event of (data || []) as VoteEvent[]) applyVoteEvent(event);

      initialLoadCompleteRef.current = true;
      const bufferedEvents = bufferedEventsRef.current
        .splice(0)
        .sort((left, right) => left.created_at.localeCompare(right.created_at));
      for (const event of bufferedEvents) applyVoteEvent(event);

      setSyncError(null);
      setIsSyncReady(true);
      reconcileVoteState();
    };

    const channel = supabase
      .channel(`voting_sync_${roomId}_${channelInstanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const event = payload.new as VoteEvent;
          if (event.event_type !== 'vote') return;

          if (!initialLoadCompleteRef.current) {
            bufferedEventsRef.current.push(event);
            return;
          }

          applyVoteEvent(event);
          reconcileVoteState();
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;

        if (status === 'SUBSCRIBED') {
          if (initialLoadCompleteRef.current) {
            setSyncError(null);
            setIsSyncReady(true);
          } else {
            void fetchInitialVotes();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncError('投票のリアルタイム同期に接続できませんでした');
        }
      });

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [channelInstanceId, myUserId, roomId, triggerAllVoted]);

  return {
    votedPlayersCount,
    hasCurrentPlayerVoted,
    isSyncReady,
    isFinalizing,
    syncError,
    progressionError,
    retryFinalization,
  };
}
