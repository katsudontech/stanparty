import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  CARBONATION_LIMIT_MAX,
  CARBONATION_LIMIT_MIN,
  CARBONATION_RATE,
  DANGER_NOISE_PROBABILITIES,
  DANGER_THRESHOLDS,
  HINT_DURATION_MS,
  MAX_ACCEPTED_SHAKE_AMOUNT,
  MAX_TURN_SCORE,
  PENDING_HINT_TIMEOUT_MS,
  SCORE_LEVELS,
} from './constants.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const db = new PGlite();
const players = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];

await db.exec(`
  create role service_role; create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
  create table public.rooms (
    id uuid primary key default gen_random_uuid(), host_id uuid not null,
    game_type text not null default 'fake-artist', status text not null default 'waiting',
    players jsonb not null default '[]', game_state jsonb default '{}', room_name text not null default 'test',
    is_display_roomlist boolean default false, is_public boolean default false, created_at timestamptz default now()
  );
  grant select, update on public.rooms to authenticated;
`);
await db.exec(await readFile(`${root}/supabase/migrations/20260921000000_add_carbonated_shake.sql`, 'utf8'));
const permissions = await readFile(`${root}/supabase/migrations/20260812010000_game_action_permissions.sql`, 'utf8');
const enforceStart = permissions.indexOf('create or replace function public.enforce_room_update_permissions()');
const enforceEnd = permissions.indexOf('create or replace function public.enforce_game_event_insert_permissions()');
await db.exec(permissions.slice(enforceStart, enforceEnd));
await db.exec(`create trigger enforce_room_update_permissions_trigger before update on public.rooms for each row execute function public.enforce_room_update_permissions();`);
await db.exec(await readFile(`${root}/supabase/migrations/20260921010000_protect_carbonated_shake_room.sql`, 'utf8'));
const signatures = Object.fromEntries((await db.query(`select proname, proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'carbonated_shake_%'`)).rows.map((row) => [row.proname, row.proargnames]));

async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.exec('set role authenticated');
}
async function rpc(name, args) {
  const names = signatures[name];
  assert.ok(names, `RPC ${name} exists`);
  const values = names.map((name) => args[name]);
  const result = await db.query(`select public.${name}(${names.map((name, index) => `${name} => $${index + 1}`).join(',')}) result`, values);
  return result.rows[0].result;
}
async function reject(action, label) {
  await assert.rejects(action, undefined, label);
}
async function createRoom() {
  await db.exec('reset role');
  const roster = players.map((userId, index) => ({ userId, name: `Player${index + 1}`, isHost: index === 0, color: '#ef4444', isOnline: true, avatarUrl: '' }));
  return (await db.query(`insert into public.rooms(host_id,game_type,status,players) values($1,'carbonated-shake','playing',$2) returning id`, [players[0], JSON.stringify(roster)])).rows[0].id;
}

afterAll(async () => { await db.close(); });

describe('carbonated-shake PostgreSQL authority', () => {
  it('exposes one server tuning source with a derived amount cap', async () => {
    const { rows } = await db.query(`
      select private.carbonated_shake_tuning() as tuning,
             private.carbonated_shake_max_amount() as max_amount,
             private.carbonated_shake_level_count() as level_count
    `);
    assert.deepEqual(rows[0].tuning.levels, SCORE_LEVELS);
    assert.equal(rows[0].tuning.maxTurnScore, MAX_TURN_SCORE);
    assert.equal(rows[0].tuning.carbonationRate, CARBONATION_RATE);
    assert.equal(rows[0].tuning.limitMin, CARBONATION_LIMIT_MIN);
    assert.equal(rows[0].tuning.limitMax, CARBONATION_LIMIT_MAX);
    assert.equal(rows[0].tuning.pendingHintMs, PENDING_HINT_TIMEOUT_MS);
    assert.equal(rows[0].tuning.hintDisplayMs, HINT_DURATION_MS);
    assert.deepEqual(rows[0].tuning.dangerThresholds, DANGER_THRESHOLDS);
    assert.deepEqual(rows[0].tuning.noiseBuckets, [
      DANGER_NOISE_PROBABILITIES.exact,
      DANGER_NOISE_PROBABILITIES.exact + DANGER_NOISE_PROBABILITIES.oneStep,
    ]);
    assert.equal(Number(rows[0].max_amount), MAX_ACCEPTED_SHAKE_AMOUNT);
    assert.equal(Number(rows[0].level_count), DANGER_THRESHOLDS.length + 1);
  });

  it('keeps secrets private, applies cumulative sequences once, and gates hint display', async () => {
    const roomId = await createRoom();
    await actor(players[0]);
    let state = await rpc('carbonated_shake_initialize', { p_room_id: roomId });
    assert.equal(state.game, 'carbonated-shake');
    assert.equal(state.turnOrder.length, 2);
    assert.equal(Object.hasOwn(state, 'carbonation'), false);
    assert.equal(Object.hasOwn(state, 'burstLimit'), false);
    const current = state.currentPlayerId;
    await actor(current);
    state = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 2 });
    assert.equal(state.scores[current].turnScore, 3);
    const duplicate = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 5 });
    assert.equal(duplicate.scores[current].turnScore, 3);
    state = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 2, p_total_shake_amount: 5 });
    assert.equal(state.phase, 'hint_pending');
    assert.equal(state.scores[current].totalScore, 15);
    const hint = await rpc('carbonated_shake_consume_hint', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1 });
    assert.ok(hint.level >= 1 && hint.level <= 5);
    assert.equal((await rpc('carbonated_shake_consume_hint', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1 })), null);
    await reject(() => rpc('carbonated_shake_advance_turn', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1 }), 'display gate');
    await new Promise((resolve) => setTimeout(resolve, 760));
    state = await rpc('carbonated_shake_advance_turn', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1 });
    assert.equal(state.turnNumber, 2);
    assert.equal(state.currentPlayerId, state.turnOrder[1]);
    await actor(players[1]);
    await reject(() => db.query("update public.rooms set game_state='{}' where id=$1", [roomId]), 'guest direct state write');
    await actor(players[0]);
    await reject(() => db.query("update public.rooms set game_state='{}' where id=$1", [roomId]), 'host direct state write');
    await db.query("update public.rooms set status='waiting', game_state='{}' where id=$1", [roomId]);
    await reject(() => db.query('select * from private.carbonated_shake_state'), 'private table access');
  }, 30000);

  it('evaluates burst atomically and rejects stale actors and turn identities', async () => {
    const roomId = await createRoom();
    await actor(players[0]);
    let state = await rpc('carbonated_shake_initialize', { p_room_id: roomId });
    const current = state.currentPlayerId;
    await actor(current);
    await db.exec('reset role');
    await db.query('update private.carbonated_shake_state set burst_limit=1 where room_id=$1', [roomId]);
    await actor(current);
    state = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: state.turnNumber, p_sequence: 1, p_total_shake_amount: 1 });
    assert.equal(state.phase, 'finished');
    assert.equal(state.burstPlayerId, current);
    assert.equal(state.scores[current].totalScore, -999);
    await reject(() => rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: state.turnNumber, p_sequence: 2, p_total_shake_amount: 2 }), 'finished state');
    await actor(players.find((id) => id !== current));
    await reject(() => rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: state.turnNumber - 1, p_sequence: 1, p_total_shake_amount: 1 }), 'stale turn number');
  }, 30000);

  it('uses strict burst thresholds, caps max input, and finalizes a safe turn once', async () => {
    const roomId = await createRoom();
    await actor(players[0]);
    let state = await rpc('carbonated_shake_initialize', { p_room_id: roomId });
    const current = state.currentPlayerId;
    await db.exec('reset role');
    await db.query('update private.carbonated_shake_state set burst_limit=16 where room_id=$1', [roomId]);
    await actor(current);
    state = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 1 });
    assert.equal(state.phase, 'shaking');
    assert.equal(state.scores[current].turnScore, 1);
    state = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 2, p_total_shake_amount: 1.001 });
    assert.equal(state.phase, 'finished');

    const safeRoom = await createRoom();
    await actor(players[0]);
    let safe = await rpc('carbonated_shake_initialize', { p_room_id: safeRoom });
    const safeCurrent = safe.currentPlayerId;
    await actor(safeCurrent);
    safe = await rpc('carbonated_shake_apply_shake', { p_room_id: safeRoom, p_match_id: safe.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 2 });
    assert.equal(safe.scores[safeCurrent].totalScore, 0);
    safe = await rpc('carbonated_shake_finish_turn', { p_room_id: safeRoom, p_match_id: safe.matchId, p_turn_number: 1 });
    assert.equal(safe.phase, 'hint_pending');
    assert.equal(safe.scores[safeCurrent].totalScore, 3);
    const repeated = await rpc('carbonated_shake_finish_turn', { p_room_id: safeRoom, p_match_id: safe.matchId, p_turn_number: 1 });
    assert.equal(repeated.scores[safeCurrent].totalScore, 3);

    const cappedRoom = await createRoom();
    await actor(players[0]);
    let capped = await rpc('carbonated_shake_initialize', { p_room_id: cappedRoom });
    const cappedCurrent = capped.currentPlayerId;
    await actor(cappedCurrent);
    capped = await rpc('carbonated_shake_apply_shake', { p_room_id: cappedRoom, p_match_id: capped.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 100 });
    assert.equal(capped.phase, 'hint_pending');
    assert.equal(capped.scores[cappedCurrent].totalScore, 15);
    await db.exec('reset role');
    const secret = (await db.query('select carbonation, turn_amount from private.carbonated_shake_state where room_id=$1', [cappedRoom])).rows[0];
    assert.equal(Number(secret.turn_amount), 5);
    assert.equal(Number(secret.carbonation), 80);
    await actor(capped.turnOrder.find((id) => id !== cappedCurrent));
    await reject(() => rpc('carbonated_shake_consume_hint', { p_room_id: cappedRoom, p_match_id: capped.matchId, p_turn_number: 1 }), 'wrong actor private hint');
  }, 30000);

  it('expires an unconsumed hint and lets another member recover the next turn', async () => {
    const roomId = await createRoom();
    await actor(players[0]);
    let state = await rpc('carbonated_shake_initialize', { p_room_id: roomId });
    const current = state.currentPlayerId;
    await actor(current);
    state = await rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 5 });
    await db.exec('reset role');
    await db.query("update private.carbonated_shake_state set pending_hint_expires_at=now()-interval '1 second' where room_id=$1", [roomId]);
    await actor(players.find((id) => id !== current));
    state = await rpc('carbonated_shake_advance_turn', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1 });
    assert.equal(state.phase, 'shaking');
    assert.equal(state.turnNumber, 2);
    await actor(state.currentPlayerId);
    await reject(() => rpc('carbonated_shake_apply_shake', { p_room_id: roomId, p_match_id: state.matchId, p_turn_number: 1, p_sequence: 1, p_total_shake_amount: 1 }), 'stale turn identity after recovery');
  }, 30000);
});
