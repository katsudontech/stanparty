import { createClient } from '@supabase/supabase-js';
import { applyAction, createGameState, toPrivateState, toPublicState, type State } from '@/games/shittakaburi-show/rules';
function normalizeState(value: unknown): State | null { return value && typeof value === 'object' && (value as State).game === 'shittakaburi-show' ? value as State : null; }

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

type Body = { roomId?: unknown; action?: unknown; matchId?: unknown; expectedRevision?: unknown; actionId?: unknown; value?: unknown; round?: unknown; phase?: unknown };
type RoomRow = { id: string; host_id: string; status: string; game_type: string; players: unknown; game_state: unknown; shittakaburi_show_epoch: number };

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
  const { data, error } = await supabase.rpc('shittakaburi_show_read_state', { p_room_id: roomId, p_actor_id: actorId });
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
    const roomResult = await supabase.from('rooms').select('id,host_id,status,game_type,players,game_state,shittakaburi_show_epoch').eq('id', body.roomId).single();
    if (roomResult.error || !roomResult.data) return jsonError('Room not found', 404);
    const room = roomResult.data as RoomRow;
    if (room.game_type !== 'shittakaburi-show' || !hasMember(room, actorId)) return jsonError('Room membership is required', 403);
    if (action === 'snapshot') { if (!['playing', 'finished'].includes(room.status)) return jsonError('Game is not active', 409); return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) }); }
    if (action === 'initialize') {
      if (room.host_id !== actorId) return jsonError('この操作はホストのみ実行できます', 403);
      const ids = rosterIds(room.players);
      const state = createGameState(ids, Math.random, crypto.randomUUID());
      const committed = await supabase.rpc('shittakaburi_show_commit_initial', { p_room_id: room.id, p_actor_id: actorId, p_match_id: state.matchId, p_expected_epoch: room.shittakaburi_show_epoch, p_roster: room.players, p_state: state, p_public_state: toPublicState(state) });
      if (committed.error) {
        if (String(committed.error.message).includes('already initialized')) return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) });
        throw committed.error;
      }
      return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) });
    }
    if (!['word', 'vote', 'start-vote', 'reveal-author', 'next', 'end'].includes(action)) return jsonError('Unsupported action');
    if (!['playing', 'finished'].includes(room.status)) return jsonError('Game is not active', 409);
    const id = actionId(body.actionId);
    const concurrent = action === 'word' || action === 'vote';
    for (let attempt = 0; attempt < 16; attempt++) {
      const current = await supabase.rpc('shittakaburi_show_read_state', { p_room_id: room.id, p_actor_id: actorId });
      if (current.error) throw current.error;
      const state = normalizeState(current.data);
      if (!state) return jsonError('Game is not initialized', 409);
      if (body.matchId !== state.matchId) return jsonError('Stale match', 409);
      if (state.processedActionIds.includes(id)) return Response.json({ data: toPrivateState(state, actorId) });
      if (state.phase === 'finished' || room.status !== 'playing') return jsonError('Game is finished', 409);
      if (body.round !== state.round || body.phase !== state.phase) return jsonError('Stale round or phase', 409);
      if (!concurrent && body.expectedRevision !== state.revision) return jsonError('Stale game state', 409);
      const next = applyAction(state, actorId, room.host_id, action, body.value, id);
      const committed = await supabase.rpc('shittakaburi_show_commit_action', { p_room_id: room.id, p_actor_id: actorId, p_match_id: state.matchId, p_expected_revision: state.revision, p_action_id: id, p_state: next, p_public_state: toPublicState(next) });
      if (!committed.error) return Response.json({ data: await privateSnapshot(supabase, room.id, actorId) });
      if (!concurrent || !String(committed.error.message).includes('stale revision')) return jsonError(committed.error.message, 409);
    }
    return jsonError('操作が混み合っています。再試行してください', 409);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'ゲーム操作に失敗しました');
  }
}
