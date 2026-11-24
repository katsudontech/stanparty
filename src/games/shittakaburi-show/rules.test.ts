import { describe, expect, it } from 'vitest';
import { applyAction, createGameState, rankings, toPrivateState, toPublicState, type State } from './rules';
const ids = ['A','B','C','D'];
function act(state: State, actor: string, action: string, value?: string) { return applyAction(state, actor, 'A', action, value, `${state.revision}-${actor}-${action}`, () => 0); }
function discussion() { let s = createGameState(ids); for (const id of ids) s = act(s,id,'word',id === 'A' || id === 'B' ? '同じ単語' : `${id}だけの秘密`); return s; }
function voteResults() { let s = act(discussion(),'A','start-vote'); for (const [actor,target] of [['A','B'],['B','A'],['C','B'],['D','A']]) s = act(s,actor,'vote',target); return s; }
describe('知ったかぶりショー', () => {
  it('supports 3–14 unique participants and validates submissions', () => {
    expect(() => createGameState(['A','B'])).toThrow(); expect(() => createGameState([...ids,'A'])).toThrow();
    expect(createGameState(Array.from({length:14},(_,i) => `${i}`)).phase).toBe('words');
    expect(() => act(createGameState(ids),'A','word','  ')).toThrow();
    expect(() => act(createGameState(ids),'A','word','a\nb')).toThrow();
  });
  it('keeps submission ownership and votes private through explicit projections', () => {
    let s = act(createGameState(ids),'A','word','秘密');
    expect(JSON.stringify(toPublicState(s))).not.toContain('秘密');
    expect(toPrivateState(s,'B').myWord).toBeNull();
    s = discussion(); expect(s.ownerId).toBe('A'); expect(toPrivateState(s,'B').isAuthor).toBe(false);
    expect(toPrivateState(s,'A').isAuthor).toBe(true); expect(toPublicState(s).authorId).toBeNull();
    s = act(act(s,'A','start-vote'),'A','vote','B');
    expect(toPublicState(s).votes).toBeNull(); expect(toPrivateState(s,'B').myVote).toBeNull();
    expect(toPrivateState(s,'A').myVote).toBe('B');
    const result = voteResults();
    expect(toPrivateState(result,'A')).toMatchObject({ isAuthor:null, myWord:null, authorId:null, scores:null, roundPoints:null });
    expect(toPublicState(result).votes).toEqual({A:'B',B:'A',C:'B',D:'A'});
    expect(Object.keys(toPublicState(result))).not.toContain('submissions');
    expect(() => toPrivateState(s,'stranger')).toThrow();
  });
  it('scores A→B B→A C→B D→A as 2,5,0,1 exactly once with tied rankings', () => {
    const s = act(voteResults(),'A','reveal-author');
    expect(s.roundPoints).toEqual({A:2,B:5,C:0,D:1}); expect(s.scores).toEqual(s.roundPoints);
    expect(applyAction(s,'A','A','reveal-author',null,s.processedActionIds.at(-1)!)).toEqual(s);
    expect(() => act(s,'A','reveal-author')).toThrow();
    expect(rankings({A:5,B:5,C:1}).map(r=>r.rank)).toEqual([1,1,3]);
  });
  it('enforces roles, self vote ban, stages and immutable submissions', () => {
    const s = discussion(); expect(() => act(s,'B','start-vote')).toThrow();
    expect(() => act(s,'A','reveal-author')).toThrow();
    expect(() => act(act(s,'A','start-vote'),'A','vote','A')).toThrow();
    const submitted = act(createGameState(ids),'A','word','first'); expect(() => act(submitted,'A','word','second')).toThrow();
  });
  it('uses each submitter once even for duplicate words and ends without exposing unused words', () => {
    let s = discussion(); const seen = [];
    for (let round = 0; round < ids.length; round++) {
      seen.push(s.ownerId); expect(new Set(s.speakingOrder)).toEqual(new Set(ids));
      s = act(s,'A','start-vote'); for (const id of ids) s = act(s,id,'vote',id === 'A' ? 'B':'A');
      s = act(s,'A','reveal-author'); if (s.phase !== 'finished') s = act(s,'A','next');
    }
    expect(new Set(seen).size).toBe(4); expect(s.phase).toBe('finished');
    const early = act(act(voteResults(),'A','reveal-author'),'A','end');
    expect(JSON.stringify(toPublicState(early))).not.toContain('Cだけの秘密');
  });
});
