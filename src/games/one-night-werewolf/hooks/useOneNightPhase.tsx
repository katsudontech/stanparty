import { createClient } from "@/lib/supabase/client";
import { type OneNightGameState, DEFAULT_ONE_NIGHT_STATE, type OneNightRuleSettings } from "../types";
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
        void rules;
    };

    return {
        updateGameState,
        handleSaveRule
    };
}