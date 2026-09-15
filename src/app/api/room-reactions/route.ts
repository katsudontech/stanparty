import { createClient } from '@supabase/supabase-js';
import { isUuid, validateReactionBody } from '../../../lib/roomReactionsProtocol';

export const dynamic = 'force-dynamic';

const senderRate = new Map<string, number>();

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

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

interface RoomPlayer {
  userId: string;
  name: string;
}

function roomPlayers(value: unknown): RoomPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const player = entry as Record<string, unknown>;
    return typeof player.userId === 'string' && isUuid(player.userId) && typeof player.name === 'string' && player.name.trim().length > 0 && player.name.length <= 80
      ? [{ userId: player.userId, name: player.name }]
      : [];
  });
}

function isRateLimited(actorId: string, roomId: string, now = Date.now()) {
  for (const [key, timestamp] of senderRate) if (now - timestamp > 60_000) senderRate.delete(key);
  if (senderRate.size > 4096) {
    const oldest = [...senderRate.entries()].sort((a, b) => a[1] - b[1]).slice(0, senderRate.size - 4096);
    for (const [key] of oldest) senderRate.delete(key);
  }
  const key = `${roomId}:${actorId}`;
  const previous = senderRate.get(key);
  if (previous !== undefined && now - previous < 1_000) return true;
  senderRate.set(key, now);
  return false;
}

async function broadcastReaction(roomId: string, recipients: RoomPlayer[], payload: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('サーバーのSupabase設定がありません');
  const messages = recipients.map((recipient) => ({
    topic: `room-reactions:${roomId}:${recipient.userId}`,
    event: 'reaction',
    payload,
    private: true,
  }));
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 5_000);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: abort.signal,
    });
    if (!response.ok) throw new Error(`Broadcast failed (${response.status})`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonError('Authentication is required', 401);
    const actorId = await actorFromToken(token);
    if (!actorId) return jsonError('Authentication is required', 401);

    let input: unknown;
    try { input = await request.json(); } catch { return jsonError('Invalid JSON'); }
    const body = validateReactionBody(input);
    if (!body) return jsonError('Invalid reaction');
    const supabase = serviceClient();
    const roomResult = await supabase.from('rooms').select('host_id,players').eq('id', body.roomId).maybeSingle();
    if (roomResult.error || !roomResult.data) return jsonError('Room membership is required', 403);
    const players = roomPlayers(roomResult.data.players);
    const actor = players.find((player) => player.userId === actorId);
    if (roomResult.data.host_id !== actorId && !actor) return jsonError('Room membership is required', 403);
    if (!actor) return jsonError('Room member profile is missing', 403);
    const recipients = Array.from(new Map(players.map((player) => [player.userId, player])).values());
    if (!recipients.some((recipient) => recipient.userId === actorId)) return jsonError('Room member profile is missing', 403);
    if (isRateLimited(actorId, body.roomId)) return jsonError('Too many reactions', 429);

    const reaction = { id: crypto.randomUUID(), emoji: body.emoji, senderId: actorId, senderName: actor.name, sentAt: Date.now() };
    await broadcastReaction(body.roomId, recipients, reaction);
    return Response.json({ id: reaction.id });
  } catch {
    return jsonError('リアクションを送信できませんでした', 502);
  }
}
