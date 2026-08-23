'use client';

import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';

import {
  dealItoCards,
  drawRandomTheme,
  getMaxCardsPerPlayer,
  isItoOrderCorrect,
  isValidItoPlayerCount,
} from '../rules';
import { ITO_THEMES } from '../themes';
import {
  createDefaultItoState,
  isItoGameState,
  type ItoGameState,
} from '../types';

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return new Error(String(value.message));
  }
  return new Error(fallbackMessage);
}

export function normalizeItoGameState(value: unknown): ItoGameState {
  const fallback = createDefaultItoState();
  if (!isItoGameState(value)) return fallback;

  return {
    ...fallback,
    ...value,
    ruleSettings: {
      ...fallback.ruleSettings,
      ...value.ruleSettings,
    },
    roundPlayerIds: Array.isArray(value.roundPlayerIds) ? value.roundPlayerIds : [],
    cards: Array.isArray(value.cards) ? value.cards : [],
    cardOrder: Array.isArray(value.cardOrder) ? value.cardOrder : [],
    readyPlayerIds: Array.isArray(value.readyPlayerIds) ? value.readyPlayerIds : [],
  };
}

export function useItoGame(roomState: RoomState) {
  const supabase = createClient();
  const gameState = normalizeItoGameState(roomState.game_state);

  const replaceGameState = async (nextState: ItoGameState) => {
    const { error } = await supabase
      .from('rooms')
      .update({ game_state: nextState })
      .eq('id', roomState.id);

    if (error) throw toError(error, 'itoのゲーム状態を更新できませんでした');
  };

  const handleSaveRules = async (cardsPerPlayer: number) => {
    const playerCount = roomState.players.length;
    const maxCardsPerPlayer = getMaxCardsPerPlayer(playerCount);

    if (!isValidItoPlayerCount(playerCount)) {
      throw new Error('itoは2〜14人で遊べます');
    }
    if (
      !Number.isInteger(cardsPerPlayer)
      || cardsPerPlayer < 1
      || cardsPerPlayer > maxCardsPerPlayer
    ) {
      throw new Error(`カード枚数は1〜${maxCardsPerPlayer}枚で指定してください`);
    }

    await replaceGameState({
      ...createDefaultItoState(),
      phase: 'theme_selection',
      ruleSettings: { cardsPerPlayer },
      themeCandidate: drawRandomTheme(ITO_THEMES, null),
    });
  };

  const handleDrawTheme = async () => {
    await replaceGameState({
      ...gameState,
      themeCandidate: drawRandomTheme(ITO_THEMES, gameState.themeCandidate),
    });
  };

  const handleSelectTheme = async (theme: string) => {
    const normalizedTheme = theme.trim();
    if (!normalizedTheme) throw new Error('お題を入力してください');
    if (normalizedTheme.length > 100) throw new Error('お題は100文字以内で入力してください');

    const playerIds = roomState.players.map((player) => player.userId);
    const cards = dealItoCards(playerIds, gameState.ruleSettings.cardsPerPlayer);

    await replaceGameState({
      ...gameState,
      phase: 'arranging',
      selectedTheme: normalizedTheme,
      roundPlayerIds: playerIds,
      cards,
      cardOrder: [],
      readyPlayerIds: [],
      revealedCardCount: 0,
      result: null,
    });
  };

  const handleSetHint = async (cardId: string, hint: string) => {
    const { error } = await supabase.rpc('ito_set_card_hint', {
      p_room_id: roomState.id,
      p_card_id: cardId,
      p_hint: hint,
    });
    if (error) throw toError(error, 'たとえを保存できませんでした');
  };

  const handleMoveCard = async (cardId: string, targetIndex: number) => {
    const { error } = await supabase.rpc('ito_move_card', {
      p_room_id: roomState.id,
      p_card_id: cardId,
      p_target_index: targetIndex,
    });
    if (error) throw toError(error, 'カードを移動できませんでした');
  };

  const handleSetReady = async (isReady: boolean) => {
    const { error } = await supabase.rpc('ito_set_ready', {
      p_room_id: roomState.id,
      p_is_ready: isReady,
    });
    if (error) throw toError(error, '完成確認を更新できませんでした');
  };

  const handleStartShowdown = async () => {
    const allCardsPlaced = gameState.cardOrder.length === gameState.cards.length;
    const allPlayersReady = gameState.roundPlayerIds.every((playerId) =>
      gameState.readyPlayerIds.includes(playerId),
    );

    if (!allCardsPlaced || !allPlayersReady) {
      throw new Error('全員が完成を確認してからショーダウンしてください');
    }

    await replaceGameState({
      ...gameState,
      phase: 'showdown',
      revealedCardCount: 0,
      result: null,
    });
  };

  const handleRevealNextCard = async () => {
    if (gameState.phase !== 'showdown') return;

    const nextRevealedCount = Math.min(
      gameState.revealedCardCount + 1,
      gameState.cardOrder.length,
    );
    const isLastCard = nextRevealedCount === gameState.cardOrder.length;

    await replaceGameState({
      ...gameState,
      phase: isLastCard ? 'result' : 'showdown',
      revealedCardCount: nextRevealedCount,
      result: isLastCard
        ? (isItoOrderCorrect(gameState.cards, gameState.cardOrder) ? 'success' : 'failure')
        : null,
    });
  };

  const handleResetGame = async () => {
    await replaceGameState(createDefaultItoState());
  };

  const handleBackToLobby = async () => {
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'waiting', game_state: {} })
      .eq('id', roomState.id);

    if (error) throw toError(error, 'ロビーに戻れませんでした');
  };

  return {
    gameState,
    handleSaveRules,
    handleDrawTheme,
    handleSelectTheme,
    handleSetHint,
    handleMoveCard,
    handleSetReady,
    handleStartShowdown,
    handleRevealNextCard,
    handleResetGame,
    handleBackToLobby,
  };
}
