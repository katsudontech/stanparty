'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';
import { normalizeAiBarenaiDrawingState } from '../types';
export function useAiBarenaiDrawingGame(room:RoomState) {
 const state=normalizeAiBarenaiDrawingState(room.game_state); const [error,setError]=useState<string|null>(null);
 const call=useCallback(async(action:string,payload:Record<string,unknown>={})=>{const {data}=await createClient().auth.getSession();const token=data.session?.access_token;if(!token)throw new Error('認証セッションがありません');const res=await fetch('/api/ai-barenai-drawing',{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,roomId:room.id,...payload})});const json=await res.json() as {error?:string;data?:unknown;answer?:string};if(!res.ok)throw new Error(json.error||'操作に失敗しました');return json.data ?? json;},[room.id]);
 const act=useCallback(async(action:string,payload:Record<string,unknown>={})=>{setError(null);try{return await call(action,payload);}catch(e){setError(e instanceof Error?e.message:'操作に失敗しました');throw e;}},[call]);
  useEffect(() => {
   if (state.phase !== 'answering') return;
   const timer = window.setInterval(() => { void act('resume').catch(() => {}); }, 8000);
   return () => window.clearInterval(timer);
  }, [act, state.phase]);
 const initialize = useCallback(() => act('initialize'), [act]);
 const judge = useCallback((snapshot: string) => act('judge', { snapshot }), [act]);
 const answer = useCallback((value: string) => act('answer', { answer: value }), [act]);
 const continueDrawing = useCallback(() => act('continue'), [act]);
 const topic = useCallback(() => act('topic'), [act]);
 return { state, error, initialize, judge, answer, continueDrawing, topic };
}
