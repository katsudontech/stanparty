import { createClient } from "@/lib/supabase/client";
import { type OneNightGameState, type OneNightPhase, type OneNightPlayerState, DEFAULT_ONE_NIGHT_STATE, type OneNightRuleSettings } from "../types";
import { type RoomState } from "@/games/core/types";

export function useOneNightGame(roomState: RoomState) {
    const supabase = createClient();
    const roomId = roomState.id;
    const currentGameState = roomState.game_state as OneNightGameState | null;

    const updateGameState = async (newStatePartial: Partial<OneNightGameState>) => {
        const baseState = currentGameState || DEFAULT_ONE_NIGHT_STATE;
        const updatedState = { ...baseState, ...newStatePartial };

        const { error } = await supabase
            .from('rooms')
            .update({ game_state: updatedState })
            .eq('id', roomId);

        if (error) {
            console.error('ゲーム状態の更新に失敗しました:', error);
        }
    };

    const handleSaveRule = async (rules: OneNightRuleSettings) => {
        const newPlayerStates: Record<string, OneNightPlayerState> = {};
        let roles =
            roomState.players.forEach(player => {
                // プレイヤーごとに初期ロールと現在のロールを定義する
                newPlayerStates[player.userId] = {
                    initialRole: 'villager',
                    currentRole: 'villager'
                };
            });
    };

    return {
        updateGameState,
        handleSaveRule
    };
}