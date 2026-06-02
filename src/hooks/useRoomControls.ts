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

    return { handleChangeGame, handleStartGame };
}
