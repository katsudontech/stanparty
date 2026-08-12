import type { CoyoteGameState, CoyotePlayerState } from './types';

export const COYOTE_CARDS = [
  '0', '0', '0',
  '1', '1', '1', '1',
  '2', '2', '2', '2',
  '3', '3', '3', '3',
  '4', '4', '4', '4',
  '5', '5', '5', '5',
  '10', '10', '10',
  '15', '15',
  '20',
  '-5', '-5',
  '-10',
  'double',
  'max0',
  'question',
  'r0'
] as const;

type RandomSource = () => number;

interface TotalAccumulator {
  total: number;
  maximumNumber: number | null;
  hasDouble: boolean;
  hasMax0: boolean;
}

function randomIndex(length: number, random: RandomSource): number {
  if (length <= 1) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

function applyCard(card: string, accumulator: TotalAccumulator): void {
  if (card === 'double') {
    accumulator.hasDouble = true;
    return;
  }

  if (card === 'max0') {
    accumulator.hasMax0 = true;
    return;
  }

  if (card === 'question') return;

  const value = card === 'r0' ? 0 : Number(card);
  if (!Number.isFinite(value)) return;

  accumulator.total += value;
  accumulator.maximumNumber =
    accumulator.maximumNumber === null
      ? value
      : Math.max(accumulator.maximumNumber, value);
}

export function calculateCoyoteTotal(
  deck: string[],
  coyotePlayers: Record<string, CoyotePlayerState>,
  random: RandomSource = Math.random
): { result: number; questionRevealedCard: string | null } {
  const aliveCards = Object.values(coyotePlayers)
    .filter((player) => player.hp > 0)
    .map((player) => player.currentCard);

  const accumulator: TotalAccumulator = {
    total: 0,
    maximumNumber: null,
    hasDouble: false,
    hasMax0: false
  };

  aliveCards.forEach((card) => applyCard(card, accumulator));

  let questionRevealedCard: string | null = null;
  if (aliveCards.includes('question') && deck.length > 0) {
    questionRevealedCard = deck[randomIndex(deck.length, random)];
    applyCard(questionRevealedCard, accumulator);
  }

  if (accumulator.hasMax0 && accumulator.maximumNumber !== null) {
    accumulator.total -= accumulator.maximumNumber;
  }

  if (accumulator.hasDouble) {
    accumulator.total *= 2;
  }

  return {
    result: accumulator.total,
    questionRevealedCard
  };
}

export type CoyoteRoundResolution =
  | {
      phase: 'result';
      coyotePlayers: Record<string, CoyotePlayerState>;
      winnerId: string;
    }
  | {
      phase: 'playing';
      coyotePlayers: Record<string, CoyotePlayerState>;
      currentDeck: string[];
      coyoteCallerId: undefined;
      coyoteTotalValue: undefined;
      questionRevealedCard: undefined;
    };

interface ResolveCoyoteRoundInput {
  loserId: string;
  coyotePlayers: Record<string, CoyotePlayerState>;
  currentDeck: string[];
  playerIds: string[];
  random?: RandomSource;
}

export function resolveCoyoteRound({
  loserId,
  coyotePlayers,
  currentDeck,
  playerIds,
  random = Math.random
}: ResolveCoyoteRoundInput): CoyoteRoundResolution | null {
  const nextPlayers = Object.fromEntries(
    Object.entries(coyotePlayers).map(([userId, state]) => [
      userId,
      { ...state }
    ])
  );

  const loserState = nextPlayers[loserId];
  if (!loserState || loserState.hp <= 0) return null;

  loserState.hp = Math.max(0, loserState.hp - 1);

  const alivePlayerIds = playerIds.filter(
    (userId) => (nextPlayers[userId]?.hp ?? 0) > 0
  );

  if (alivePlayerIds.length <= 1) {
    return {
      phase: 'result',
      coyotePlayers: nextPlayers,
      winnerId: alivePlayerIds[0] ?? ''
    };
  }

  let deck = [...currentDeck];
  if (!deck.includes('r0') || deck.length < alivePlayerIds.length) {
    deck = [...COYOTE_CARDS];
  }

  alivePlayerIds.forEach((userId) => {
    if (deck.length === 0) deck = [...COYOTE_CARDS];

    const cardIndex = randomIndex(deck.length, random);
    nextPlayers[userId].currentCard = deck[cardIndex];
    deck.splice(cardIndex, 1);
  });

  return {
    phase: 'playing',
    coyotePlayers: nextPlayers,
    currentDeck: deck,
    coyoteCallerId: undefined,
    coyoteTotalValue: undefined,
    questionRevealedCard: undefined
  };
}

export type CoyoteStateUpdate = Partial<CoyoteGameState>;
