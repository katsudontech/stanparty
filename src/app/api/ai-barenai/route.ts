import { createClient } from '@supabase/supabase-js';
import { pickAiBarenaiTopic } from '@/games/ai-barenai/topics';
import { getAnswerMatchResult, validateGeminiGuess, validateGeminiSemantic } from '@/games/ai-barenai/rules';

export const dynamic = 'force-dynamic';
type Action = 'initialize'|'hint'|'answer'|'topic'|'guess'|'judge'|'next-round'|'resume';
function jsonError(message: string, status = 400) { return Response.json({error: message}, {status}); }
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('サーバーのSupabase設定がありません');
  return createClient(url, key, {auth: {autoRefreshToken: false, persistSession: false}});
}
async function gemini(prompt: string, schema: Record<string, unknown>): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL;
  if (!key || !model) throw new Error('Gemini設定がありません');
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 30_000);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: abort.signal,
    headers: {'content-type': 'application/json', 'x-goog-api-key': key},
    body: JSON.stringify({contents: [{role: 'user', parts: [{text: prompt}]}], generationConfig: {responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2}}),
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const body = await response.json() as {candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>};
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini response was empty');
  return JSON.parse(text);
}
async function actorFromToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase設定がありません');
  const authClient = createClient(url, anon, {auth: {autoRefreshToken: false, persistSession: false}});
  const {data, error} = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
async function autoJudge(supabase: ReturnType<typeof serviceClient>, roomId: string, actorId: string) {
  const claimToken = crypto.randomUUID();
  const claim = await supabase.rpc('ai_barenai_claim_judging', {p_room_id: roomId, p_actor_id: actorId, p_claim_token: claimToken});
  const secret = claim.data as {claimed?: boolean; round?: number; token?: string; topic?: string; aliases?: string[]; human_answer?: string; ai_answer?: string} | null;
  if (
    claim.error
    || secret?.claimed !== true
    || !secret.topic
    || !secret.human_answer
    || !secret.ai_answer
    || typeof secret.round !== 'number'
    || typeof secret.token !== 'string'
  ) return null;
  const topic = secret.topic;
  const evaluate = async (candidate: string) => {
    const exact = getAnswerMatchResult(candidate, topic, secret.aliases ?? []);
    if (exact === 'correct') return true;
    if (exact === 'wrong') return false;
    try {
      const semantic = await gemini(`次の回答がゲーム上の正解とみなせるか判定してください。

正解: ${topic}
aliases: ${JSON.stringify(secret.aliases ?? [])}
回答: ${candidate}

一般的な略称、表記揺れ、同一対象を明確に指す表現は正解です。単なる関連語、似た存在、上位概念・下位概念として大きく異なるものは不正解です。JSONのcorrect(boolean)だけを返してください。`, {type: 'object', properties: {correct: {type: 'boolean'}}, required: ['correct'], additionalProperties: false});
      return validateGeminiSemantic(semantic) === true;
    } catch { return false; }
  };
  const [humanCorrect, aiCorrect] = await Promise.all([
    evaluate(secret.human_answer),
    evaluate(secret.ai_answer),
  ]);
  const result = await supabase.rpc('ai_barenai_complete_judging', {p_room_id: roomId, p_actor_id: actorId, p_claim_token: secret.token, p_claim_round: secret.round, p_human_correct: humanCorrect, p_ai_correct: aiCorrect});
  if (result.error) throw result.error;
  return result.data;
}
async function runGuess(supabase: ReturnType<typeof serviceClient>, roomId: string, actorId: string) {
  const claimToken = crypto.randomUUID();
  const claimed = await supabase.rpc('ai_barenai_claim_guess', {p_room_id: roomId, p_actor_id: actorId, p_claim_token: claimToken});
  if (claimed.error) return null;
  const claimData = claimed.data as {claimed?: unknown; round?: number; token?: string; hints?: Array<{round?: number; hints?: Array<{text?: string}>}>} | null;
  if (claimData?.claimed !== true || typeof claimData.round !== 'number' || typeof claimData.token !== 'string') return null;
  const hints = (claimData.hints ?? []).map((round) => ({round: round.round, hints: (round.hints ?? []).map((hint) => hint.text).filter((hint): hint is string => typeof hint === 'string')}));
  let answer = 'AI回答を取得できませんでした', confidence = 0, errorText: string | null = null;
  try {
    const guess = validateGeminiGuess(await gemini(`あなたは言葉当てゲームの回答者です。
これまでに提示されたすべてのヒントから、隠されたお題を推測してください。

情報が少なくても、必ず現時点で最も可能性が高いものを1つだけ回答してください。
「分かりません」「判断できません」や複数候補の回答は認められません。
さらに、その回答が正解であるとどの程度確信しているかを0〜100の整数で示してください。

以下は公開済みヒントだけをラウンド別にまとめたものです。お題、aliases、以前のAI回答、正誤結果は含まれていません。
${JSON.stringify(hints)}

指定されたJSON形式だけを返してください。`, {type:'object', properties:{answer:{type:'string'},confidence:{type:'integer',minimum:0,maximum:100}}, required:['answer','confidence'], additionalProperties:false}));
    if (!guess) throw new Error('Invalid Gemini guess'); answer = guess.answer; confidence = guess.confidence;
  } catch (error) { errorText = error instanceof Error ? error.message : 'Gemini error'; }
  const completed = await supabase.rpc('ai_barenai_complete_guess', {p_room_id: roomId, p_actor_id: actorId, p_claim_token: claimData.token, p_claim_round: claimData.round, p_answer: answer, p_confidence: confidence, p_error: errorText});
  return completed.error ? null : completed.data;
}
/** Idempotently resumes whichever server operation is currently possible. */
async function ensureProgress(supabase: ReturnType<typeof serviceClient>, roomId: string, actorId: string) {
  const current = await supabase.from('rooms').select('game_state').eq('id', roomId).single();
  const state = current.data?.game_state as {phase?: string; aiGuessReady?: boolean} | null;
  if (current.error || state?.phase !== 'answering') return current.data?.game_state ?? null;
  let judged = await autoJudge(supabase, roomId, actorId);
  if (judged) return judged;
  if (!state.aiGuessReady) {
    await runGuess(supabase, roomId, actorId);
    judged = await autoJudge(supabase, roomId, actorId);
    if (judged) return judged;
  }
  return (await supabase.from('rooms').select('game_state').eq('id', roomId).single()).data?.game_state ?? null;
}
export async function POST(request: Request) {
  try {
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return jsonError('Authentication is required', 401);
    const actorId = await actorFromToken(bearer);
    if (!actorId) return jsonError('Authentication is required', 401);
    const body = await request.json() as {action?: Action; roomId?: string; hintsPerRound?: number; hint?: string; answer?: string};
    const actions: Action[] = ['initialize','hint','answer','topic','guess','judge','next-round','resume'];
    if (!body.roomId || !body.action || !actions.includes(body.action)) return jsonError('Unsupported action');
    const supabase = serviceClient();
    const membership = await supabase.rpc('ai_barenai_is_member', {
      p_room_id: body.roomId,
      p_actor_id: actorId,
    });
    if (membership.error || membership.data !== true) {
      return jsonError('Room membership is required', 403);
    }
    let data: unknown;
    if (body.action === 'initialize') {
      const topic = pickAiBarenaiTopic();
      const result = await supabase.rpc('ai_barenai_initialize', {p_room_id: body.roomId, p_actor_id: actorId, p_hints_per_round: body.hintsPerRound, p_topic: topic.answer, p_aliases: topic.aliases});
      if (result.error) throw result.error; data = result.data;
    } else if (body.action === 'hint') {
      const result = await supabase.rpc('ai_barenai_submit_hint', {p_room_id: body.roomId, p_actor_id: actorId, p_hint: body.hint});
      if (result.error) throw result.error; data = await ensureProgress(supabase, body.roomId, actorId) ?? result.data;
    } else if (body.action === 'answer') {
      const result = await supabase.rpc('ai_barenai_submit_answer', {p_room_id: body.roomId, p_actor_id: actorId, p_answer: body.answer});
      if (result.error) throw result.error; data = await ensureProgress(supabase, body.roomId, actorId) ?? result.data;
    } else if (body.action === 'topic') {
      const result = await supabase.rpc('ai_barenai_get_topic', {p_room_id: body.roomId, p_actor_id: actorId});
      if (result.error) return jsonError('お題を表示できません', 403);
      return Response.json({answer: result.data});
    } else if (body.action === 'next-round') {
      const result = await supabase.rpc('ai_barenai_next_round', {p_room_id: body.roomId, p_actor_id: actorId});
      if (result.error) throw result.error; data = result.data;
    } else if (body.action === 'judge') {
      data = await autoJudge(supabase, body.roomId, actorId);
    } else {
      data = await ensureProgress(supabase, body.roomId, actorId);
    }
    return Response.json({data});
  } catch (error) { return jsonError(error instanceof Error ? error.message : 'ゲーム操作に失敗しました'); }
}
