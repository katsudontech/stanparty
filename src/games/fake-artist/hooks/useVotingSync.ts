import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseVotingSyncProps {
  roomId: string;
  isHost: boolean;
  playersCount: number;
  onAllVoted: () => void;
}

export function useVotingSync({ roomId, isHost, playersCount, onAllVoted }: UseVotingSyncProps) {
  const [votedPlayersCount, setVotedPlayersCount] = useState(0);
  const supabase = createClient();
  const initializedRoomIdRef = useRef<string | null>(null);
  const onAllVotedRef = useRef(onAllVoted);

  // onAllVoted を最新に保つための Ref
  useEffect(() => {
    onAllVotedRef.current = onAllVoted;
  }, [onAllVoted]);

  // 全員の投票状況を監視
  useEffect(() => {
    if (!roomId) return;

    const fetchInitialVotes = async () => {
      if (initializedRoomIdRef.current === roomId) return;
      initializedRoomIdRef.current = roomId;

      const { data, error } = await supabase
        .from('game_events')
        .select('*')
        .eq('room_id', roomId)
        .eq('event_type', 'vote');

      if (error) {
        console.error('投票状況の取得に失敗しました:', error);
        return;
      }

      if (data) {
        const count = data.length;
        setVotedPlayersCount(count);
        // ホストのみが遷移判定を行う
        if (isHost && count >= playersCount) {
          onAllVotedRef.current();
        }
      }
    };

    fetchInitialVotes();

    const channel = supabase
      .channel(`voting_sync_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.new.event_type === 'vote') {
            setVotedPlayersCount((prev) => {
              const newCount = prev + 1;
              if (isHost && newCount >= playersCount) {
                onAllVotedRef.current();
              }
              return newCount;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isHost, playersCount, supabase]);

  return { votedPlayersCount };
}
