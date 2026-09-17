import { useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getGamePlayerCountError } from '@/games/catalog';

export function useRoomControls(roomId: string) {
    const lobbyRequest = useRef<Promise<void> | null>(null);
    const handleChangeGame = async (gameId: string) => {
        const supabase = createClient();
        const { error } = await supabase
            .from('rooms')
            .update({ game_type: gameId })
            .eq('id', roomId);
            
        if (error) {
            throw new Error('ゲームを変更できませんでした。もう一度お試しください。');
        }
    };

    const handleStartGame = async () => {
        const supabase = createClient();
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('game_type, players, status')
            .eq('id', roomId)
            .single();

        if (roomError || !room) {
            console.error('ゲーム開始前のルーム確認に失敗しました:', roomError);
            alert('ゲームの開始に失敗しました');
            return;
        }

        if (room.status !== 'waiting') return;

        const playerCount = Array.isArray(room.players) ? room.players.length : 0;
        const playerCountError = getGamePlayerCountError(room.game_type, playerCount);

        if (playerCountError) {
            alert(playerCountError);
            return;
        }

        const { error } = await supabase
            .from('rooms')
            .update({ status: 'playing' })
            .eq('id', roomId)
            .eq('status', 'waiting');

        if (error) {
            console.error('ゲーム開始に失敗しました:', error);
            alert('ゲームの開始に失敗しました');
        }
    };

    const returnToLobby = async () => {
        const supabase = createClient();
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'waiting', game_state: {} })
            .eq('id', roomId);

        if (error) {
            console.error('ロビーへの復帰に失敗しました:', error);
            alert('ロビーに戻れませんでした');
        }
    };

    // The header and game footer can both return to the lobby. Share their
    // request so activating both controls cannot reset the room twice.
    const handleBackToLobby = () => {
        if (lobbyRequest.current) return lobbyRequest.current;
        lobbyRequest.current = returnToLobby().finally(() => { lobbyRequest.current = null; });
        return lobbyRequest.current;
    };

    return { handleChangeGame, handleStartGame, handleBackToLobby };
}
