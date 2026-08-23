import { createClient } from '@/lib/supabase/client';

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
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'playing' })
            .eq('id', roomId);

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
