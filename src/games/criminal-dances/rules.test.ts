import { describe, expect, it } from 'vitest';
import type { CriminalDancesCardType } from './types';
import {
  CARD_COUNTS,
  canPlayCard,
  confirmPrivateReveal,
  createFullDeck,
  createGameState,
  chooseDogCard,
  playCard,
  selectTarget,
  submitSimultaneousChoice,
  submitTradeCard,
  toPrivateState,
  toPublicState,
} from './rules';

const sequenceRng = () => 0.123;

describe('犯人は踊る deck and state rules', () => {
  it.each([3, 4, 5, 6, 7, 8])('deals exactly four cards and keeps required cards for %i players', (count) => {
    const state = createGameState(Array.from({ length: count }, (_, i) => `p${i}`), sequenceRng, `m${count}`);
    expect(Object.values(state.players).every((player) => player.hand.length === 4)).toBe(true);
    const deck = Object.values(state.players).flatMap((player) => player.hand);
    expect(deck).toHaveLength(count * 4);
    expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
    expect(deck.filter((card) => card.type === 'first_discoverer')).toHaveLength(1);
    expect(deck.filter((card) => card.type === 'culprit')).toHaveLength(1);
    expect(deck.filter((card) => card.type === 'detective').length).toBeGreaterThanOrEqual(count === 3 || count === 4 || count === 5 ? 1 : 2);
    expect(deck.filter((card) => card.type === 'alibi').length).toBeGreaterThanOrEqual(count === 7 ? 3 : 2);
  });

  it('contains the complete configured 32-card set', () => {
    const deck = createFullDeck();
    expect(deck).toHaveLength(32);
    for (const [type, count] of Object.entries(CARD_COUNTS)) expect(deck.filter((card) => card.type === type)).toHaveLength(count);
  });

  it('starts at first discoverer and rejects other first cards', () => {
    const state = createGameState(['a', 'b', 'c'], sequenceRng, 'start');
    const first = state.players[state.firstDiscovererPlayerId].hand.find((card) => card.type === 'first_discoverer')!;
    expect(() => playCard(state, state.turnOrder[(state.currentPlayerIndex + 1) % 3], first.id)).toThrow();
    const next = playCard(state, state.firstDiscovererPlayerId, first.id);
    expect(next.firstDiscovererPlayed).toBe(true);
    expect(next.currentPlayerIndex).toBe((state.currentPlayerIndex + 1) % 3);
  });

  it('does not expose hands or card IDs in the public projection', () => {
    const state = createGameState(['a', 'b', 'c'], sequenceRng, 'secret');
    const publicState = toPublicState(state);
    expect(JSON.stringify(publicState)).not.toContain('culprit-1');
    expect(publicState.players.a).not.toHaveProperty('hand');
    expect(toPrivateState(state, 'a').myHand).toHaveLength(4);
  });


});


function fixture(hands: Record<string, Array<{ type: string; id?: string }>>, current = 'a') {
  const state = createGameState(['a', 'b', 'c'], sequenceRng, `fixture-${current}`);
  for (const id of state.turnOrder) {
    state.players[id].hand = (hands[id] ?? []).map((card, index) => ({ id: card.id ?? `${id}-${card.type}-${index}`, type: card.type as CriminalDancesCardType }));
    state.players[id].played = [];
    state.players[id].conspirator = false;
  }
  state.firstDiscovererPlayerId = 'a';
  state.firstDiscovererPlayed = true;
  state.currentPlayerIndex = state.turnOrder.indexOf(current);
  state.round = 2;
  return state;
}

describe('犯人は踊る individual effects', () => {
  it('detective misses a culprit protected by alibi and catches an unprotected culprit', () => {
    let state = fixture({ a: [{ type: 'detective' }], b: [{ type: 'culprit' }, { type: 'alibi' }], c: [] });
    state = playCard(state, 'a', 'a-detective-0');
    state = selectTarget(state, 'a', 'b');
    expect(state.phase).toBe('playing');
    state = fixture({ a: [{ type: 'detective' }], b: [{ type: 'culprit' }], c: [] });
    state = selectTarget(playCard(state, 'a', 'a-detective-0'), 'a', 'b');
    expect(state.outcome?.reason).toBe('detective_caught');
  });

  it('allows culprit escape only from the last card and deduplicates conspirator winners', () => {
    let state = fixture({ a: [{ type: 'culprit' }], b: [{ type: 'conspiracy' }], c: [] });
    state.players.a.conspirator = true;
    state.players.b.conspirator = true;
    state = playCard(state, 'a', 'a-culprit-0');
    expect(state.outcome?.winners).toEqual(['a', 'b']);
    expect(() => playCard(fixture({ a: [{ type: 'culprit' }, { type: 'civilian' }], b: [], c: [] }), 'a', 'a-culprit-0')).toThrow();
  });

  it('publishes a dog reveal while using a shuffled private position', () => {
    let state = fixture({ a: [{ type: 'dog' }], b: [{ type: 'culprit' }, { type: 'civilian' }], c: [] });
    state = playCard(state, 'a', 'a-dog-0');
    state = selectTarget(state, 'a', 'b');
    const pending = state.pending;
    expect(pending?.kind).toBe('dog_card');
    const displayIndex = pending && pending.kind === 'dog_card' ? pending.cardOrder.indexOf(0) : -1;
    state = chooseDogCard(state, 'a', displayIndex);
    expect(state.outcome?.reason).toBe('dog_caught');
    expect(state.revealedCardType).toBe('culprit');
  });

  it('exchanges trade cards only after both participants commit', () => {
    let state = fixture({ a: [{ type: 'trade' }, { type: 'civilian' }], b: [{ type: 'civilian' }], c: [] });
    state = playCard(state, 'a', 'a-trade-0');
    state = selectTarget(state, 'a', 'b');
    state = submitTradeCard(state, 'a', 'a-civilian-1');
    expect(state.pending).not.toBeNull();
    state = submitTradeCard(state, 'b', 'b-civilian-0');
    expect(state.pending).toBeNull();
    expect(state.players.a.hand.map((card) => card.id)).toContain('b-civilian-0');
    expect(state.players.b.hand.map((card) => card.id)).toContain('a-civilian-1');
  });

  it('lets empty-hand seats receive information-control and rumor cards', () => {
    let state = fixture({ a: [{ type: 'information_control' }], b: [{ type: 'civilian' }], c: [] });
    state = playCard(state, 'a', 'a-information_control-0');
    state = submitSimultaneousChoice(state, 'b', 'b-civilian-0');
    expect(state.players.c.hand.map((card) => card.id)).toContain('b-civilian-0');
    state = fixture({ a: [{ type: 'rumor' }], b: [{ type: 'civilian' }], c: [] });
    state = playCard(state, 'a', 'a-rumor-0');
    state = submitSimultaneousChoice(state, 'c', 0);
    expect(state.players.c.hand).toHaveLength(1);
    expect(state.players.b.hand).toHaveLength(0);
  });
});

describe('edge cases and privacy regressions', () => {
  it('counts a full first lap even when the starting seat is empty', () => {
    let state = fixture({ a: [], b: [{ type: 'culprit' }, { type: 'detective' }], c: [{ type: 'civilian' }] }, 'c');
    state.round = 1;
    state = playCard(state, 'c', 'c-civilian-0');
    expect(state.round).toBe(2);
    expect(state.turnOrder[state.currentPlayerIndex]).toBe('b');
  });

  it.each([['detective', 'detective'], ['culprit', 'detective', 'detective']])('discards the first-lap detective exception without effect: %j', (...types) => {
    const state = fixture({ a: types.map(type => ({ type })), b: [{ type: 'culprit' }], c: [] });
    state.round = 1;
    const card = state.players.a.hand.find(card => card.type === 'detective')!;
    const next = playCard(state, 'a', card.id);
    expect(next.pending).toBeNull();
    expect(next.phase).toBe('playing');
  });

  it('blocks early detective when another legal card exists', () => {
    const state = fixture({ a: [{ type: 'detective' }, { type: 'alibi' }], b: [{ type: 'culprit' }], c: [] });
    state.round = 1;
    expect(canPlayCard(state, 'a', 'a-detective-0').allowed).toBe(false);
  });

  it('lets boy see an alibi-protected culprit, including himself, privately', () => {
    const state = playCard(fixture({ a: [{ type: 'boy' }, { type: 'culprit' }, { type: 'alibi' }], b: [], c: [] }), 'a', 'a-boy-0');
    expect(toPrivateState(state, 'a').privateReveal?.culpritPlayerId).toBe('a');
    expect(toPrivateState(state, 'b').privateReveal).toBeNull();
    expect(toPublicState(state).pending).not.toHaveProperty('culpritPlayerId');
    expect(toPrivateState(confirmPrivateReveal(state, 'a'), 'a').privateReveal).toBeNull();
  });

  it('captures witness snapshots without stable other-card identifiers', () => {
    const state = selectTarget(playCard(fixture({ a: [{ type: 'witness' }], b: [{ type: 'culprit' }, { type: 'alibi' }], c: [] }), 'a', 'a-witness-0'), 'a', 'b');
    const observed = toPrivateState(state, 'a').privateReveal;
    expect(observed?.cards?.map(card => card.type)).toEqual(['culprit', 'alibi']);
    expect(observed?.cards?.map(card => card.id)).not.toContain('b-culprit-0');
    state.players.b.hand = [];
    expect(toPrivateState(state, 'a').privateReveal).toEqual(observed);
    expect(toPrivateState(state, 'c').privateReveal).toBeNull();
    expect(() => confirmPrivateReveal(state, 'b')).toThrow();
  });

  it('dog ignores alibi and a conspirator captor leaves no winner', () => {
    let state = fixture({ a: [{ type: 'dog' }], b: [{ type: 'culprit' }, { type: 'alibi' }], c: [] });
    state.players.a.conspirator = true;
    state = selectTarget(playCard(state, 'a', 'a-dog-0'), 'a', 'b');
    if (state.pending?.kind !== 'dog_card') throw new Error('dog effect missing');
    state = chooseDogCard(state, 'a', state.pending.cardOrder.indexOf(0));
    expect(state.outcome?.winners).toEqual([]);
    expect(state.outcome?.conspirators).toEqual(['a']);
  });

  it('last-card trade and targetless effects finish without blocking', () => {
    const state = playCard(fixture({ a: [{ type: 'trade' }], b: [{ type: 'culprit' }], c: [] }), 'a', 'a-trade-0');
    expect(state.pending).toBeNull();
    expect(state.phase).toBe('playing');
    const noTarget = playCard(fixture({ a: [{ type: 'dog' }, { type: 'culprit' }], b: [], c: [] }), 'a', 'a-dog-0');
    expect(noTarget.pending).toBeNull();
  });

  it('locks trade target and choices without publishing selected card identities', () => {
    let state = playCard(fixture({ a: [{ type: 'trade' }, { type: 'culprit' }], b: [{ type: 'alibi' }], c: [{ type: 'civilian' }] }), 'a', 'a-trade-0');
    expect(() => submitTradeCard(state, 'a', 'a-culprit-1')).toThrow();
    state = selectTarget(state, 'a', 'b');
    state = submitTradeCard(state, 'b', 'b-alibi-0');
    expect(() => selectTarget(state, 'a', 'c')).toThrow();
    expect(() => submitTradeCard(state, 'b', 'b-alibi-0')).toThrow();
    expect(JSON.stringify(toPublicState(state))).not.toContain('b-alibi-0');
    expect(() => playCard(state, 'a', 'a-culprit-1')).toThrow();
  });

  it('rumor accepts only opaque positions and conserves each original card', () => {
    let state = playCard(fixture({ a: [{ type: 'rumor' }, { type: 'alibi' }], b: [{ type: 'culprit' }], c: [{ type: 'civilian' }] }), 'a', 'a-rumor-0');
    expect(() => submitSimultaneousChoice(state, 'c', 'b-culprit-0')).toThrow();
    expect(() => submitSimultaneousChoice(state, 'c', -1)).toThrow();
    const before = Object.values(state.players).flatMap(p => p.hand.map(c => c.id)).sort();
    state = submitSimultaneousChoice(state, 'a', 0);
    expect(() => submitSimultaneousChoice(state, 'a', 0)).toThrow();
    expect(state.players.a.hand[0].id).toBe('a-alibi-1');
    state = submitSimultaneousChoice(state, 'b', 0);
    state = submitSimultaneousChoice(state, 'c', 0);
    expect(Object.values(state.players).flatMap(p => p.hand.map(c => c.id)).sort()).toEqual(before);
    expect(state.players.a.hand[0].id).toBe('c-civilian-0');
    expect(state.players.b.hand[0].id).toBe('a-alibi-1');
    expect(state.players.c.hand[0].id).toBe('b-culprit-0');
    expect(state.phase).toBe('playing');
  });

  it('replay is harmless and a rematch clears all previous match state', () => {
    const initial = fixture({ a: [{ type: 'culprit' }], b: [], c: [] });
    const finished = playCard(initial, 'a', 'a-culprit-0', 'once');
    expect(playCard(finished, 'a', 'a-culprit-0', 'once')).toEqual(finished);
    expect(() => playCard(finished, 'a', 'a-culprit-0', 'twice')).toThrow();
    const reset = createGameState(['a', 'b', 'c'], sequenceRng, 'new-match');
    expect(reset.round).toBe(1);
    expect(reset.pending).toBeNull();
    expect(reset.processedActionIds).toEqual([]);
    expect(reset.outcome).toBeNull();
    expect(Object.values(reset.players).every(p => p.hand.length === 4 && !p.conspirator && !p.played.length)).toBe(true);
  });
});

describe('complete matches with multiple independent player views', () => {
  it.each([3, 4, 5, 6, 7, 8])('finishes %i-player matches while preserving every card', (count) => {
    for (let seed = 1; seed <= 12; seed++) {
      let random = seed;
      const rng = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };
      let state = createGameState(Array.from({ length: count }, (_, index) => `p${index}`), rng, `match-${count}-${seed}`);
      for (let step = 0; step < 500 && state.phase !== 'finished'; step++) {
        const pending = state.pending;
        if (!pending) {
          const actor = state.turnOrder[state.currentPlayerIndex];
          const legal = state.players[actor].hand.filter(card => canPlayCard(state, actor, card.id).allowed);
          expect(legal.length).toBeGreaterThan(0);
          const card = legal[Math.floor(rng() * legal.length)];
          state = playCard(state, actor, card.id);
        } else if (pending.kind === 'boy_reveal' || pending.kind === 'witness_reveal') {
          expect(toPrivateState(state, pending.actorId).privateReveal).not.toBeNull();
          for (const id of state.turnOrder.filter(id => id !== pending.actorId)) expect(toPrivateState(state, id).privateReveal).toBeNull();
          state = confirmPrivateReveal(state, pending.actorId);
        } else if (pending.kind === 'dog_card') {
          state = chooseDogCard(state, pending.actorId, Math.floor(rng() * pending.cardCount));
        } else if (pending.kind === 'trade') {
          if (!pending.targetId) state = selectTarget(state, pending.actorId, pending.eligibleTargetIds[0]);
          else {
            const id = pending.actorCardId ? pending.targetId : pending.actorId;
            state = submitTradeCard(state, id, state.players[id].hand[0].id);
          }
        } else if (pending.kind === 'information_control' || pending.kind === 'rumor') {
          const id = state.turnOrder.find((id, index) => !pending.choices[id] && (pending.kind === 'information_control' ? pending.baseHands[id].length : pending.baseHands[state.turnOrder[(index - 1 + count) % count]].length));
          expect(id).toBeDefined();
          state = submitSimultaneousChoice(state, id!, pending.kind === 'rumor' ? 0 : pending.baseHands[id!][0].id);
        } else state = selectTarget(state, pending.actorId, pending.eligibleTargetIds[0]);
        const hands = Object.values(state.players).flatMap(player => player.hand);
        expect(new Set(hands.map(card => card.id)).size).toBe(hands.length);
        expect(hands.length + Object.values(state.players).reduce((total, player) => total + player.played.length, 0)).toBe(count * 4);
      }
      expect(state.phase).toBe('finished');
      expect(state.outcome?.culpritPlayerId).toBeTruthy();
    }
  });
});
