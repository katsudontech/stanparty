import { createClient } from '@/lib/supabase/client';
import { type CoyoteGameState, type CoyotePlayerState, DEFAULT_COYOTE_STATE } from '../types';
import type { RoomState } from '@/games/core/types';
import {
    COYOTE_CARDS,
    calculateCoyoteTotal,
    resolveCoyoteRound
} from '../rules';

export function useCoyoteGame(roomState: RoomState) {
    const supabase = createClient();
    const roomId = roomState.id;
    const players = roomState.players;
    const currentGameState = roomState.game_state as CoyoteGameState | null;

    const updateGameState = async (newStatePartial: Partial<CoyoteGameState>) => {
        const baseState = currentGameState || DEFAULT_COYOTE_STATE;
        const updatedState = { ...baseState, ...newStatePartial };

        const { error } = await supabase
            .from('rooms')
            .update({ game_state: updatedState })
            .eq('id', roomId);

        if (error) {
            console.error('ゲーム状態の更新に失敗しました:', error);
        }
    };

    const startGame = async (maxHp: number) => {
        const deck = [...COYOTE_CARDS];
        const newCoyotePlayers: { [userId: string]: CoyotePlayerState } = {};

        // プレイヤーごとにHPとカードを初期化
        players.forEach(p => {
            const randomIndex = Math.floor(Math.random() * deck.length);
            const card = deck[randomIndex];
            deck.splice(randomIndex, 1);
            newCoyotePlayers[p.userId] = {
                hp: maxHp,
                currentCard: card
            };
        });

        await updateGameState({
            phase: 'playing',
            ruleSettings: { maxHp },
            coyotePlayers: newCoyotePlayers,
            currentDeck: deck,
            coyoteCallerId: undefined,
            coyoteTotalValue: undefined,
            questionRevealedCard: undefined,
            winnerId: undefined,
        });
    };

    const handleCoyote = async (playerId: string) => {
        if (!currentGameState) return;
        const sumResult = calculateCoyoteTotal(currentGameState.currentDeck, currentGameState.coyotePlayers);

        await updateGameState({
            phase: 'coyote_called',
            coyoteCallerId: playerId,
            coyoteTotalValue: sumResult.result,
            questionRevealedCard: sumResult.questionRevealedCard ?? null,
        });
    };

    const handleNextGame = async (loserId: string) => {
        if (!currentGameState) return;

        const resolution = resolveCoyoteRound({
            loserId,
            coyotePlayers: currentGameState.coyotePlayers,
            currentDeck: currentGameState.currentDeck,
            playerIds: players.map((player) => player.userId)
        });

        if (resolution) {
            await updateGameState(resolution);
        }
    };

    const backToLobby = async () => {
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'waiting', game_state: {} })
            .eq('id', roomId);
            
        if (error) console.error('ロビーへの復帰に失敗しました:', error);
    };

    return {
        updateGameState,
        startGame,
        handleCoyote,
        handleNextGame,
        backToLobby
    };
}
