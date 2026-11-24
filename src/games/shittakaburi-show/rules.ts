export type Phase = 'words' | 'discussion' | 'voting' | 'votes' | 'scores' | 'finished';
export type State = {
  game: 'shittakaburi-show'; matchId: string; revision: number; phase: Phase;
  turnOrder: string[]; round: number; speakingOrder: string[]; word: string;
  ready: string[]; voted: string[]; scores: Record<string, number>;
  submissions: Record<string, string>; usedOwners: string[]; ownerId: string | null;
  votes: Record<string, string>; roundPoints: Record<string, number> | null; processedActionIds: string[];
};
export type PublicState = Pick<State, 'game' | 'matchId' | 'revision' | 'phase' | 'turnOrder' | 'round' | 'speakingOrder' | 'word' | 'ready' | 'voted'> & {
  scores: Record<string, number> | null; votes: Record<string, string> | null; counts: Record<string, number> | null;
  authorId: string | null; roundPoints: Record<string, number> | null;
};
export type PrivateState = PublicState & { myWord: string | null; isAuthor: boolean | null; myVote: string | null };
export function createGameState(ids: string[], _random = Math.random, matchId: string = crypto.randomUUID()): State {
  void _random;
  if (ids.length < 3 || ids.length > 14 || new Set(ids).size !== ids.length) throw new Error('知ったかぶりショーは3〜14人で遊べます');
  return { game: 'shittakaburi-show', matchId, revision: 0, phase: 'words', turnOrder: ids, round: 0, speakingOrder: [], word: '', ready: [], voted: [], scores: Object.fromEntries(ids.map(id => [id, 0])), submissions: {}, usedOwners: [], ownerId: null, votes: {}, roundPoints: null, processedActionIds: [] };
}
function counts(state: State) { return Object.fromEntries(state.turnOrder.map(id => [id, Object.values(state.votes).filter(target => target === id).length])); }
export function toPublicState(state: State): PublicState {
  const votesVisible = ['votes','scores','finished'].includes(state.phase);
  const authorVisible = ['scores','finished'].includes(state.phase);
  return structuredClone({ game: state.game, matchId: state.matchId, revision: state.revision, phase: state.phase, turnOrder: state.turnOrder, round: state.round, speakingOrder: state.speakingOrder, word: state.word, ready: state.ready, voted: state.voted, scores: ['scores','finished'].includes(state.phase) ? state.scores : null, votes: votesVisible ? state.votes : null, counts: votesVisible ? counts(state) : null, authorId: authorVisible ? state.ownerId : null, roundPoints: ['scores','finished'].includes(state.phase) ? state.roundPoints : null });
}
export function toPrivateState(state: State, id: string): PrivateState {
  if (!state.turnOrder.includes(id)) throw new Error('Room membership is required');
  return { ...toPublicState(state), myWord: state.phase === 'words' ? state.submissions[id] ?? null : null, isAuthor: ['discussion','voting'].includes(state.phase) ? state.ownerId === id : null, myVote: state.phase === 'voting' ? state.votes[id] ?? null : null };
}
function nextRound(state: State, random: () => number) {
  const pool = state.turnOrder.filter(id => !state.usedOwners.includes(id));
  const owner = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  state.ownerId = owner; state.word = state.submissions[owner]; state.usedOwners.push(owner);
  state.speakingOrder = [...state.turnOrder];
  for (let i = state.speakingOrder.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [state.speakingOrder[i], state.speakingOrder[j]] = [state.speakingOrder[j], state.speakingOrder[i]]; }
  state.round++; state.votes = {}; state.voted = []; state.roundPoints = null; state.phase = 'discussion';
}
export function applyAction(state: State, actor: string, host: string, action: string, value: unknown, id: string, random = Math.random): State {
  if (!state.turnOrder.includes(actor)) throw new Error('Room membership is required');
  if (state.processedActionIds.includes(id)) return state;
  const next = structuredClone(state);
  if (action === 'word') {
    if (state.phase !== 'words' || state.ready.includes(actor)) throw new Error('言葉はすでに登録済みか、登録期間が終了しています');
    if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 80 || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error('言葉を1〜80文字で入力してください');
    next.submissions[actor] = value.trim(); next.ready.push(actor);
    if (next.ready.length === next.turnOrder.length) nextRound(next, random);
  } else if (action === 'vote') {
    if (state.phase !== 'voting' || state.voted.includes(actor)) throw new Error('投票はすでに確定済みか、投票期間が終了しています');
    if (typeof value !== 'string' || value === actor || !state.turnOrder.includes(value)) throw new Error('自分以外のプレイヤーを選んでください');
    next.votes[actor] = value; next.voted.push(actor);
    if (next.voted.length === next.turnOrder.length) next.phase = 'votes';
  } else {
    if (actor !== host) throw new Error('この操作はホストのみ実行できます');
    if (action === 'start-vote' && state.phase === 'discussion') next.phase = 'voting';
    else if (action === 'reveal-author' && state.phase === 'votes') {
      const received = counts(state);
      next.roundPoints = Object.fromEntries(state.turnOrder.map(player => [player, player === state.ownerId ? received[player] : received[player] * 2 + (state.votes[player] === state.ownerId ? 1 : 0)]));
      for (const player of state.turnOrder) next.scores[player] += next.roundPoints[player];
      next.phase = state.usedOwners.length === state.turnOrder.length ? 'finished' : 'scores';
    } else if (action === 'next' && state.phase === 'scores') {
      if (state.usedOwners.length === state.turnOrder.length) next.phase = 'finished'; else nextRound(next, random);
    } else if (action === 'end' && state.phase === 'scores') next.phase = 'finished';
    else throw new Error('現在の画面では実行できません');
  }
  next.revision++; next.processedActionIds.push(id); return next;
}
export function rankings(scores: Record<string, number>) {
  return Object.entries(scores).sort((a,b) => b[1] - a[1]).map(([id, score], _index, sorted) => ({ id, score, rank: sorted.findIndex(entry => entry[1] === score) + 1 }));
}
