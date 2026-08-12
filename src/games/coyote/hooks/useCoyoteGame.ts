import { createClient } from '@/lib/supabase/client';
import { type CoyoteGameState, type CoyotePlayerState, DEFAULT_COYOTE_STATE } from '../types';
import type { RoomState } from '@/games/core/types';

export const CARDS = [
    "0","0","0",
    "1","1","1","1",
    "2","2","2","2",
    "3","3","3","3",
    "4","4","4","4",
    "5","5","5","5",
    "10","10","10",
    "15","15",
    "20",
    "-5","-5",
    "-10",
    "double",
    "max0",
    "question",
    "r0"
];

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
        const deck = [...CARDS];
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

    const calcSum = (deck: string[], coyotePlayers: { [userId: string]: CoyotePlayerState }) => {
        const aliveCards = Object.values(coyotePlayers)
            .filter(p => p.hp > 0)
            .map(p => p.currentCard);

        let karisigma = 0;
        let hasDouble = false;
        let hasquestion = false;
        let hasmax0 = false;
        let max0Value = -11;
        let questionRevealedCard: string | null = null;

        for (const card of aliveCards) {
            switch (card) {
                case "0": karisigma += 0; max0Value = Math.max(max0Value, 0); break;
                case "1": karisigma += 1; max0Value = Math.max(max0Value, 1); break;
                case "2": karisigma += 2; max0Value = Math.max(max0Value, 2); break;
                case "3": karisigma += 3; max0Value = Math.max(max0Value, 3); break;
                case "4": karisigma += 4; max0Value = Math.max(max0Value, 4); break;
                case "5": karisigma += 5; max0Value = Math.max(max0Value, 5); break;
                case "10": karisigma += 10; max0Value = Math.max(max0Value, 10); break;
                case "15": karisigma += 15; max0Value = Math.max(max0Value, 15); break;
                case "20": karisigma += 20; max0Value = Math.max(max0Value, 20); break;
                case "-5": karisigma -= 5; max0Value = Math.max(max0Value, -5); break;
                case "-10": karisigma -= 10; max0Value = Math.max(max0Value, -10); break;
                case "double": hasDouble = true; break;
                case "question": hasquestion = true; break;
                case "max0": hasmax0 = true; break;
                case "r0": max0Value = Math.max(max0Value, 0); break;
            }
        }

        if (hasquestion) {
            if (deck.length > 0) {
                const randomIndex = Math.floor(Math.random() * deck.length);
                const questionCard = deck[randomIndex];
                questionRevealedCard = questionCard;
                switch (questionCard) {
                    case "0": karisigma += 0; max0Value = Math.max(max0Value, 0); break;
                    case "1": karisigma += 1; max0Value = Math.max(max0Value, 1); break;
                    case "2": karisigma += 2; max0Value = Math.max(max0Value, 2); break;
                    case "3": karisigma += 3; max0Value = Math.max(max0Value, 3); break;
                    case "4": karisigma += 4; max0Value = Math.max(max0Value, 4); break;
                    case "5": karisigma += 5; max0Value = Math.max(max0Value, 5); break;
                    case "10": karisigma += 10; max0Value = Math.max(max0Value, 10); break;
                    case "15": karisigma += 15; max0Value = Math.max(max0Value, 15); break;
                    case "20": karisigma += 20; max0Value = Math.max(max0Value, 20); break;
                    case "-5": karisigma -= 5; max0Value = Math.max(max0Value, -5); break;
                    case "-10": karisigma -= 10; max0Value = Math.max(max0Value, -10); break;
                    case "double": hasDouble = true; break;
                    case "max0": hasmax0 = true; break;
                    case "r0": max0Value = Math.max(max0Value, 0); break;
                }
            }
        }
        if (hasmax0) {
            karisigma = karisigma - max0Value;
        }
        if (hasDouble) {
            karisigma *= 2;
        }

        return { result: karisigma, questionRevealedCard };
    };

    const handleCoyote = async (playerId: string) => {
        if (!currentGameState) return;
        const sumResult = calcSum(currentGameState.currentDeck, currentGameState.coyotePlayers);

        await updateGameState({
            phase: 'coyote_called',
            coyoteCallerId: playerId,
            coyoteTotalValue: sumResult.result,
            questionRevealedCard: sumResult.questionRevealedCard ?? null,
        });
    };

    const handleNextGame = async (loserId: string) => {
        if (!currentGameState) return;

        const currentCoyotePlayers = Object.fromEntries(
            Object.entries(currentGameState.coyotePlayers).map(([userId, state]) => [
                userId,
                { ...state }
            ])
        );

        const loserState = currentCoyotePlayers[loserId];
        if (!loserState || loserState.hp <= 0) return;

        loserState.hp = Math.max(0, loserState.hp - 1);

        const alivePlayers = Object.entries(currentCoyotePlayers).filter(([, state]) => state.hp > 0);

        if (alivePlayers.length <= 1) {
            await updateGameState({
                phase: 'result',
                coyotePlayers: currentCoyotePlayers,
                winnerId: alivePlayers[0]?.[0] ?? "",
            });
            return;
        }

        let deck = [...currentGameState.currentDeck];
        if (!deck.includes("r0") || deck.length < alivePlayers.length) {
            deck = [...CARDS];
        }

        players.forEach((player) => {
            const playerState = currentCoyotePlayers[player.userId];
            if (!playerState || playerState.hp <= 0) return;

            const randomIndex = Math.floor(Math.random() * deck.length);
            playerState.currentCard = deck[randomIndex];
            deck.splice(randomIndex, 1);
        });

        // HP減少と次ラウンド配布を1回の更新にまとめ、古いstateによる上書きを防ぐ。
        await updateGameState({
            phase: 'playing',
            coyotePlayers: currentCoyotePlayers,
            currentDeck: deck,
            coyoteCallerId: undefined,
            coyoteTotalValue: undefined,
            questionRevealedCard: undefined,
        });
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
