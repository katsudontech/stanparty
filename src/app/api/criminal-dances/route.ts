import { createClient } from '@supabase/supabase-js';
import { chooseDogCard, confirmPrivateReveal, createGameState, normalizeState, playCard, selectTarget, submitSimultaneousChoice, submitTradeCard, toPrivateState, toPublicState } from '@/games/criminal-dances/rules';
import type { CriminalDancesState } from '@/games/criminal-dances/types';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status = 400) { return Response.json({ error: message }, { status }); }

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('サーバーのSupabase設定がありません');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function actorFromToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase設定がありません');
  const authClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

type Body = { roomId?: unknown; action?: unknown; matchId?: unknown; expectedRevision?: unknown; actionId?: unknown; cardId?: unknown; targetId?: unknown; cardIndex?: unknown; incidentText?: unknown };
type RoomRow = { id: string; host_id: string; status: string; game_type: string; players: unknown; game_state: unknown; criminal_dances_epoch: number };

function rosterIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => entry && typeof entry === 'object' && typeof (entry as { userId?: unknown }).userId === 'string' ? [(entry as { userId: string }).userId] : []);
}

function hasMember(room: RoomRow, actorId: string) { return room.host_id === actorId || rosterIds(room.players).includes(actorId); }

function actionId(value: unknown): string {
  if (typeof value === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(value)) return value;
  return crypto.randomUUID();
}

async function privateSnapshot(supabase: ReturnType<typeof serviceClient>, roomId: string, actorId: string) {
  const { data, error } = await supabase.rpc('criminal_dances_read_state', { p_room_id: roomId, p_actor_id: actorId });
  if (error) throw error;
  const state = normalizeState(data);
  if (!state) throw new Error('ゲーム状態を読み込めません');
  return toPrivateState(state, actorId);
}

export async function POST(request: Request) {
  try {
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return jsonError('Authentication is required', 401);
    const actorId = await actorFromToken(bearer);
    if (!actorId) return jsonError('Authentication is required', 401);
    let input: unknown;
    try { input = await request.json(); } catch { return jsonError('Invalid JSON'); }
    if (!input || typeof input !== 'object') return jsonError('Invalid JSON');
    const body = input as Body;
    if (typeof body.roomId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.roomId)) return jsonError('Invalid room');
    const action = typeof body.action === 'string' ? body.action : 'snapshot';
    if (!['snapshot', 'initialize'].includes(action) && (typeof body.actionId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(body.actionId) || typeof body.matchId !== 'string' || !body.matchId || !Number.isInteger(body.expectedRevision))) return jsonError('Invalid action metadata');
    const supabase = serviceClient();
    const roomResult = await supabase.from('rooms').select('id,host_id,status,game_type,players,game_state,criminal_dances_epoch').eq('id', body.roomId).single();
    if (roomResult.error || !roomResult.data) return jsonError('Room not found', 404);
    const room = roomResult.data as RoomRow;
    if (room.game_type !== 'criminal-dances' || !hasMember(room, actorId)) return jsonError('Room membership is required', 403);
    if (action === 'snapshot') { if (!['playing', 'finished'].includes(room.status)) return jsonError('Game is not active', 409); return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) }); }
    if (action === 'initialize') {
      if (room.host_id !== actorId) return jsonError('この操作はホストのみ実行できます', 403);
      const ids = rosterIds(room.players);
      const state = createGameState(ids, Math.random, crypto.randomUUID());
      const committed = await supabase.rpc('criminal_dances_commit_initial', { p_room_id: room.id, p_actor_id: actorId, p_match_id: state.matchId, p_expected_epoch: room.criminal_dances_epoch, p_roster: room.players, p_state: state, p_public_state: toPublicState(state) });
      if (committed.error) {
        if (String(committed.error.message).includes('already initialized')) return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) });
        throw committed.error;
      }
      return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) });
    }
    if (!['play_card', 'select_target', 'confirm_private_reveal', 'choose_dog_card', 'trade_card', 'simultaneous_choice'].includes(action)) return jsonError('Unsupported action');
    if (!['playing', 'finished'].includes(room.status)) return jsonError('Game is not active', 409);
    const current = await supabase.rpc('criminal_dances_read_state', { p_room_id: room.id, p_actor_id: actorId });
    if (current.error) throw current.error;
    const state = normalizeState(current.data);
    if (!state) return jsonError('Game is not initialized', 409);
    const id = actionId(body.actionId);
    if (body.matchId !== state.matchId) return jsonError('Stale match', 409);
    if (state.processedActionIds.includes(id)) return Response.json({ data: toPrivateState(state, actorId) });
    if (state.phase !== 'playing' || room.status !== 'playing') return jsonError('Game is finished', 409);
    if (typeof body.expectedRevision === 'number' && body.expectedRevision !== state.revision) return jsonError('Stale game state', 409);
    let next: CriminalDancesState;
    if (action === 'play_card') {
      if (typeof body.cardId !== 'string') return jsonError('A card is required');
      next = playCard(state, actorId, body.cardId, id, typeof body.incidentText === 'string' ? body.incidentText : null);
    } else if (action === 'select_target') {
      if (typeof body.targetId !== 'string') return jsonError('A target is required');
      next = selectTarget(state, actorId, body.targetId);
    } else if (action === 'confirm_private_reveal') next = confirmPrivateReveal(state, actorId);
    else if (action === 'choose_dog_card') {
      if (!Number.isInteger(body.cardIndex)) return jsonError('A card position is required');
      next = chooseDogCard(state, actorId, Number(body.cardIndex));
    } else if (action === 'trade_card') {
      if (typeof body.cardId !== 'string') return jsonError('A card is required');
      next = submitTradeCard(state, actorId, body.cardId);
    } else {
      if (typeof body.cardId !== 'string' && !Number.isInteger(body.cardIndex)) return jsonError('A card choice is required');
      next = submitSimultaneousChoice(state, actorId, typeof body.cardId === 'string' ? body.cardId : Number(body.cardIndex));
    }
    if (!next.processedActionIds.includes(id)) next.processedActionIds = [...next.processedActionIds.slice(-49), id];
    const committed = await supabase.rpc('criminal_dances_commit_action', { p_room_id: room.id, p_actor_id: actorId, p_match_id: state.matchId, p_expected_revision: state.revision, p_action_id: id, p_state: next, p_public_state: toPublicState(next) });
    if (committed.error) return jsonError(committed.error.message, 409);
    return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'ゲーム操作に失敗しました');
  }
}
