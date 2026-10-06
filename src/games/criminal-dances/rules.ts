import type {
  CriminalDancesCard,
  CriminalDancesCardType,
  CriminalDancesPending,
  CriminalDancesPlayerState,
  CriminalDancesPrivateState,
  CriminalDancesPublicState,
  CriminalDancesState,
} from './types';

export const CARD_COUNTS: Readonly<Record<CriminalDancesCardType, number>> = {
  first_discoverer: 1, culprit: 1, detective: 4, alibi: 5, conspiracy: 2,
  boy: 1, dog: 1, witness: 3, trade: 5, information_control: 3,
  rumor: 4, civilian: 2,
};

export const CARD_LABELS: Readonly<Record<CriminalDancesCardType, string>> = {
  first_discoverer: '第一発見者', culprit: '犯人', detective: '探偵', alibi: 'アリバイ',
  conspiracy: 'たくらみ', boy: '少年', dog: 'いぬ', witness: '目撃者', trade: '取り引き',
  information_control: '情報操作', rumor: 'うわさ', civilian: '一般人',
};

export const CARD_DESCRIPTIONS: Readonly<Record<CriminalDancesCardType, string>> = {
  first_discoverer: '事件を発表してゲームを始めます。', culprit: '手札がこの1枚だけなら逃げ切れます。',
  detective: '犯人を持つ人を指名します。アリバイがあれば不的中です。',
  alibi: '持っている間だけ探偵の的中を防ぎます。', conspiracy: '出した人は犯人側になります。',
  boy: '今の犯人カード所持者だけを確認します。', dog: '他人の裏向きカード1枚を調べます。',
  witness: '他人の手札を一時的に確認します。', trade: '相手と1枚ずつ同時に交換します。',
  information_control: '全員が1枚選び、左隣へ同時に渡します。',
  rumor: '全員が右隣から1枚ずつ同時に引きます。', civilian: '何も起きません。',
};

const REQUIRED: Record<number, Partial<Record<CriminalDancesCardType, number>>> = {
  3: { first_discoverer: 1, culprit: 1, detective: 1, alibi: 2 },
  4: { first_discoverer: 1, culprit: 1, detective: 1, alibi: 2, conspiracy: 1 },
  5: { first_discoverer: 1, culprit: 1, detective: 1, alibi: 2, conspiracy: 1 },
  6: { first_discoverer: 1, culprit: 1, detective: 2, alibi: 2, conspiracy: 2 },
  7: { first_discoverer: 1, culprit: 1, detective: 2, alibi: 3, conspiracy: 2 },
};

export const deckSizeForPlayers = (count: number): number => count * 4;

function assertPlayerCount(count: number): void {
  if (!Number.isInteger(count) || count < 3 || count > 8) throw new Error('犯人は踊るは3〜8人で遊べます');
}

function randomId(prefix: string, index: number): string {
  return `${prefix}-${index.toString(36).padStart(2, '0')}`;
}

export function createFullDeck(): CriminalDancesCard[] {
  return (Object.entries(CARD_COUNTS) as [CriminalDancesCardType, number][]).flatMap(([type, count]) =>
    Array.from({ length: count }, (_, index) => ({ id: `${type}-${index + 1}`, type }))
  );
}

export function buildDeck(playerCount: number, rng: () => number = Math.random): CriminalDancesCard[] {
  assertPlayerCount(playerCount);
  if (playerCount === 8) return shuffle(createFullDeck(), rng);
  const required = REQUIRED[playerCount];
  const selected: CriminalDancesCard[] = [];
  for (const card of createFullDeck()) {
    const need = required[card.type] ?? 0;
    if (selectedCount(selected, card.type) < need) selected.push(card);
  }
  const selectedIds = new Set(selected.map((card) => card.id));
  const candidates = createFullDeck().filter((card) => !selectedIds.has(card.id));
  const extras = shuffle(candidates, rng).slice(0, deckSizeForPlayers(playerCount) - selected.length);
  return shuffle([...selected, ...extras], rng);
}

function selectedCount(cards: CriminalDancesCard[], type: CriminalDancesCardType): number {
  return cards.reduce((count, card) => count + (card.type === type ? 1 : 0), 0);
}

export function shuffle<T>(values: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.max(0, Math.min(0.999999999, rng())) * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createGameState(playerIds: readonly string[], rng: () => number = Math.random, matchId = randomId('match', Date.now())): CriminalDancesState {
  assertPlayerCount(playerIds.length);
  if (new Set(playerIds).size !== playerIds.length || playerIds.some((id) => !id)) throw new Error('参加者IDが不正です');
  const deck = buildDeck(playerIds.length, rng);
  const players: Record<string, CriminalDancesPlayerState> = Object.fromEntries(playerIds.map((id) => [id, { id, hand: [], played: [], conspirator: false }]));
  playerIds.forEach((id, index) => { players[id].hand = deck.slice(index * 4, index * 4 + 4); });
  const firstDiscovererPlayerId = playerIds.find((id) => players[id].hand.some((card) => card.type === 'first_discoverer'))!;
  return {
    game: 'criminal-dances', version: 1, matchId, revision: 0, phase: 'playing', turnOrder: [...playerIds],
    currentPlayerIndex: playerIds.indexOf(firstDiscovererPlayerId), round: 1,
    firstDiscovererPlayerId, firstDiscovererPlayed: false, players, lastAction: null, lastPlayedCard: null, pending: null,
    outcome: null, processedActionIds: [], incidentText: null, revealedCardType: null,
  };
}

export function normalizeState(value: unknown): CriminalDancesState | null {
  if (!value || typeof value !== 'object' || (value as { game?: unknown }).game !== 'criminal-dances') return null;
  const source = value as Partial<CriminalDancesState>;
  if (source.version !== 1 || !Array.isArray(source.turnOrder) || !source.players || typeof source.players !== 'object') return null;
  return source as CriminalDancesState;
}

function cloneState(state: CriminalDancesState): CriminalDancesState {
  return structuredClone(state);
}



function nextTurn(state: CriminalDancesState): void {
  if (state.phase !== 'playing' || state.pending) return;
  const previousIndex = state.currentPlayerIndex;
  const firstIndex = state.turnOrder.indexOf(state.firstDiscovererPlayerId);
  for (let offset = 1; offset <= state.turnOrder.length; offset += 1) {
    const index = (previousIndex + offset) % state.turnOrder.length;
    if (state.firstDiscovererPlayed && index === firstIndex) state.round += 1;
    const player = state.players[state.turnOrder[index]];
    if (player.hand.length > 0) { state.currentPlayerIndex = index; return; }
  }
  // Every player can have an empty hand while waiting for a simultaneous effect.
  state.currentPlayerIndex = (previousIndex + 1) % state.turnOrder.length;
}

function eligibleTargets(state: CriminalDancesState, actorId: string): string[] {
  return state.turnOrder.filter((id) => id !== actorId && state.players[id].hand.length > 0);
}

function findCard(player: CriminalDancesPlayerState, cardId: string): CriminalDancesCard {
  const card = player.hand.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error('そのカードは手札にありません');
  return card;
}

function hasNonDetectiveLegalCard(state: CriminalDancesState, player: CriminalDancesPlayerState): boolean {
  return player.hand.some((card) => card.type !== 'detective' && canPlayCard(state, player.id, card.id).allowed);
}

export function canPlayCard(state: CriminalDancesState, playerId: string, cardId: string): { allowed: boolean; reason?: string } {
  if (state.phase !== 'playing') return { allowed: false, reason: 'ゲームは終了しています' };
  if (state.pending) return { allowed: false, reason: '処理中の効果を完了してください' };
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) return { allowed: false, reason: 'あなたの手番ではありません' };
  const player = state.players[playerId];
  if (!player) return { allowed: false, reason: '参加者ではありません' };
  const card = player.hand.find((candidate) => candidate.id === cardId);
  if (!card) return { allowed: false, reason: 'そのカードは手札にありません' };
  if (!state.firstDiscovererPlayed) {
    return card.type === 'first_discoverer' && playerId === state.firstDiscovererPlayerId
      ? { allowed: true } : { allowed: false, reason: '最初は第一発見者を出してください' };
  }
  if (card.type === 'culprit' && player.hand.length !== 1) return { allowed: false, reason: '犯人は最後の1枚のときだけ出せます' };
  if (card.type === 'detective' && state.round < 2 && hasNonDetectiveLegalCard(state, player)) {
    return { allowed: false, reason: '探偵は2巡目以降に使えます' };
  }
  return { allowed: true };
}

function finish(state: CriminalDancesState, reason: 'culprit_escaped' | 'detective_caught' | 'dog_caught', captorPlayerId: string | null, culpritOverride: string | null = null): void {
  const culpritPlayerId = culpritOverride ?? state.turnOrder.find((id) => state.players[id].hand.some((card) => card.type === 'culprit')) ?? null;
  const conspirators = state.turnOrder.filter((id) => state.players[id].conspirator);
  const escaped = reason === 'culprit_escaped';
  const winners = escaped
    ? Array.from(new Set([culpritPlayerId, ...conspirators].filter((id): id is string => Boolean(id))))
    : captorPlayerId && !state.players[captorPlayerId]?.conspirator ? [captorPlayerId] : [];
  state.phase = 'finished';
  state.pending = null;
  state.outcome = { reason, culpritPlayerId, captorPlayerId, winners, conspirators };
}

function afterCard(state: CriminalDancesState, actorId: string, cardType: CriminalDancesCardType, text: string): CriminalDancesState {
  state.lastAction = { actorId, cardType, text };
  nextTurn(state);
  return state;
}

export function playCard(state: CriminalDancesState, playerId: string, cardId: string, actionId?: string, incidentText?: string | null): CriminalDancesState {
  const next = cloneState(state);
  if (actionId && next.processedActionIds.includes(actionId)) return next;
  const allowed = canPlayCard(next, playerId, cardId);
  if (!allowed.allowed) throw new Error(allowed.reason);
  const player = next.players[playerId];
  const card = findCard(player, cardId);
  player.hand = player.hand.filter((candidate) => candidate.id !== cardId);
  player.played.push(card.type);
  next.lastPlayedCard = { actorId: playerId, cardType: card.type };
  if (actionId) next.processedActionIds = [...next.processedActionIds.slice(-49), actionId];
  next.revision += 1;
  if (card.type === 'first_discoverer') {
    next.firstDiscovererPlayed = true;
    next.incidentText = typeof incidentText === 'string' ? incidentText.trim().slice(0, 200) || null : null;
    return afterCard(next, playerId, card.type, '第一発見者が事件を発表しました');
  }
  if (card.type === 'culprit') {
    finish(next, 'culprit_escaped', null, playerId);
    next.lastAction = { actorId: playerId, cardType: card.type, text: '犯人が逃げ切りました' };
    return next;
  }
  if (card.type === 'conspiracy') {
    player.conspirator = true;
    return afterCard(next, playerId, card.type, 'たくらみを実行しました');
  }
  if (card.type === 'detective') {
    const targets = eligibleTargets(next, playerId);
    if (targets.length === 0 || (!hasNonDetectiveLegalCard(state, player) && next.round < 2)) return afterCard(next, playerId, card.type, '探偵は効果なしで処理されました');
    next.pending = { kind: 'detective_target', actorId: playerId, eligibleTargetIds: targets };
    next.lastAction = { actorId: playerId, cardType: card.type, text: '探偵が指名を待っています' };
    return next;
  }
  if (card.type === 'dog') {
    const targets = eligibleTargets(next, playerId);
    if (targets.length === 0) return afterCard(next, playerId, card.type, 'いぬは対象がいないため効果なしでした');
    next.pending = { kind: 'dog_target', actorId: playerId, eligibleTargetIds: targets };
    next.lastAction = { actorId: playerId, cardType: card.type, text: 'いぬの対象を待っています' };
    return next;
  }
  if (card.type === 'witness') {
    const targets = eligibleTargets(next, playerId);
    if (targets.length === 0) return afterCard(next, playerId, card.type, '目撃者は対象がいないため効果なしでした');
    next.pending = { kind: 'witness_target', actorId: playerId, eligibleTargetIds: targets };
    next.lastAction = { actorId: playerId, cardType: card.type, text: '目撃者の対象を待っています' };
    return next;
  }
  if (card.type === 'boy') {
    next.pending = { kind: 'boy_reveal', actorId: playerId, culpritPlayerId: findCulprit(next) };
    next.lastAction = { actorId: playerId, cardType: card.type, text: '少年が犯人を確認しました' };
    return next;
  }
  if (card.type === 'trade') {
    const targets = eligibleTargets(next, playerId);
    if (player.hand.length === 0 || targets.length === 0) return afterCard(next, playerId, card.type, '取り引きは条件を満たさず効果なしでした');
    next.pending = { kind: 'trade', actorId: playerId, targetId: '', eligibleTargetIds: targets, actorCardId: null, targetCardId: null };
    next.lastAction = { actorId: playerId, cardType: card.type, text: '取り引き相手を待っています' };
    return next;
  }
  if (card.type === 'information_control') {
    next.pending = { kind: 'information_control', baseHands: snapshotHands(next), choices: {} };
    next.lastAction = { actorId: playerId, cardType: card.type, text: '情報操作のカード選択を待っています' };
    return next;
  }
  if (card.type === 'rumor') {
    { const baseHands = snapshotHands(next); next.pending = { kind: 'rumor', baseHands, choices: {}, cardOrders: Object.fromEntries(next.turnOrder.map((id, index) => { const rightId = next.turnOrder[(index - 1 + next.turnOrder.length) % next.turnOrder.length]; return [id, shuffle(baseHands[rightId].map((_, cardIndex) => cardIndex))]; })) }; }
    next.lastAction = { actorId: playerId, cardType: card.type, text: 'うわさのカード選択を待っています' };
    return next;
  }
  return afterCard(next, playerId, card.type, `${CARD_LABELS[card.type]}を出しました`);
}

function findCulprit(state: CriminalDancesState): string | null {
  return state.turnOrder.find((id) => state.players[id].hand.some((card) => card.type === 'culprit')) ?? null;
}

function snapshotHands(state: CriminalDancesState): Record<string, CriminalDancesCard[]> {
  return Object.fromEntries(state.turnOrder.map((id) => [id, state.players[id].hand.map((card) => ({ ...card }))]));
}

function continueAfterPending(state: CriminalDancesState, text: string): CriminalDancesState {
  state.pending = null;
  state.lastAction = { actorId: state.turnOrder[state.currentPlayerIndex], text };
  nextTurn(state);
  return state;
}

export function selectTarget(state: CriminalDancesState, actorId: string, targetId: string): CriminalDancesState {
  const next = cloneState(state);
  const pending = next.pending;
  if (!pending || !('actorId' in pending) || pending.actorId !== actorId) throw new Error('対象を選べる状態ではありません');
  if ('eligibleTargetIds' in pending && !pending.eligibleTargetIds.includes(targetId)) throw new Error('その対象は選べません');
  if (pending.kind === 'detective_target') {
    const target = next.players[targetId];
    const hit = target.hand.some((card) => card.type === 'culprit') && !target.hand.some((card) => card.type === 'alibi');
    if (hit) finish(next, 'detective_caught', actorId);
    else continueAfterPending(next, '探偵の指名は不的中でした');
    next.revision += 1;
    return next;
  }
  if (pending.kind === 'dog_target') {
    next.pending = { kind: 'dog_card', actorId, targetId, cardCount: next.players[targetId].hand.length, cardOrder: shuffle(next.players[targetId].hand.map((_, index) => index), () => Math.random()) };
    next.lastAction = { actorId, text: 'いぬが裏向きカードを選ぶのを待っています' };
    next.revision += 1;
    return next;
  }
  if (pending.kind === 'witness_target') {
    next.pending = { kind: 'witness_reveal', actorId, targetId, cards: next.players[targetId].hand.map((card, index) => ({ id: `reveal-${next.revision}-${index}`, type: card.type })) };
    next.lastAction = { actorId, text: '目撃者が一時的に手札を確認しました' };
    next.revision += 1;
    return next;
  }
  if (pending.kind === 'trade') {
    if (pending.targetId && pending.targetId !== targetId) throw new Error('取り引き相手は変更できません');
    if (targetId === actorId || !next.players[targetId] || next.players[targetId].hand.length === 0) throw new Error('交換相手が不正です');
    next.pending = { ...pending, targetId, targetCardId: pending.targetId === targetId ? pending.targetCardId : null };
    next.revision += 1;
    return next;
  }
  throw new Error('対象選択が不正です');
}

export function confirmPrivateReveal(state: CriminalDancesState, actorId: string): CriminalDancesState {
  const next = cloneState(state);
  const pending = next.pending;
  if (!pending || !('actorId' in pending) || pending.actorId !== actorId || (pending.kind !== 'boy_reveal' && pending.kind !== 'witness_reveal')) throw new Error('確認できる情報がありません');
  next.revision += 1;
  return continueAfterPending(next, '秘密の確認を終えました');
}

export function chooseDogCard(state: CriminalDancesState, actorId: string, cardIndex: number): CriminalDancesState {
  const next = cloneState(state);
  const pending = next.pending;
  if (!pending || pending.kind !== 'dog_card' || pending.actorId !== actorId) throw new Error('いぬのカード選択ではありません');
  const target = next.players[pending.targetId];
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= target.hand.length) throw new Error('カードの選択が不正です');
  const sourceIndex = pending.cardOrder[cardIndex];
  if (sourceIndex === undefined) throw new Error('カードの選択が不正です');
  const card = target.hand[sourceIndex];
  next.revealedCardType = card.type;
  if (card.type === 'culprit') finish(next, 'dog_caught', actorId);
  else continueAfterPending(next, 'いぬがカードを公開しました');
  next.revision += 1;
  return next;
}

export function submitTradeCard(state: CriminalDancesState, actorId: string, cardId: string): CriminalDancesState {
  const next = cloneState(state);
  const pending = next.pending;
  if (!pending || pending.kind !== 'trade' || !pending.targetId) throw new Error('取り引きの選択ではありません');
  if (actorId !== pending.actorId && actorId !== pending.targetId) throw new Error('取り引きの参加者ではありません');
  findCard(next.players[actorId], cardId);
  if (actorId === pending.actorId) {
    if (pending.actorCardId) throw new Error('取り引きのカードは選択済みです');
    next.pending = { ...pending, actorCardId: cardId };
  } else {
    if (pending.targetCardId) throw new Error('取り引きのカードは選択済みです');
    next.pending = { ...pending, targetCardId: cardId };
  }
  const updated = next.pending;
  if (updated.kind === 'trade' && updated.actorCardId && updated.targetCardId) {
    const actor = next.players[updated.actorId];
    const target = next.players[updated.targetId];
    actor.hand = actor.hand.filter((card) => card.id !== updated.actorCardId);
    target.hand = target.hand.filter((card) => card.id !== updated.targetCardId);
    const targetCard = state.players[updated.targetId].hand.find((card) => card.id === updated.targetCardId)!;
    const actorCard = state.players[updated.actorId].hand.find((card) => card.id === updated.actorCardId)!;
    actor.hand.push(targetCard);
    target.hand.push(actorCard);
    next.pending = null;
    next.lastAction = { actorId: updated.actorId, cardType: 'trade', text: '取り引きを同時に交換しました' };
    next.revision += 1;
    nextTurn(next);
  } else next.revision += 1;
  return next;
}

function requiredSimultaneousPlayers(state: CriminalDancesState, pending: Extract<CriminalDancesPending, { kind: 'information_control' | 'rumor' }>): string[] {
  if (pending.kind === 'information_control') return state.turnOrder.filter((id) => pending.baseHands[id]?.length > 0);
  return state.turnOrder.filter((id, index) => pending.baseHands[state.turnOrder[(index - 1 + state.turnOrder.length) % state.turnOrder.length]]?.length > 0);
}

export function submitSimultaneousChoice(state: CriminalDancesState, actorId: string, cardId: string | number): CriminalDancesState {
  const next = cloneState(state);
  const pending = next.pending;
  if (!pending || (pending.kind !== 'information_control' && pending.kind !== 'rumor')) throw new Error('同時選択の受付中ではありません');
  const required = requiredSimultaneousPlayers(next, pending);
  if (!required.includes(actorId)) throw new Error('この参加者はカードを渡しません');
  if (pending.choices[actorId]) throw new Error('選択済みです');
  if (pending.kind === 'information_control') {
    if (!pending.baseHands[actorId]?.some((card) => card.id === cardId)) throw new Error('自分の手札から選んでください');
  } else {
    const index = next.turnOrder.indexOf(actorId);
    const rightId = next.turnOrder[(index - 1 + next.turnOrder.length) % next.turnOrder.length];
    const order = pending.cardOrders[actorId] ?? [];
    if (typeof cardId !== 'number' || !Number.isInteger(cardId) || cardId < 0) throw new Error('裏向きカードの位置を選んでください');
    const sourceIndex = order[cardId];
    if (sourceIndex === undefined || sourceIndex < 0 || !pending.baseHands[rightId]?.[sourceIndex]) throw new Error('右隣の手札から選んでください');
    pending.choices[actorId] = pending.baseHands[rightId][sourceIndex].id;
  }
  if (pending.kind === 'information_control') pending.choices[actorId] = cardId as string;
  if (required.every((id) => pending.choices[id])) {
    if (pending.kind === 'information_control') {
      for (const id of required) {
        const card = pending.baseHands[id].find((candidate) => candidate.id === pending.choices[id])!;
        next.players[id].hand = next.players[id].hand.filter((candidate) => candidate.id !== card.id);
      }
      for (const id of required) {
        const leftId = next.turnOrder[(next.turnOrder.indexOf(id) + 1) % next.turnOrder.length];
        const card = pending.baseHands[id].find((candidate) => candidate.id === pending.choices[id])!;
        next.players[leftId].hand.push(card);
      }
      next.lastAction = { actorId: next.turnOrder[next.currentPlayerIndex], cardType: 'information_control', text: '情報操作を同時に解決しました' };
    } else {
      for (const id of required) {
        const rightId = next.turnOrder[(next.turnOrder.indexOf(id) - 1 + next.turnOrder.length) % next.turnOrder.length];
        const card = pending.baseHands[rightId].find((candidate) => candidate.id === pending.choices[id])!;
        next.players[rightId].hand = next.players[rightId].hand.filter((candidate) => candidate.id !== card.id);
        next.players[id].hand.push(card);
      }
      next.lastAction = { actorId: next.turnOrder[next.currentPlayerIndex], cardType: 'rumor', text: 'うわさを同時に解決しました' };
    }
    next.pending = null;
    next.revision += 1;
    nextTurn(next);
  } else next.revision += 1;
  return next;
}

function publicPending(state: CriminalDancesState): CriminalDancesPublicState['pending'] {
  const pending = state.pending;
  if (!pending) return null;
  if (pending.kind === 'information_control' || pending.kind === 'rumor') {
    return { kind: pending.kind, submittedPlayerIds: Object.keys(pending.choices) };
  }
  if (pending.kind === 'witness_reveal' || pending.kind === 'boy_reveal') return { kind: pending.kind, actorId: pending.actorId };
  if (pending.kind === 'trade') return { kind: pending.kind, actorId: pending.actorId, targetId: pending.targetId, eligibleTargetIds: pending.targetId ? [] : pending.eligibleTargetIds, submittedPlayerIds: [pending.actorCardId ? pending.actorId : '', pending.targetCardId ? pending.targetId : ''].filter(Boolean) };
  if (pending.kind === 'dog_card') return { kind: pending.kind, actorId: pending.actorId, targetId: pending.targetId, cardCount: pending.cardCount };
  return { kind: pending.kind, actorId: pending.actorId, eligibleTargetIds: pending.eligibleTargetIds };
}

export function toPublicState(state: CriminalDancesState): CriminalDancesPublicState {
  const lastPlayedCard = state.lastPlayedCard ?? (state.lastAction?.cardType ? { actorId: state.lastAction.actorId, cardType: state.lastAction.cardType } : null);
  return {
    game: state.game, version: 1, matchId: state.matchId, revision: state.revision, phase: state.phase,
    turnOrder: [...state.turnOrder], currentPlayerIndex: state.currentPlayerIndex, round: state.round,
    firstDiscovererPlayerId: state.firstDiscovererPlayerId, firstDiscovererPlayed: state.firstDiscovererPlayed,
    players: Object.fromEntries(state.turnOrder.map((id) => [id, { id, handCount: state.players[id].hand.length, played: [...state.players[id].played], conspirator: state.players[id].conspirator }])),
    lastAction: state.lastAction ? { ...state.lastAction } : null, lastPlayedCard, pending: publicPending(state), outcome: state.outcome ? structuredClone(state.outcome) : null,
    incidentText: state.incidentText, revealedCardType: state.revealedCardType,
  };
}

export function toPrivateState(state: CriminalDancesState, viewerId: string): CriminalDancesPrivateState {
  if (!state.players[viewerId]) throw new Error('参加者ではありません');
  const publicState = toPublicState(state);
  const pending = state.pending;
  let privateReveal: CriminalDancesPrivateState['privateReveal'] = null;
  if (pending?.kind === 'boy_reveal' && pending.actorId === viewerId) privateReveal = { kind: 'boy', culpritPlayerId: pending.culpritPlayerId };
  if (pending?.kind === 'witness_reveal' && pending.actorId === viewerId) privateReveal = { kind: 'witness', targetId: pending.targetId, cards: pending.cards.map((card) => ({ ...card })) };
  return { ...publicState, myPlayerId: viewerId, myHand: state.players[viewerId].hand.map((card) => ({ ...card })), privateReveal };
}

export function validateRosterFrozen(before: CriminalDancesState, after: CriminalDancesState): boolean {
  return before.turnOrder.length === after.turnOrder.length && before.turnOrder.every((id, index) => id === after.turnOrder[index]);
}
