export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

export type DiscKind = 'flower' | 'skull';
type Disc = { id: string; kind: DiscKind };
type Seat = { id: string; discs: Disc[]; stack: Disc[]; successes: number };
type Bid = { playerId: string; count: number };
type Reveal = { playerId: string; position: number; kind: DiscKind };
type RoundResult =
  | { kind: 'success' }
  | { kind: 'failure'; skullOwnerId: string };
type Winner = { playerId: string; reason: 'two-successes' | 'last-standing' };

export type Phase = 'opening' | 'placing' | 'bidding' | 'challenge' | 'loss-choice' | 'starter-choice' | 'result' | 'finished';

export const ACTIONS = ['place', 'bid', 'pass', 'reveal', 'choose-loss', 'choose-starter', 'next'] as const;
export type Action = typeof ACTIONS[number];

export type GameState = {
  game: 'skull';
  matchId: string;
  revision: number;
  round: number;
  phase: Phase;
  seats: Seat[];
  starterId: string;
  actorId: string | null;
  bid: Bid | null;
  passed: string[];
  revealed: Reveal[];
  result: RoundResult | null;
  lost: { playerId: string; kind: DiscKind } | null;
  nextStarterId: string | null;
  winner: Winner | null;
  processedActions: string[];
};

export type PublicSeat = {
  id: string;
  remaining: number;
  successes: number;
  stack: (DiscKind | null)[];
};

export type PublicState = {
  game: 'skull';
  matchId: string;
  revision: number;
  round: number;
  phase: Phase;
  seats: PublicSeat[];
  starterId: string;
  actorId: string | null;
  bid: Bid | null;
  passed: string[];
  revealed: Reveal[];
  result: RoundResult | null;
  nextStarterId: string | null;
  winner: Winner | null;
};

export type PrivateState = PublicState & {
  mine?: {
    hand: Disc[];
    stack: DiscKind[];
    lossOptions: Disc[];
    lost: DiscKind | null;
  };
};

export class RuleError extends Error {}

export function createGameState(ids: string[], matchId: string, randomIndex: (limit: number) => number): GameState {
  if (ids.length < MIN_PLAYERS || ids.length > MAX_PLAYERS || new Set(ids).size !== ids.length) {
    throw new RuleError('スカルは3〜6人で遊べます');
  }
  const seats = ids.map(id => ({
    id,
    discs: (['flower', 'flower', 'flower', 'skull'] as const).map((kind, index) => ({ id: String(index + 1), kind })),
    stack: [],
    successes: 0,
  }));
  return {
    game: 'skull', matchId, revision: 0, round: 1, phase: 'opening', seats,
    starterId: ids[randomIndex(ids.length)], actorId: null, bid: null, passed: [],
    revealed: [], result: null, lost: null, nextStarterId: null, winner: null, processedActions: [],
  };
}

function nextSeat(state: GameState, id: string, canPlay: (seat: Seat) => boolean) {
  const index = state.seats.findIndex(seat => seat.id === id);
  const ordered = [...state.seats.slice(index + 1), ...state.seats.slice(0, index)];
  return ordered.find(seat => seat.discs.length > 0 && canPlay(seat))?.id ?? null;
}

function finishRound(state: GameState, nextStarterId: string) {
  state.phase = 'result';
  state.actorId = null;
  state.nextStarterId = nextStarterId;
}

function win(state: GameState, playerId: string, reason: Winner['reason']) {
  state.phase = 'finished';
  state.actorId = null;
  state.winner = { playerId, reason };
}

function removeDisc(state: GameState, seat: Seat, disc: Disc, skullOwnerId: string) {
  seat.discs = seat.discs.filter(owned => owned.id !== disc.id);
  state.lost = { playerId: seat.id, kind: disc.kind };
  const active = state.seats.filter(player => player.discs.length > 0);
  if (active.length === 1) {
    win(state, active[0].id, 'last-standing');
  } else if (seat.discs.length > 0) {
    finishRound(state, seat.id);
  } else if (seat.id !== skullOwnerId) {
    finishRound(state, skullOwnerId);
  } else {
    state.phase = 'starter-choice';
    state.actorId = seat.id;
  }
}

export function getRevealTargets(state: Pick<PublicState, 'seats' | 'phase' | 'actorId'>): string[] {
  if (state.phase !== 'challenge') return [];
  const available = state.seats.filter(seat => seat.stack.includes(null)).map(seat => seat.id);
  return state.actorId && available.includes(state.actorId) ? [state.actorId] : available;
}

export function applyAction(
  previous: GameState,
  actorId: string,
  hostId: string,
  action: Action,
  value: unknown,
  actionKey: string,
  randomIndex: (limit: number) => number,
): GameState {
  if (previous.processedActions.includes(actionKey)) return previous;
  if (previous.phase === 'finished') throw new RuleError('ゲームは終了しています');

  const state = structuredClone(previous);
  const seat = state.seats.find(player => player.id === actorId);
  const requireTurn = (phase: Phase) => {
    if (state.phase !== phase || state.actorId !== actorId) throw new RuleError('現在はこの操作ができません');
  };

  switch (action) {
    case 'place': {
      if (!seat || !seat.discs.length) throw new RuleError('ディスクがありません');
      if (state.phase === 'opening') {
        if (seat.stack.length) throw new RuleError('最初のディスクはすでに置いています');
      } else {
        requireTurn('placing');
      }
      const disc = seat.discs.find(disc => disc.id === value && !seat.stack.some(played => played.id === disc.id));
      if (!disc) throw new RuleError('置けるディスクを選んでください');
      seat.stack.push(disc);
      if (state.phase === 'placing') {
        state.actorId = nextSeat(state, actorId, () => true);
      } else if (state.seats.every(player => !player.discs.length || player.stack.length > 0)) {
        state.phase = 'placing';
        state.actorId = state.starterId;
      }
      break;
    }
    case 'bid': {
      if (state.phase !== 'placing') requireTurn('bidding');
      else requireTurn('placing');
      const total = state.seats.reduce((count, player) => count + player.stack.length, 0);
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= (state.bid?.count ?? 0) || value > total) {
        throw new RuleError('場にある枚数まで、今の宣言より大きい数を選んでください');
      }
      state.bid = { playerId: actorId, count: value };
      state.actorId = value === total ? null : nextSeat(state, actorId, player => !state.passed.includes(player.id));
      if (state.actorId === null) {
        state.phase = 'challenge';
        state.actorId = actorId;
      } else {
        state.phase = 'bidding';
      }
      break;
    }
    case 'pass': {
      requireTurn('bidding');
      if (!state.bid || actorId === state.bid.playerId) throw new RuleError('現在はパスできません');
      state.passed.push(actorId);
      const next = nextSeat(state, actorId, player => player.id !== state.bid?.playerId && !state.passed.includes(player.id));
      if (next) {
        state.actorId = next;
      } else {
        state.phase = 'challenge';
        state.actorId = state.bid.playerId;
      }
      break;
    }
    case 'reveal': {
      requireTurn('challenge');
      if (!seat || !state.bid || typeof value !== 'string' || !getRevealTargets(toPublicState(state)).includes(value)) {
        throw new RuleError('めくれる山の一番上を選んでください');
      }
      const target = state.seats.find(player => player.id === value)!;
      const position = target.stack.length - 1 - state.revealed.filter(reveal => reveal.playerId === value).length;
      const disc = target.stack[position];
      state.revealed.push({ playerId: value, position, kind: disc.kind });
      if (disc.kind === 'skull') {
        state.result = { kind: 'failure', skullOwnerId: value };
        if (value === actorId) {
          state.phase = 'loss-choice';
        } else {
          removeDisc(state, seat, seat.discs[randomIndex(seat.discs.length)], value);
        }
      } else if (state.revealed.length === state.bid.count) {
        state.result = { kind: 'success' };
        seat.successes += 1;
        if (seat.successes === 2) win(state, actorId, 'two-successes');
        else finishRound(state, actorId);
      }
      break;
    }
    case 'choose-loss': {
      requireTurn('loss-choice');
      const disc = seat?.discs.find(disc => disc.id === value);
      if (!seat || !disc) throw new RuleError('失うディスクを選んでください');
      removeDisc(state, seat, disc, actorId);
      break;
    }
    case 'choose-starter': {
      requireTurn('starter-choice');
      if (!state.seats.some(player => player.id === value && player.discs.length > 0)) {
        throw new RuleError('ディスクが残っているプレイヤーを選んでください');
      }
      finishRound(state, value as string);
      break;
    }
    case 'next': {
      if (actorId !== hostId || state.phase !== 'result' || !state.nextStarterId) {
        throw new RuleError('ラウンド終了後にホストが次のラウンドを始められます');
      }
      state.round += 1;
      state.phase = 'opening';
      state.starterId = state.nextStarterId;
      state.actorId = null;
      state.bid = null;
      state.passed = [];
      state.revealed = [];
      state.result = null;
      state.lost = null;
      state.nextStarterId = null;
      for (const player of state.seats) player.stack = [];
      break;
    }
  }
  state.revision += 1;
  state.processedActions.push(actionKey);
  return state;
}

export function toPublicState(state: GameState): PublicState {
  const copyReveal = ({ playerId, position, kind }: Reveal): Reveal => ({ playerId, position, kind });
  return {
    game: 'skull',
    matchId: state.matchId,
    revision: state.revision,
    round: state.round,
    phase: state.phase,
    seats: state.seats.map(seat => ({
      id: seat.id,
      remaining: seat.discs.length,
      successes: seat.successes,
      stack: seat.stack.map((_, position) => state.revealed.find(reveal => reveal.playerId === seat.id && reveal.position === position)?.kind ?? null),
    })),
    starterId: state.starterId,
    actorId: state.actorId,
    bid: state.bid && { playerId: state.bid.playerId, count: state.bid.count },
    passed: [...state.passed],
    revealed: state.revealed.map(copyReveal),
    result: state.result?.kind === 'success' ? { kind: 'success' } :
      state.result && { kind: 'failure', skullOwnerId: state.result.skullOwnerId },
    nextStarterId: state.nextStarterId,
    winner: state.winner && { playerId: state.winner.playerId, reason: state.winner.reason },
  };
}

export function toPrivateState(state: GameState, actorId: string): PrivateState {
  const publicState = toPublicState(state);
  const seat = state.seats.find(player => player.id === actorId);
  if (!seat?.discs.length) return publicState;
  const copyDisc = ({ id, kind }: Disc): Disc => ({ id, kind });
  return {
    ...publicState,
    mine: {
      hand: seat.discs.filter(disc => !seat.stack.some(played => played.id === disc.id)).map(copyDisc),
      stack: seat.stack.map(disc => disc.kind),
      lossOptions: state.phase === 'loss-choice' && state.actorId === actorId ? seat.discs.map(copyDisc) : [],
      lost: state.lost?.playerId === actorId ? state.lost.kind : null,
    },
  };
}
