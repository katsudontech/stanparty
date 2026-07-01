import { createClient } from '@/lib/supabase/client';
import { type CoyoteGameState, type CoyotePlayerState, type CoyotePhase, DEFAULT_COYOTE_STATE } from '../types';
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

    const continueGame = async () => {
        if (!currentGameState) return;
        let deck = [...currentGameState.currentDeck];
        const currentCoyotePlayers = { ...currentGameState.coyotePlayers };

        // deckが空、または r0 がない場合はリシャッフル
        if (!deck.includes("r0") || deck.length < players.length) {
            deck = [...CARDS];
        }

        // 生存者のみにカードを配布
        players.forEach(p => {
            const playerState = currentCoyotePlayers[p.userId];
            if (playerState && playerState.hp > 0) {
                const randomIndex = Math.floor(Math.random() * deck.length);
                const card = deck[randomIndex];
                deck.splice(randomIndex, 1);
                currentCoyotePlayers[p.userId] = {
                    ...playerState,
                    currentCard: card
                };
            }
        });

        await updateGameState({
            phase: 'playing',
            coyotePlayers: currentCoyotePlayers,
            currentDeck: deck,
            coyoteCallerId: undefined,
            coyoteTotalValue: undefined,
            questionRevealedCard: undefined,
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
        const currentCoyotePlayers = { ...currentGameState.coyotePlayers };

        // 敗者のHPを1減らす
        if (currentCoyotePlayers[loserId]) {
            currentCoyotePlayers[loserId].hp = Math.max(0, currentCoyotePlayers[loserId].hp - 1);
        }

        const alivePlayers = Object.entries(currentCoyotePlayers).filter(([_, state]) => state.hp > 0);

        if (alivePlayers.length <= 1) {
            const winnerId = alivePlayers[0]?.[0] ?? "";
            await updateGameState({
                phase: 'result',
                coyotePlayers: currentCoyotePlayers,
                winnerId: winnerId,
            });
            // 部屋の状態自体はポータルへ戻るボタン等で制御
        } else {
            // HPを更新して次へ進む
            await updateGameState({ coyotePlayers: currentCoyotePlayers });
            await continueGame();
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
