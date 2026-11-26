import { describe, expect, it } from 'vitest';
import { applyAction, createGameState, getRevealTargets, toPrivateState, toPublicState, type Action, type GameState } from './rules';

const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
const game = (count = 3, starter = 0) => createGameState(ids.slice(0, count), 'match', () => starter);
const step = (state: GameState, actor: string, action: Action, value?: unknown, random: (limit: number) => number = () => 0) =>
  applyAction(state, actor, 'a', action, value, `action-${state.revision}`, random);
const opening = (state: GameState, choices: Record<string, string> = {}) => state.seats
  .filter(seat => seat.discs.length > 0)
  .reduce((current, seat) => step(current, seat.id, 'place', choices[seat.id] ?? seat.discs[0].id), state);

describe('opening and bidding', () => {
  it.each([3, 6])('starts %i players with four discs and waits for every placement', count => {
    const initial = game(count, count - 1);
    expect(initial.phase).toBe('opening');
    expect(initial.seats.map(seat => seat.discs.map(disc => disc.kind))).toEqual(
      Array.from({ length: count }, () => ['flower', 'flower', 'flower', 'skull']));
    const some = step(initial, 'a', 'place', '4');
    expect(some.phase).toBe('opening');
    expect(() => step(some, 'a', 'place', '2')).toThrow();
    expect(() => step(some, 'a', 'bid', 1)).toThrow();
    expect(() => step(some, 'a', 'next')).toThrow();
    const ready = some.seats.slice(1).reduce((state, seat) => step(state, seat.id, 'place', '1'), some);
    expect(ready).toMatchObject({ phase: 'placing', starterId: ids[count - 1], actorId: ids[count - 1] });
    expect(toPublicState(ready).seats.every(seat => seat.stack[0] === null)).toBe(true);
  });

  it('places in seat order until a player with an empty hand must bid', () => {
    let state = opening(game());
    expect(() => step(state, 'b', 'place', '2')).toThrow();
    expect(() => step(state, 'a', 'place', '1')).toThrow();
    for (const disc of ['2', '3', '4']) {
      for (const player of ids.slice(0, 3)) state = step(state, player, 'place', disc);
    }
    expect(state.actorId).toBe('a');
    expect(toPrivateState(state, 'a').mine?.hand).toEqual([]);
    expect(() => step(state, 'a', 'place', '4')).toThrow();
    expect(() => step(state, 'a', 'bid', 13)).toThrow();
    expect(step(state, 'a', 'bid', 12)).toMatchObject({ phase: 'challenge', actorId: 'a' });
  });

  it('skips passed players, permits only a higher declaration, and leaves passed stacks on the table', () => {
    let state = opening(game(6));
    state = step(state, 'a', 'bid', 1);
    expect(() => step(state, 'b', 'place', '2')).toThrow();
    expect(() => step(state, 'b', 'bid', 1)).toThrow();
    state = step(state, 'b', 'pass');
    state = step(state, 'c', 'bid', 2);
    state = step(state, 'd', 'pass');
    state = step(state, 'e', 'pass');
    state = step(state, 'f', 'pass');
    expect(state.actorId).toBe('a');
    state = step(state, 'a', 'bid', 3);
    expect(state.actorId).toBe('c');
    state = step(state, 'c', 'pass');
    expect(state).toMatchObject({ phase: 'challenge', actorId: 'a', passed: ['b', 'd', 'e', 'f', 'c'] });
    expect(state.seats.every(seat => seat.stack.length === 1)).toBe(true);
  });
});

describe('challenges and round results', () => {
  it('reveals the challenger’s top first, allows a passed stack, and records the second success once', () => {
    let state = opening(game(), { a: '2' });
    state = step(state, 'a', 'place', '1');
    state = step(state, 'b', 'place', '2');
    state = step(state, 'c', 'place', '2');
    state = step(state, 'a', 'bid', 3);
    state = step(step(state, 'b', 'pass'), 'c', 'pass');
    expect(getRevealTargets(toPublicState(state))).toEqual(['a']);
    expect(() => step(state, 'a', 'reveal', 'b')).toThrow();
    expect(() => step(state, 'b', 'reveal', 'a')).toThrow();
    state = step(state, 'a', 'reveal', 'a');
    expect(toPublicState(state).seats[0].stack).toEqual([null, 'flower']);
    state = step(state, 'a', 'reveal', 'a');
    expect(getRevealTargets(toPublicState(state))).toEqual(['b', 'c']);
    state = step(state, 'a', 'reveal', 'b');
    expect(state).toMatchObject({ phase: 'result', nextStarterId: 'a', result: { kind: 'success' } });
    expect(state.seats[0].successes).toBe(1);
    expect(() => step(state, 'b', 'next')).toThrow();
    state = opening(step(state, 'a', 'next'));
    state = step(state, 'a', 'bid', 1);
    state = step(step(state, 'b', 'pass'), 'c', 'pass');
    const actionKey = 'winning-reveal';
    state = applyAction(state, 'a', 'a', 'reveal', 'a', actionKey, () => 0);
    expect(state.winner).toEqual({ playerId: 'a', reason: 'two-successes' });
    expect(applyAction(state, 'a', 'a', 'reveal', 'a', actionKey, () => 0)).toBe(state);
    expect(state.seats[0].successes).toBe(2);
    expect(() => step(state, 'a', 'next')).toThrow();
  });

  it('includes played discs in random loss while only projecting unchanged public reveal history', () => {
    let state = opening(game(), { b: '4' });
    state = step(state, 'a', 'bid', 3);
    state = step(state, 'a', 'reveal', 'a');
    const randomLoss = (index: number) => step(state, 'a', 'reveal', 'b', limit => {
      expect(limit).toBe(4);
      return index;
    });
    const lostRevealedFlower = randomLoss(0);
    const lostUnrevealedSkull = randomLoss(3);
    expect(lostRevealedFlower.seats[0].discs.map(disc => disc.id)).toEqual(['2', '3', '4']);
    expect(lostUnrevealedSkull.seats[0].discs.map(disc => disc.id)).toEqual(['1', '2', '3']);
    expect(lostRevealedFlower).toMatchObject({ phase: 'result', nextStarterId: 'a' });
    expect(toPublicState(lostRevealedFlower)).toEqual(toPublicState(lostUnrevealedSkull));
    expect(toPublicState(lostRevealedFlower).seats[0]).toEqual({ id: 'a', remaining: 3, successes: 0, stack: ['flower'] });
    expect(toPrivateState(lostRevealedFlower, 'a').mine?.lost).toBe('flower');
    expect(toPrivateState(lostUnrevealedSkull, 'a').mine?.lost).toBe('skull');
    expect(toPrivateState(lostRevealedFlower, 'b')).toEqual(toPrivateState(lostUnrevealedSkull, 'b'));
    expect(toPrivateState(lostRevealedFlower, 'spectator')).toEqual(toPublicState(lostRevealedFlower));
    expect(toPublicState(lostRevealedFlower)).not.toHaveProperty('processedActions');
  });

  it('offers only the challenger a private loss choice, including the revealed skull', () => {
    let state = opening(game(), { a: '4' });
    state = step(state, 'a', 'bid', 3);
    state = step(state, 'a', 'reveal', 'a', () => { throw new Error('Should not choose at random'); });
    expect(state).toMatchObject({ phase: 'loss-choice', actorId: 'a' });
    expect(toPrivateState(state, 'a').mine?.lossOptions).toHaveLength(4);
    expect(toPrivateState(state, 'b').mine?.lossOptions).toEqual([]);
    expect(() => step(state, 'b', 'choose-loss', '4')).toThrow();
    expect(() => step(state, 'a', 'choose-loss', '5')).toThrow();
    expect(() => step(state, 'a', 'next')).toThrow();
    state = step(state, 'a', 'choose-loss', '4');
    expect(state).toMatchObject({ phase: 'result', nextStarterId: 'a', lost: { kind: 'skull' } });
    state = step(state, 'a', 'next');
    expect(state).toMatchObject({ phase: 'opening', starterId: 'a', round: 2 });
    expect(state.seats[0].discs).toHaveLength(3);
    expect(toPrivateState(state, 'a').mine?.stack).toEqual([]);
    expect(toPublicState(state).revealed).toEqual([]);
    expect(() => step(state, 'a', 'place', '4')).toThrow();
  });

  it('uses the skull owner as starter if another player is eliminated', () => {
    let state = game();
    state.seats[0].discs = state.seats[0].discs.slice(0, 1);
    state = opening(state, { b: '4' });
    state = step(state, 'a', 'bid', 3);
    state = step(state, 'a', 'reveal', 'a');
    state = step(state, 'a', 'reveal', 'b');
    expect(state).toMatchObject({ phase: 'result', nextStarterId: 'b' });
    expect(toPrivateState(state, 'a')).toEqual(toPublicState(state));
    state = opening(step(state, 'a', 'next'));
    expect(state).toMatchObject({ phase: 'placing', starterId: 'b', actorId: 'b' });
    expect(() => step(state, 'a', 'place', '1')).toThrow();
  });

  it('lets a self-eliminated challenger choose a surviving starter unless only one player remains', () => {
    let state = game();
    state.seats[0].discs = state.seats[0].discs.slice(-1);
    state = opening(state);
    state = step(state, 'a', 'bid', 3);
    state = step(state, 'a', 'reveal', 'a');
    state = step(state, 'a', 'choose-loss', '4');
    expect(state).toMatchObject({ phase: 'starter-choice', actorId: 'a', nextStarterId: null });
    expect(toPrivateState(state, 'a')).toEqual(toPublicState(state));
    expect(() => step(state, 'b', 'choose-starter', 'b')).toThrow();
    expect(() => step(state, 'a', 'choose-starter', 'a')).toThrow();
    expect(step(state, 'a', 'choose-starter', 'c')).toMatchObject({ phase: 'result', nextStarterId: 'c' });

    let final = game();
    final.seats[0].discs = final.seats[0].discs.slice(-1);
    final.seats[2].discs = [];
    final = opening(final);
    final = step(final, 'a', 'bid', 2);
    final = step(final, 'a', 'reveal', 'a');
    final = step(final, 'a', 'choose-loss', '4');
    expect(final).toMatchObject({ phase: 'finished', winner: { playerId: 'b', reason: 'last-standing' } });
    expect(toPublicState(final).seats[1].stack).toEqual([null]);
  });
});
