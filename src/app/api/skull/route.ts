import { randomInt, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  ACTIONS,
  applyAction,
  createGameState,
  RuleError,
  toPrivateState,
  toPublicState,
  type Action,
  type GameState,
} from '@/games/skull/rules';

export const dynamic = 'force-dynamic';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const actionIdFormat = /^[a-zA-Z0-9_-]{8,128}$/;
const headers = { 'Cache-Control': 'private, no-store' };

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

function jsonState(value: unknown, actorId: string) {
  const state = asState(value);
  return state ? Response.json({ data: toPrivateState(state, actorId) }, { headers }) :
    jsonError('ゲームはまだ始まっていません', 409);
}

function asState(value: unknown): GameState | null {
  return value && typeof value === 'object' && (value as GameState).game === 'skull' ? value as GameState : null;
}

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };

type Body = Partial<Record<'roomId' | 'action' | 'actionId' | 'matchId' | 'expectedRevision' | 'round' | 'phase' | 'epoch' | 'value', unknown>>;

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonError('認証が必要です', 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) return jsonError('ゲームのサーバー設定がありません', 500);

    const auth = createClient(url, anonKey, clientOptions).auth;
    const { data: { user }, error: authError } = await auth.getUser(token);
    if (authError || !user) return jsonError('認証が必要です', 401);
    const actorId = user.id;

    const input = await request.json().catch(() => null);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return jsonError('操作の内容を読み取れません', 400);
    const { roomId, action, actionId, matchId, expectedRevision, round, phase, epoch, value } = input as Body;
    if (typeof roomId !== 'string' || !uuid.test(roomId)) return jsonError('ルームが無効です', 400);
    const isGameAction = ACTIONS.some(kind => kind === action);
    if (!isGameAction && action !== 'snapshot' && action !== 'initialize') return jsonError('この操作はありません', 400);
    if (isGameAction && (typeof actionId !== 'string' || !actionIdFormat.test(actionId) ||
      typeof matchId !== 'string' || !uuid.test(matchId) || !Number.isSafeInteger(expectedRevision) ||
      !Number.isSafeInteger(round) || typeof phase !== 'string')) {
      return jsonError('操作の情報が足りません', 400);
    }

    const supabase = createClient(url, serviceKey, clientOptions);
    const { data: room, error: roomError } = await supabase.from('rooms')
      .select('id,host_id,status,game_type,players,skull_epoch').eq('id', roomId).maybeSingle();
    if (roomError) throw roomError;
    if (!room) return jsonError('ルームが見つかりません', 404);
    const ids = Array.isArray(room.players) ? room.players.flatMap((player: unknown) =>
      player && typeof player === 'object' && 'userId' in player && typeof player.userId === 'string' ? [player.userId] : []) : [];
    if (room.game_type !== 'skull' || (room.host_id !== actorId && !ids.includes(actorId))) {
      return jsonError('このルームに参加してください', 403);
    }
    if (room.status !== 'playing' && room.status !== 'finished') return jsonError('ゲームは始まっていません', 409);

    const rpcRoom = { p_room_id: roomId, p_actor_id: actorId };
    if (action === 'initialize') {
      if (room.host_id !== actorId) return jsonError('ホストがゲームを始められます', 403);
      if (room.status !== 'playing' || epoch !== room.skull_epoch) return jsonError('開始情報が古くなっています', 409);
      const initial = createGameState(ids, randomUUID(), randomInt);
      const { data, error } = await supabase.rpc('skull_commit_initial', {
        ...rpcRoom, p_expected_epoch: epoch, p_roster: room.players, p_state: initial, p_public_state: toPublicState(initial),
      });
      if (error) return jsonError('ゲームを始められませんでした。もう一度お試しください', 409);
      return jsonState(data, actorId);
    }

    const readState = () => supabase.rpc('skull_read_state', rpcRoom);
    if (action === 'snapshot') {
      const { data, error } = await readState();
      if (error) return jsonError('ゲームの情報を取得できませんでした', 409);
      return jsonState(data, actorId);
    }

    const concurrent = action === 'place' && phase === 'opening';
    const actionKey = actorId + ':' + actionId;
    const conflict = () => jsonError('ゲームが進みました。最新の状態を確認してください', 409);
    for (let attempt = 0; attempt < (concurrent ? 6 : 1); attempt += 1) {
      const { data: current, error: readError } = await readState();
      if (readError) return conflict();
      const state = asState(current);
      if (!state || matchId !== state.matchId) return conflict();
      if (state.processedActions.includes(actionKey)) return jsonState(state, actorId);
      if (round !== state.round || phase !== state.phase || (!concurrent && expectedRevision !== state.revision)) return conflict();
      const next = applyAction(state, actorId, room.host_id, action as Action, value, actionKey, randomInt);
      const { data, error } = await supabase.rpc('skull_commit_action', {
        ...rpcRoom, p_match_id: matchId, p_expected_revision: state.revision, p_action_id: actionId,
        p_state: next, p_public_state: toPublicState(next),
      });
      if (!error) return jsonState(data, actorId);
      if (error.message !== 'stale revision') return conflict();
    }
    return conflict();
  } catch (error) {
    if (error instanceof RuleError) return jsonError(error.message, 400);
    return jsonError('ゲーム操作に失敗しました。もう一度お試しください', 500);
  }
}
