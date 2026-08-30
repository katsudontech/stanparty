import { createClient } from '@supabase/supabase-js';
import { getAnswerMatchResult, selectDrawingWinner, validateGeminiGuess, validateGeminiSemantic } from '@/games/ai-barenai-drawing/rules';
import { pickAiBarenaiDrawingTopic } from '@/games/ai-barenai-drawing/topics';
import type { AiBarenaiDrawingState } from '@/games/ai-barenai-drawing/types';

export const dynamic = 'force-dynamic';
type ServiceClient = ReturnType<typeof serviceClient>;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('サーバーのSupabase設定がありません');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function actorFromToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const auth = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await auth.auth.getUser(token);
  return data.user?.id ?? null;
}

async function gemini(parts: Array<Record<string, unknown>>, schema: Record<string, unknown>): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
  if (!key) throw new Error('Gemini設定がありません');
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 30_000);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal: abort.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2 },
      }),
    },
  ).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini response was empty');
  return JSON.parse(text);
}

const guessSchema = {
  type: 'object',
  properties: { answer: { type: 'string' }, confidence: { type: 'integer', minimum: 0, maximum: 100 } },
  required: ['answer', 'confidence'],
  additionalProperties: false,
};
const semanticSchema = {
  type: 'object',
  properties: { correct: { type: 'boolean' } },
  required: ['correct'],
  additionalProperties: false,
};

async function evaluateCandidate(candidate: string, topic: string, aliases: string[]) {
  const match = getAnswerMatchResult(candidate, topic, aliases);
  if (match === 'correct') return true;
  if (match === 'wrong') return false;
  try {
    const result = await gemini([{
      text: `正解と回答が同じ対象を指すか判定してください。一般的な略称・表記揺れ・同一対象は正解、関連するだけの語や上位概念・下位概念は不正解です。\n${JSON.stringify({ answer: topic, aliases, candidate })}`,
    }], semanticSchema);
    return validateGeminiSemantic(result) === true;
  } catch {
    return false;
  }
}

async function progress(supabase: ServiceClient, roomId: string, actorId: string) {
  const room = await supabase.from('rooms').select('game_state').eq('id', roomId).single();
  const state = room.data?.game_state as AiBarenaiDrawingState | undefined;
  if (room.error || !state || state.phase !== 'answering') return state ?? null;

  const guessClaim = await supabase.rpc('ai_barenai_drawing_claim_guess', { p_room_id: roomId, p_actor_id: actorId, p_claim_token: crypto.randomUUID() });
  if (guessClaim.error) throw guessClaim.error;
  const claim = guessClaim.data as { claimed?: boolean; token?: string; round?: number; revision?: number; snapshot?: string } | null;
  if (claim?.claimed && claim.token && typeof claim.round === 'number' && typeof claim.revision === 'number') {
    let answer = 'AI回答を取得できませんでした';
    let confidence = 0;
    try {
      const result = validateGeminiGuess(await gemini([
        { text: 'あなたはお絵かき当てゲームの回答者です。画像が何を表すか、必ず最も可能性が高い答えを1つだけ返してください。分からない・複数候補は禁止です。画像以外の情報は使わないでください。' },
        { inlineData: { mimeType: 'image/png', data: (claim.snapshot ?? '').replace(/^data:image\/[^;]+;base64,/, '') } },
      ], guessSchema));
      if (result) ({ answer, confidence } = result);
    } catch {
      // Keep a deterministic incorrect answer when Gemini is unavailable.
    }
    const completed = await supabase.rpc('ai_barenai_drawing_complete_guess', {
      p_room_id: roomId, p_actor_id: actorId, p_claim_token: claim.token, p_claim_round: claim.round,
      p_claim_revision: claim.revision, p_answer: answer, p_confidence: confidence,
    });
    if (completed.error) throw completed.error;
  }

  const judgingClaim = await supabase.rpc('ai_barenai_drawing_claim_judging', { p_room_id: roomId, p_actor_id: actorId, p_claim_token: crypto.randomUUID() });
  if (judgingClaim.error) throw judgingClaim.error;
  const payload = judgingClaim.data as { claimed?: boolean; token?: string; round?: number; topic?: string; aliases?: string[]; answers?: Record<string, string>; ai_answer?: string; ai_confidence?: number } | null;
  if (!payload?.claimed || !payload.token || typeof payload.round !== 'number' || !payload.topic) return state;
  const evaluated = await Promise.all(Object.entries(payload.answers ?? {}).map(async ([playerId, answer]) => ({ playerId, answer, correct: await evaluateCandidate(answer, payload.topic!, payload.aliases ?? []) })));
  const aiCorrect = await evaluateCandidate(payload.ai_answer ?? '', payload.topic, payload.aliases ?? []);
  const humanCorrect = evaluated.some((item) => item.correct);
  const judgment = { round: payload.round, aiAnswer: payload.ai_answer ?? 'AI回答を取得できませんでした', aiConfidence: payload.ai_confidence ?? 0, answers: evaluated, aiCorrect, humanCorrect, winner: selectDrawingWinner(humanCorrect, aiCorrect) };
  const complete = await supabase.rpc('ai_barenai_drawing_complete_judging_claim', {
    p_room_id: roomId, p_actor_id: actorId, p_claim_token: payload.token, p_claim_round: payload.round,
    p_human_correct: humanCorrect, p_ai_correct: aiCorrect, p_judgment: judgment,
  });
  if (complete.error) throw complete.error;
  return complete.data;
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return Response.json({ error: 'Authentication is required' }, { status: 401 });
    const actorId = await actorFromToken(token);
    if (!actorId) return Response.json({ error: 'Authentication is required' }, { status: 401 });
    const body = await request.json() as { action?: string; roomId?: string; snapshot?: string; answer?: string };
    if (!body.roomId || !body.action) return Response.json({ error: 'Unsupported action' }, { status: 400 });
    const supabase = serviceClient();
    const member = await supabase.rpc('ai_barenai_drawing_is_member', { p_room_id: body.roomId, p_actor_id: actorId });
    if (member.error || member.data !== true) return Response.json({ error: 'Room membership is required' }, { status: 403 });
    const room = await supabase.from('rooms').select('game_state').eq('id', body.roomId).single();
    if (room.error || !room.data) throw room.error ?? new Error('Room not found');
    const state = room.data.game_state as AiBarenaiDrawingState;
    let data: unknown;
    if (body.action === 'initialize') {
      const topic = pickAiBarenaiDrawingTopic();
      const result = await supabase.rpc('ai_barenai_drawing_initialize', { p_room_id: body.roomId, p_actor_id: actorId, p_topic: topic.answer, p_aliases: topic.aliases });
      if (result.error) throw result.error;
      data = result.data;
    } else if (body.action === 'reset') {
      const result = await supabase.rpc('ai_barenai_drawing_reset_canvas_authorized', { p_room_id: body.roomId, p_actor_id: actorId });
      if (result.error) throw result.error;
      data = result.data;
    } else if (body.action === 'topic') {
      const result = await supabase.rpc('ai_barenai_drawing_get_topic', { p_room_id: body.roomId, p_actor_id: actorId });
      if (result.error) return Response.json({ error: 'お題を表示できません' }, { status: 403 });
      return Response.json({ answer: result.data });
    } else if (body.action === 'judge') {
      if (state.drawerId !== actorId) return Response.json({ error: '描く人だけが判定できます' }, { status: 403 });
      if (!body.snapshot?.startsWith('data:image/png;base64,') || body.snapshot.length > 5_000_000) throw new Error('Invalid canvas snapshot');
      const begun = await supabase.rpc('ai_barenai_drawing_begin_judging', { p_room_id: body.roomId, p_actor_id: actorId, p_snapshot: body.snapshot });
      if (begun.error) throw begun.error;
      data = await progress(supabase, body.roomId, actorId);
    } else if (body.action === 'answer') {
      const result = await supabase.rpc('ai_barenai_drawing_submit_answer', { p_room_id: body.roomId, p_actor_id: actorId, p_answer: body.answer });
      if (result.error) throw result.error;
      data = await progress(supabase, body.roomId, actorId);
    } else if (body.action === 'continue') {
      const result = await supabase.rpc('ai_barenai_drawing_continue', { p_room_id: body.roomId, p_actor_id: actorId });
      if (result.error) throw result.error;
      data = result.data;
    } else if (body.action === 'resume') {
      data = await progress(supabase, body.roomId, actorId);
    } else {
      return Response.json({ error: 'Unsupported action' }, { status: 400 });
    }
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'ゲーム操作に失敗しました' }, { status: 400 });
  }
}
