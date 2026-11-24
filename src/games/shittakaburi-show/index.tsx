'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';
import { rankings, type PrivateState } from './rules';
import './style.css';
function errorMessage(value: unknown): string { return value && typeof value === 'object' && 'message' in value ? String(value.message) : '通信状況を確認して再試行してください'; }
function useShittakaburiGame(room: RoomState) {
  const supabase = useMemo(() => createClient(), []);
  const [privateState, setPrivateState] = useState<PrivateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const initializeInFlight = useRef(false);

  const callApi = useCallback(async (payload: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('認証セッションが切れています');
    const response = await fetch('/api/shittakaburi-show', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ roomId: room.id, ...payload }) });
    const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
    if (!response.ok) throw new Error(body.error ?? 'ゲーム操作に失敗しました');
    return body.data;
  }, [room.id, supabase]);

  const acceptSnapshot = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const snapshot = data as PrivateState;
    setPrivateState(previous => previous?.matchId === snapshot.matchId && previous.revision > snapshot.revision ? previous : snapshot);
    setError(null);
  }, []);

  const publicGame = room.game_state && typeof room.game_state === 'object'
    ? (room.game_state as { game?: unknown }).game
    : null;
  const snapshotAvailable = room.status === 'finished' || publicGame === 'shittakaburi-show';

  const refresh = useCallback(async () => {
    if (!snapshotAvailable) return;
    acceptSnapshot(await callApi({ action: 'snapshot' }));
  }, [acceptSnapshot, callApi, snapshotAvailable]);

  const initialize = useCallback(async () => {
    if (initializeInFlight.current) return;
    initializeInFlight.current = true;
    setError(null);
    try {
      acceptSnapshot(await callApi({ action: 'initialize' }));
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      throw caught;
    } finally {
      initializeInFlight.current = false;
    }
  }, [acceptSnapshot, callApi]);

  useEffect(() => {
    if (!snapshotAvailable) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refresh(); }).catch((caught: unknown) => { if (!cancelled) setError(errorMessage(caught)); });
    return () => { cancelled = true; };
  }, [refresh, room.game_state, snapshotAvailable]);

  useEffect(() => {
    const reconnect = () => { void refresh().catch(() => {}); };
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    return () => { window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', reconnect); };
  }, [refresh]);

  useEffect(() => {
    const channel = supabase.channel(`shittakaburi-show-${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => { void refresh().catch((caught: unknown) => setError(errorMessage(caught))); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh().catch((caught: unknown) => setError(errorMessage(caught))); });
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, room.id, supabase]);

  const action = useCallback(async (actionType: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    try {
      const data = await callApi({ action: actionType, matchId: privateState?.matchId ?? null, expectedRevision: privateState?.revision ?? null, round: privateState?.round, phase: privateState?.phase, actionId: crypto.randomUUID(), ...payload });
      acceptSnapshot(data);
      return true;
    } catch (caught: unknown) { await refresh().catch(() => {}); setError(errorMessage(caught) + '。最新の状態で、もう一度確定してください。'); return false; }
    finally { inFlight.current = false; }
  }, [acceptSnapshot, callApi, privateState, refresh]);

  const retry = () => { void refresh().catch((caught: unknown) => setError(errorMessage(caught))); };
  return { state: privateState, error, action, retry, initialize, snapshotAvailable };
}

export function ShittakaburiShowGame({ roomState, myUserId, onBackToLobby }: { roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void> }) {
  const { state, error, action, retry, initialize, snapshotAvailable } = useShittakaburiGame(roomState);
  return <ShittakaburiShowScreen roomState={roomState} myUserId={myUserId} onBackToLobby={onBackToLobby} state={state} error={error} action={action} retry={retry} initialize={initialize} snapshotAvailable={snapshotAvailable} />;
}

export function ShittakaburiShowScreen({roomState,myUserId,onBackToLobby,state,error,action,retry,initialize,snapshotAvailable}: {
  roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void>; state: PrivateState | null;
  error: string | null; action: (kind:string,payload?:Record<string,unknown>) => Promise<boolean>;
  retry: () => void; initialize: () => Promise<void>; snapshotAvailable: boolean;
}) {
  const [word, setWord] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const host = roomState.host_id === myUserId;
  const name = (id: string) => roomState.players.find(player => player.userId === id)?.name ?? 'プレイヤー';
  const run = async (kind: string, value?: string) => { setBusy(true); try { if (await action(kind, { value })) setSelected(''); } finally { setBusy(false); } };
  return <main className="shitta-game">
    <header><p className="section-kicker">ことば × ブラフ · 3〜14人</p><h1>知ったかぶりショー</h1>{state && state.round > 0 && <p>第{state.round}ラウンド / 全{state.turnOrder.length}題</p>}</header>
    {error && <p role="alert">{error} <button type="button" className="button-secondary" onClick={retry}>再読み込み</button></p>}
    {!state ? <section className="paper-card"><h2>{snapshotAvailable ? 'ゲームを読み込んでいます' : '秘密の言葉でショーを始めよう'}</h2>{!snapshotAvailable && host ? <button className="button-primary" disabled={busy} onClick={async () => { setBusy(true); try { await initialize(); } catch { /* Displayed above. */ } finally { setBusy(false); } }}>言葉の登録を始める</button> : <p role="status">{snapshotAvailable ? '最新の状態を取得しています…' : 'ホストの開始を待っています'}</p>}</section> : <>
      {state.phase === 'words' && <section className="paper-card"><h2>秘密の言葉を1つ登録</h2><p>自分だけが意味を知っていそうな言葉を考えよう。同じ言葉でも別の投稿として扱います。</p>{state.ready.includes(myUserId) ? <p>登録済み：{state.myWord}。全員の登録を待っています。</p> : <form onSubmit={event => { event.preventDefault(); void run('word', word); }}><label htmlFor="shitta-word">あなたの言葉</label><input id="shitta-word" value={word} maxLength={80} autoComplete="off" onChange={event => setWord(event.target.value)} /><button className="button-primary" disabled={busy || !word.trim()}>この言葉を確定</button></form>}<ul>{state.turnOrder.map(id => <li key={id}>{name(id)}：{state.ready.includes(id) ? '登録済み' : '考え中'}</li>)}</ul></section>}
      {state.phase !== 'words' && <section className="paper-card"><p>今回の言葉</p><h2 className="shitta-word">{state.word}</h2></section>}
      {(state.phase === 'discussion' || state.phase === 'voting') && <section className="paper-card"><p className="shitta-role">あなたが{state.isAuthor ? '出題者です。本当の意味を説明してください。' : '知ったかぶり役です。意味を知っているふりで説明しましょう。'}</p><p>対面の会話や、別の通話アプリで順番に説明してください。この画面に音声機能はありません。全員の発表後は自由に質問し合ってから投票へ。</p><h2>発表順</h2><ol>{state.speakingOrder.map(id => <li key={id}>{name(id)}{id === myUserId ? '（あなた）' : ''}</li>)}</ol>{state.phase === 'discussion' && (host ? <button className="button-primary" disabled={busy} onClick={() => void run('start-vote')}>話し合いを終えて投票へ</button> : <p>全員が話し終えたら、ホストが投票を始めます。</p>)}</section>}
      {state.phase === 'voting' && <section className="paper-card"><h2>{state.isAuthor ? 'いちばん本当っぽい解説をしたのは誰？' : 'この単語を出したのは誰？'}</h2><p>自分以外に1票。確定後の変更はできません。</p>{state.voted.includes(myUserId) ? <p role="status">投票済み。全員の投票を待っています。</p> : <><div className="shitta-options">{state.turnOrder.filter(id => id !== myUserId).map(id => <button className="button-secondary" key={id} disabled={busy} aria-pressed={selected === id} onClick={() => setSelected(id)}>{name(id)}</button>)}</div><button className="button-primary" disabled={busy || !selected} onClick={() => void run('vote', selected)}>投票を確定</button></>}<ul>{state.turnOrder.map(id => <li key={id}>{name(id)}：{state.voted.includes(id) ? '投票済み' : '投票中'}</li>)}</ul></section>}
      {state.votes && <section className="paper-card"><h2>投票結果</h2><ul>{state.turnOrder.map(id => <li key={id}>{name(id)} → {name(state.votes![id])}</li>)}</ul><h3>得票数</h3><ul>{state.turnOrder.map(id => <li key={id}>{name(id)}：{state.counts?.[id]}票</li>)}</ul>{state.phase === 'votes' && <p>まずは票の集まり方を見てみよう。出題者と得点はこのあと公開します。</p>}{state.phase === 'votes' && host && <button className="button-primary" disabled={busy} onClick={() => void run('reveal-author')}>出題者を発表</button>}</section>}
      {state.authorId && <section className="paper-card"><h2>本当の出題者は {name(state.authorId)}</h2></section>}
      {state.scores && <section className="paper-card"><h2>{state.phase === 'finished' ? '最終ランキング' : '今回の得点と累計ランキング'}</h2><ol className="shitta-ranking">{rankings(state.scores).map(row => <li key={row.id}><strong>{row.rank}位 {name(row.id)}</strong> <span>{row.score}点（今回 +{state.roundPoints?.[row.id] ?? 0}）<small> {state.counts?.[row.id] ?? 0}票 × {row.id === state.authorId ? 1 : 2}点{row.id !== state.authorId ? ` ＋ 正解${state.votes?.[row.id] === state.authorId ? 1 : 0}点` : ''} ＝ {state.roundPoints?.[row.id] ?? 0}点</small></span></li>)}</ol>{state.phase === 'scores' && host && <div className="shitta-options"><button className="button-primary" disabled={busy} onClick={() => void run('next')}>{state.round === state.turnOrder.length ? '最終結果へ' : '次のお題へ'}</button>{state.round < state.turnOrder.length && <button className="button-secondary" disabled={busy} onClick={() => void run('end')}>ここで終了</button>}</div>}{state.phase === 'finished' && (host ? <button className="button-primary" disabled={busy} onClick={async () => { setBusy(true); try { await onBackToLobby(); } finally { setBusy(false); } }}>ロビーに戻る・もう一度遊ぶ</button> : <p>ホストがロビーに戻すのを待っています。</p>)}</section>}
    </>}
    <details><summary>ルールと得点</summary><p>全員の投稿から未使用の言葉をランダムで1つ選びます。出題者以外も意味を知っているふりで発表。全員が自分以外に投票します。出題者は得票×1点、ほかの人は得票×2点＋出題者への正解投票で1点。票を公開した後、出題者と得点を一緒に公開します。全投稿を使ったら終了し、累計得点で競います。同点は同順位です。</p></details>
  </main>;
}
