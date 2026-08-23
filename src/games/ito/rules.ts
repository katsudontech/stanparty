import type { ItoCard } from './types';

export const MIN_ITO_PLAYERS = 2;
export const MAX_ITO_PLAYERS = 14;
export const ITO_CARD_MIN = 1;
export const ITO_CARD_MAX = 100;

export function isValidItoPlayerCount(playerCount: number): boolean {
  return playerCount >= MIN_ITO_PLAYERS && playerCount <= MAX_ITO_PLAYERS;
}

export function getMaxCardsPerPlayer(playerCount: number): number {
  if (playerCount <= 0) return 0;
  return Math.floor(ITO_CARD_MAX / playerCount);
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = Math.max(0, Math.min(random(), 0.9999999999999999));
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function dealItoCards(
  playerIds: string[],
  cardsPerPlayer: number,
  random: () => number = Math.random,
): ItoCard[] {
  if (!isValidItoPlayerCount(playerIds.length)) {
    throw new Error(`${MIN_ITO_PLAYERS}〜${MAX_ITO_PLAYERS}人で遊んでください`);
  }

  const maxCardsPerPlayer = getMaxCardsPerPlayer(playerIds.length);
  if (!Number.isInteger(cardsPerPlayer) || cardsPerPlayer < 1 || cardsPerPlayer > maxCardsPerPlayer) {
    throw new Error(`カード枚数は1〜${maxCardsPerPlayer}枚で指定してください`);
  }

  const deck = shuffle(
    Array.from(
      { length: ITO_CARD_MAX - ITO_CARD_MIN + 1 },
      (_, index) => index + ITO_CARD_MIN,
    ),
    random,
  );

  let deckIndex = 0;
  return playerIds.flatMap((ownerId) =>
    Array.from({ length: cardsPerPlayer }, (_, index) => ({
      id: `${ownerId}:${index + 1}`,
      ownerId,
      ownerCardNumber: index + 1,
      value: deck[deckIndex++],
      hint: '',
    })),
  );
}

export function moveCardInOrder(
  currentOrder: string[],
  cardId: string,
  targetIndex: number,
): string[] {
  const orderWithoutCard = currentOrder.filter((orderedCardId) => orderedCardId !== cardId);
  const normalizedIndex = Math.max(0, Math.min(Math.trunc(targetIndex), orderWithoutCard.length));

  return [
    ...orderWithoutCard.slice(0, normalizedIndex),
    cardId,
    ...orderWithoutCard.slice(normalizedIndex),
  ];
}

export function getOrderedItoCards(cards: ItoCard[], cardOrder: string[]): ItoCard[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  return cardOrder.flatMap((cardId) => {
    const card = cardsById.get(cardId);
    return card ? [card] : [];
  });
}

export function isItoOrderCorrect(cards: ItoCard[], cardOrder: string[]): boolean {
  if (cards.length === 0 || cardOrder.length !== cards.length) return false;

  const orderedCards = getOrderedItoCards(cards, cardOrder);
  if (orderedCards.length !== cards.length) return false;

  return orderedCards.every(
    (card, index) => index === 0 || orderedCards[index - 1].value < card.value,
  );
}

export function getIncorrectItoCardIds(cards: ItoCard[], cardOrder: string[]): string[] {
  const orderedCards = getOrderedItoCards(cards, cardOrder);
  const incorrectIds = new Set<string>();

  for (let index = 1; index < orderedCards.length; index += 1) {
    if (orderedCards[index - 1].value > orderedCards[index].value) {
      incorrectIds.add(orderedCards[index - 1].id);
      incorrectIds.add(orderedCards[index].id);
    }
  }

  return [...incorrectIds];
}

export function drawRandomTheme(
  themes: readonly string[],
  currentTheme: string | null,
  random: () => number = Math.random,
): string {
  if (themes.length === 0) throw new Error('お題が登録されていません');

  const candidates = themes.filter((theme) => theme !== currentTheme);
  const source = candidates.length > 0 ? candidates : themes;
  const randomValue = Math.max(0, Math.min(random(), 0.9999999999999999));
  return source[Math.floor(randomValue * source.length)];
}
