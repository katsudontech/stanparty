'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';
import { KANA_ROWS, previewWord, type PrivateState } from './rules';
import './style.css';
function errorMessage(value: unknown): string { return value && typeof value === 'object' && 'message' in value ? String(value.message) : '通信状況を確認して再試行してください'; }
function useAiueGame(room: RoomState) {
  const supabase = useMemo(() => createClient(), []);
  const [privateState, setPrivateState] = useState<PrivateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const initializeInFlight = useRef(false);

  const callApi = useCallback(async (payload: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('認証セッションが切れています');
    const response = await fetch('/api/aiue-battle', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ roomId: room.id, ...payload }) });
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
  const snapshotAvailable = room.status === 'finished' || publicGame === 'aiue-battle';

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
    const channel = supabase.channel(`aiue-battle-${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => { void refresh().catch((caught: unknown) => setError(errorMessage(caught))); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh().catch((caught: unknown) => setError(errorMessage(caught))); });
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, room.id, supabase]);

  const action = useCallback(async (actionType: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    try {
      const data = await callApi({ action: actionType, matchId: privateState?.matchId ?? null, expectedRevision: privateState?.revision ?? null, actionId: crypto.randomUUID(), ...payload });
      acceptSnapshot(data);
      return true;
    } catch (caught: unknown) { await refresh().catch(() => {}); setError(errorMessage(caught) + '。最新の状態で、もう一度確定してください。'); return false; }
    finally { inFlight.current = false; }
  }, [acceptSnapshot, callApi, privateState, refresh]);

  const retry = () => { void refresh().catch((caught: unknown) => setError(errorMessage(caught))); };
  return { state: privateState, error, action, retry, initialize, snapshotAvailable };
}

export function AiueBattleGame({ roomState, myUserId, onBackToLobby }: { roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void> }) {
  const { state, error, action, retry, initialize, snapshotAvailable } = useAiueGame(roomState);
  const [custom, setCustom] = useState('');
  const [word, setWord] = useState('');
  const [preview, setPreview] = useState<string[] | null>(null);
  const [validation, setValidation] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const host = roomState.host_id === myUserId;
  const name = (id: string) => id === myUserId ? 'あなた' : roomState.players.find(p => p.userId === id)?.name ?? 'プレイヤー';
  const run = async (kind: string, value?: string) => { setBusy(true); try { const ok = await action(kind, { value }); if (ok) { setSelected(null); setPreview(null); } } finally { setBusy(false); } };
  if (!state) return <main className="aiue-game paper-card p-5"><h1>あいうえバトル</h1><p>2〜8人で秘密の言葉を守ろう。自分の言葉も攻撃されます。</p><p>最初の攻撃が当たればもう1回。外れたら次の人へ。</p>{error && <p role="alert">{error}</p>}{!snapshotAvailable && host ? <button className="button-primary" disabled={busy} onClick={async () => { setBusy(true); try { await initialize(); } catch {} finally { setBusy(false); } }}>お題を選ぶ</button> : <><p>ゲームを読み込んでいます…</p><button className="button-secondary" onClick={retry}>再読み込み</button></>}</main>;
  const current = state.turnOrder[state.currentPlayerIndex];
  const canAttack = state.phase === 'playing' && current === myUserId && !state.players[myUserId].eliminated;
  return <main className={'aiue-game aiue-game--' + state.phase}>
    <header className="aiue-hud"><span className="section-kicker">あいうえバトル</span><h1>{state.theme || 'お題を選ぼう'}</h1>{state.phase === 'playing' && <p><strong>{name(current)}の手番</strong> · {state.attackNumber}回目の攻撃{state.attackNumber === 2 ? '（最後）' : ''}</p>}</header>
    {(error || validation) && <p className="aiue-alert" role="alert">{error || validation}{error && <button type="button" onClick={retry}>再読み込み</button>}</p>}
    {state.phase === 'theme' && <section className="paper-card p-5"><h2>ランダム候補：{state.candidate}</h2>{host ? <><div className="flex gap-2 my-3"><button className="button-secondary" disabled={busy} onClick={() => void run('reroll')}>別のお題を引く</button><button className="button-primary" disabled={busy} onClick={() => void run('theme', state.candidate)}>このお題に決定</button></div><label>自由なお題<input className="input" maxLength={80} value={custom} onChange={e => setCustom(e.target.value)} /></label><button className="button-primary mt-3" disabled={busy || !custom.trim()} onClick={() => void run('theme', custom)}>入力したお題に決定</button></> : <p>ホストがお題を決めています</p>}</section>}
    {state.phase === 'words' && <section className="paper-card p-5"><h2>秘密の言葉を決めよう</h2><p>2〜7文字。濁点・半濁点は除き、小文字は大文字に変換します。伸ばし棒「ー」は残ります。足りないマスは自分だけに×で表示されます。</p>{state.players[myUserId].ready ? <div><p>登録しました。ほかの人を待っています。</p><div className="aiue-cells my-3">{state.myCells?.map((c, i) => <span key={i}>{c}</span>)}</div></div> : <><label>あなたにだけ見える言葉<input autoComplete="off" className="input" value={word} onChange={e => { setWord(e.target.value); try { setPreview(previewWord(e.target.value)); setValidation(''); } catch (caught) { setPreview(null); setValidation(e.target.value ? errorMessage(caught) : ''); } }} /></label>{preview && <div><div className="aiue-cells my-3">{preview.map((c, i) => <span key={i}>{c}</span>)}</div><p>この言葉で登録しますか？</p><button className="button-primary" disabled={busy} onClick={() => void run('word', word)}>この言葉を確定</button></div>}</>}<p className="mt-3">登録済み {state.turnOrder.filter(id => state.players[id].ready).length}/{state.turnOrder.length}人</p></section>}
    {(state.phase === 'playing' || state.phase === 'finished') && <>
      {state.lastAttack && <p className="aiue-attack-result" role="status" key={state.lastAttack.id}>{name(state.lastAttack.actorId)}：「{state.lastAttack.kana}」 {state.lastAttack.hit ? 'ヒット！' : 'はずれ'}{state.lastAttack.bonus && state.phase === 'playing' && state.attackNumber === 2 && current === state.lastAttack.actorId ? ' もう1回攻撃できます' : ''}</p>}
      {state.phase === 'finished' && <section className="paper-card p-4"><h2>{state.winnerId ? name(state.winnerId) + 'の勝利！' : '全員脱落・引き分け！'}</h2>{host && <button className="button-primary" onClick={() => void onBackToLobby()}>再戦する</button>}</section>}
      <AiueBoards state={state} myUserId={myUserId} name={name} />
      {state.phase === 'playing' && <section className="aiue-keyboard" aria-label="攻撃する文字"><div className="aiue-confirm"><strong>{canAttack ? selected ? '「' + selected + '」で攻撃？' : '文字を選んでください' : '手番を待っています'}</strong><button className="button-primary" disabled={!canAttack || !selected || busy || state.usedKana.includes(selected)} onClick={() => selected && void run('attack', selected)}>{selected ? '「' + selected + '」で攻撃' : '文字を選択'}</button></div><div className="aiue-kana">{KANA_ROWS.flat().map((c, index) => c === ' ' ? <span key={'blank-' + index} aria-hidden="true" /> : <button type="button" key={c} aria-pressed={selected === c} disabled={!canAttack || busy || state.usedKana.includes(c)} onClick={() => setSelected(c)}>{c}</button>)}</div></section>}
    </>}
    <details className="mt-4"><summary>ルール</summary><p>全員の同じ文字がすべて開きます。自分も対象です。1回目が当たると2回目、2回目の後は必ず次の人へ。自分が脱落したときは追加攻撃できません。残り1人で勝利、0人なら引き分けです。×は攻撃できません。</p></details>
  </main>;
}

export function AiueBoards({ state, myUserId, name }: { state: PrivateState; myUserId: string; name: (id: string) => string }) { return (<section className="aiue-boards" aria-label="みんなの7マス">{state.turnOrder.map(id => <article key={id} className={'aiue-board ' + (id === state.turnOrder[state.currentPlayerIndex] ? 'is-current ' : '') + (state.players[id].eliminated ? 'is-eliminated' : '')}><h2>{name(id)} {state.players[id].eliminated ? '脱落' : ''}</h2><div className="aiue-cells">{state.players[id].cells.map((publicCell, i) => <span key={state.lastAttack?.revealed[id]?.includes(i) ? state.lastAttack.id + i : i} className={(publicCell ? 'is-public ' : '') + (state.lastAttack?.revealed[id]?.includes(i) ? 'is-flipping' : '')}>{publicCell ?? (id === myUserId ? state.myCells?.[i] : null) ?? '?'}</span>)}</div>{id === myUserId && <small>色つきは全員に公開済み</small>}</article>)}</section>); }
