import { createClient } from '@/lib/supabase/client';
import { getGamePlayerCountError } from '@/games/catalog';

export function useRoomControls(roomId: string) {
    const handleChangeGame = async (gameId: string) => {
        const supabase = createClient();
        const { error } = await supabase
            .from('rooms')
            .update({ game_type: gameId })
            .eq('id', roomId);
            
        if (error) {
            console.error('ゲームの変更に失敗しました:', error);
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

    const handleBackToLobby = async () => {
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

    return { handleChangeGame, handleStartGame, handleBackToLobby };
}
