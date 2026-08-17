import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authenticateRealtime } from '@/lib/supabase/realtime';

import type { RoomState, Player } from '@/games/core/types';

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return new Error(String(value.message));
  }
  return new Error(fallbackMessage);
}

async function loadRoom(roomId: string): Promise<RoomState | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (error) throw toError(error, 'ルームの取得に失敗しました');
  return data as RoomState | null;
}

export function useRoomSubscription(roomId: string, myUserId?: string | null) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshRoom = useCallback(async () => {
    try {
      const nextRoom = await loadRoom(roomId);
      setRoomState(nextRoom);
      setPlayers(nextRoom?.players ?? []);
      setError(null);
    } catch (roomError) {
      setError(toError(roomError, 'ルームの取得に失敗しました'));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!myUserId) return;

    const supabase = createClient();
    let isMounted = true;
    let initialLoadComplete = false;
    let roomChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchInitialRoom = async () => {
      try {
        const nextRoom = await loadRoom(roomId);
        if (!isMounted) return;

        setRoomState(nextRoom);
        setPlayers(nextRoom?.players ?? []);
        setError(null);
      } catch (roomError) {
        if (isMounted) {
          setError(toError(roomError, 'ルームの取得に失敗しました'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const connectToRoom = async () => {
      await authenticateRealtime(supabase, myUserId);
      if (!isMounted) return;

      roomChannel = supabase
        .channel(`room_updates_${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`
          },
          (payload) => {
            if (!isMounted) return;

            if (payload.eventType === 'DELETE') {
              setRoomState(null);
              setPlayers([]);
              return;
            }

            const nextRoom = payload.new as RoomState;
            setRoomState(nextRoom);
            setPlayers(nextRoom.players ?? []);
          }
        )
        .subscribe((status) => {
          if (!isMounted) return;

          if (status === 'SUBSCRIBED' && initialLoadComplete) {
            void fetchInitialRoom();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`ルームのRealtime購読に失敗しました: ${status}`);
          }
        });

      await fetchInitialRoom();
      initialLoadComplete = true;
    };

    void connectToRoom().catch((connectionError: unknown) => {
      if (!isMounted) return;
      setError(toError(connectionError, 'ルームのRealtime接続に失敗しました'));
      setLoading(false);
    });

    return () => {
      isMounted = false;
      if (roomChannel) void supabase.removeChannel(roomChannel);
    };
  }, [myUserId, roomId]);

  const isRoomMember = Boolean(
    myUserId &&
    roomState &&
    (
      roomState.host_id === myUserId ||
      roomState.players.some((player) => player.userId === myUserId)
    )
  );

  useEffect(() => {
    if (!myUserId || !isRoomMember) return;

    const supabase = createClient();
    let isMounted = true;

    const presenceChannel = supabase
      .channel(`room:${roomId}:presence`, {
        config: {
          private: true,
          presence: { key: myUserId }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        if (!isMounted) return;

        const presenceState = presenceChannel.presenceState();
        const onlineIds = Object.values(presenceState).flatMap((presences) =>
          presences.flatMap((presence) => {
            const userId = (presence as { user_id?: unknown }).user_id;
            return typeof userId === 'string' ? [userId] : [];
          })
        );

        setOnlineUserIds(Array.from(new Set(onlineIds)));
      });

    const subscribeToPresence = async () => {
      await authenticateRealtime(supabase, myUserId);
      if (!isMounted) return;

      presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isMounted) {
          await presenceChannel.track({ user_id: myUserId });
        }
      });
    };

    void subscribeToPresence().catch((presenceError: unknown) => {
      console.error('Presenceへの接続に失敗しました:', presenceError);
    });

    return () => {
      isMounted = false;
      presenceChannel.untrack().catch(() => {});
      void supabase.removeChannel(presenceChannel);
    };
  }, [isRoomMember, myUserId, roomId]);

  return {
    roomState,
    players,
    onlineUserIds,
    loading,
    error,
    refreshRoom
  };
}
