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
  if (!state) return <AiueStartScreen
    host={host} busy={busy} snapshotAvailable={snapshotAvailable} error={error} onRetry={retry}
    onInitialize={async () => { setBusy(true); try { await initialize(); } catch { /* Error is displayed by the start screen. */ } finally { setBusy(false); } }}
  />;
  const current = state.turnOrder[state.currentPlayerIndex];
  const canAttack = state.phase === 'playing' && current === myUserId && !state.players[myUserId].eliminated;
  return <main className={'aiue-game aiue-game--' + state.phase}>
    <header className="aiue-hud"><span className="section-kicker">あいうえバトル</span><h1>{state.theme || 'お題を選ぼう'}</h1>{state.phase === 'playing' && <p><strong>{name(current)}の手番</strong> · {state.attackNumber}回目の攻撃{state.attackNumber === 2 ? '（最後）' : ''}</p>}</header>
    {error && <p className="aiue-alert" role="alert">{error}<button type="button" onClick={retry}>再読み込み</button></p>}
    {(state.phase === 'theme' || state.phase === 'words') && <AiueSetupSteps phase={state.phase} />}
    {state.phase === 'theme' && <AiueThemeSetup
      candidate={state.candidate} host={host} busy={busy} custom={custom} onCustomChange={setCustom}
      onReroll={() => void run('reroll')} onSelect={theme => void run('theme', theme)}
    />}
    {state.phase === 'words' && <AiueWordSetup
      word={word} preview={preview} validation={validation} ready={state.players[myUserId].ready}
      myCells={state.myCells} readyCount={state.turnOrder.filter(id => state.players[id].ready).length}
      playerCount={state.turnOrder.length} busy={busy}
      onChange={value => {
        setWord(value); setValidation('');
        try { setPreview(previewWord(value)); } catch { setPreview(null); }
      }}
      onValidate={() => {
        if (!word) return;
        try { previewWord(word); setValidation(''); } catch (caught) { setValidation(errorMessage(caught)); }
      }}
      onConfirm={() => void run('word', word)}
    />}
    {(state.phase === 'playing' || state.phase === 'finished') && <>
      {state.lastAttack && <p className="aiue-attack-result" role="status" key={state.lastAttack.id}>{name(state.lastAttack.actorId)}：「{state.lastAttack.kana}」 {state.lastAttack.hit ? 'ヒット！' : 'はずれ'}{state.lastAttack.bonus && state.phase === 'playing' && state.attackNumber === 2 && current === state.lastAttack.actorId ? ' もう1回攻撃できます' : ''}</p>}
      {state.phase === 'finished' && <AiueResult winnerName={state.winnerId ? name(state.winnerId) : null} host={host} onBackToLobby={() => void onBackToLobby()} />}
      <AiueBoards state={state} myUserId={myUserId} name={name} />
      {state.phase === 'playing' && <section className="aiue-keyboard" aria-label="攻撃する文字"><div className="aiue-confirm"><strong>{canAttack ? selected ? '「' + selected + '」で攻撃？' : '文字を選んでください' : '手番を待っています'}</strong><button className="button-primary" disabled={!canAttack || !selected || busy || state.usedKana.includes(selected)} onClick={() => selected && void run('attack', selected)}>{selected ? '「' + selected + '」で攻撃' : '文字を選択'}</button></div><div className="aiue-kana">{KANA_ROWS.flat().map((c, index) => c === ' ' ? <span key={'blank-' + index} aria-hidden="true" /> : <button type="button" key={c} aria-pressed={selected === c} disabled={!canAttack || busy || state.usedKana.includes(c)} onClick={() => setSelected(c)}>{c}</button>)}</div></section>}
    </>}
    <details className="mt-4"><summary>ルール</summary><p>全員の同じ文字がすべて開きます。自分も対象です。1回目が当たると2回目、2回目の後は必ず次の人へ。自分が脱落したときは追加攻撃できません。残り1人で勝利、0人なら引き分けです。×は攻撃できません。</p></details>
  </main>;
}

export function AiueBoards({ state, myUserId, name }: { state: PrivateState; myUserId: string; name: (id: string) => string }) { return (<section className="aiue-boards" aria-label="みんなの7マス">{state.turnOrder.map(id => <article key={id} className={'aiue-board ' + (id === state.turnOrder[state.currentPlayerIndex] ? 'is-current ' : '') + (state.players[id].eliminated ? 'is-eliminated' : '')}><h2>{name(id)} {state.players[id].eliminated ? '脱落' : ''}</h2><div className="aiue-cells">{state.players[id].cells.map((publicCell, i) => <span key={state.lastAttack?.revealed[id]?.includes(i) ? state.lastAttack.id + i : i} className={(publicCell ? 'is-public ' : '') + (state.lastAttack?.revealed[id]?.includes(i) ? 'is-flipping' : '')}>{publicCell ?? (id === myUserId ? state.myCells?.[i] : null) ?? '?'}</span>)}</div>{id === myUserId && <small>色つきは全員に公開済み</small>}</article>)}</section>); }

function AiueSetupSteps({ phase }: { phase: 'theme' | 'words' }) {
  return <ol className="aiue-setup-steps" aria-label="ゲームの準備">
    {['お題を選ぶ', '言葉を決める', 'バトル'].map((label, index) => <li key={label} aria-current={index === (phase === 'theme' ? 0 : 1) ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}
  </ol>;
}

export function AiueStartScreen({ host, busy, snapshotAvailable, error, onInitialize, onRetry }: {
  host: boolean; busy: boolean; snapshotAvailable: boolean; error: string | null;
  onInitialize: () => Promise<void>; onRetry: () => void;
}) {
  return <main className="aiue-game aiue-start">
    <header className="aiue-setup-intro"><p className="section-kicker">ことば × 推理 · 2〜8人</p><h1>あいうえバトル</h1><p>一文字ずつ、みんなの秘密を探ろう。</p></header>
    <AiueSetupSteps phase="theme" />
    <section className="paper-card aiue-setup-card">
      <h2>{snapshotAvailable ? error ? '接続を確認してください' : 'ゲームを読み込んでいます' : 'まずは、みんなのお題から'}</h2>
      <p className="aiue-help">お題に合う言葉を隠して、一文字ずつ攻撃。自分の言葉を守り、最後まで残れば勝利です。</p>
      {error && <p className="aiue-alert" role="alert">{error}</p>}
      {!snapshotAvailable && host ? <button type="button" className="button-primary aiue-setup-primary" disabled={busy} aria-busy={busy} onClick={() => void onInitialize()}>{busy ? '準備しています…' : 'お題を選ぶ'}</button> : !snapshotAvailable ? <p className="aiue-waiting" role="status">ホストがお題選びを始めるまでお待ちください。</p> : error ? <button type="button" className="button-secondary" onClick={onRetry}>再読み込み</button> : <p className="aiue-waiting" role="status">最新のゲーム状態を取得しています…</p>}
    </section>
  </main>;
}

export function AiueThemeSetup({ candidate, host, busy, custom, onCustomChange, onReroll, onSelect }: {
  candidate: string; host: boolean; busy: boolean; custom: string; onCustomChange: (value: string) => void;
  onReroll: () => void; onSelect: (theme: string) => void;
}) {
  return <div className="aiue-setup-stack">
    <section className="paper-card aiue-setup-card">
      <div className="aiue-section-heading"><span className="section-kicker">STEP 1</span><h2>みんなのお題を選ぼう</h2><p className="aiue-help">このお題に合う言葉を、それぞれ考えます。</p></div>
      <div className="aiue-theme-candidate"><span>今回の候補</span><strong>{candidate}</strong></div>
      {host ? <div className="aiue-theme-actions"><button type="button" className="button-primary" disabled={busy} onClick={() => onSelect(candidate)}>このお題に決定</button><button type="button" className="button-secondary" disabled={busy} onClick={onReroll}>別のお題を引く</button></div> : <p className="aiue-waiting" role="status">ホストがお題を選んでいます。</p>}
    </section>
    {host && <section className="paper-card aiue-setup-card aiue-custom-theme">
      <h2>自分たちでお題を作る</h2><p className="aiue-help">好きなテーマがあるときはこちら。</p>
      <label className="aiue-field" htmlFor="aiue-custom-theme">自由なお題<input id="aiue-custom-theme" className="aiue-input" maxLength={80} placeholder="例：旅行に持っていくもの" value={custom} onChange={event => onCustomChange(event.target.value)} /></label>
      <button type="button" className="button-secondary aiue-setup-primary" disabled={busy || !custom.trim()} onClick={() => onSelect(custom)}>入力したお題に決定</button>
    </section>}
  </div>;
}

export function AiueWordSetup({ word, preview, validation, ready, myCells, readyCount, playerCount, busy, onChange, onValidate, onConfirm }: {
  word: string; preview: string[] | null; validation: string; ready: boolean; myCells: string[] | null;
  readyCount: number; playerCount: number; busy: boolean; onChange: (value: string) => void; onValidate: () => void; onConfirm: () => void;
}) {
  const composing = useRef(false);
  return <section className="paper-card aiue-setup-card">
    <div className="aiue-section-heading"><span className="section-kicker">STEP 2 · あなたにだけ表示</span><h2>{ready ? '秘密の言葉を登録しました' : '秘密の言葉を決めよう'}</h2><p className="aiue-help">{ready ? 'ほかの人の登録が終わると、バトルが始まります。' : 'お題に合う言葉を、ひらがな・カタカナで2〜7文字。'}</p></div>
    {ready ? <div className="aiue-private-preview"><p>あなたの言葉</p><div className="aiue-cells">{myCells?.map((cell, index) => <span key={index}>{cell}</span>)}</div></div> : <>
      <label className="aiue-field" htmlFor="aiue-secret-word">あなたの言葉<input id="aiue-secret-word" className="aiue-input" autoComplete="off" placeholder="例：バナナ" value={word} aria-describedby="aiue-word-hint" aria-invalid={Boolean(validation)} onChange={event => onChange(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onBlur={() => { if (!composing.current) onValidate(); }} /></label>
      <p id="aiue-word-hint" className="aiue-help aiue-input-hint">{preview ? '下の7マスを確認して、確定してください。' : '2〜7文字を入力すると、変換後の7マスがここに表示されます。'}</p>
      {validation && <p className="aiue-field-error" role="alert">{validation}</p>}
      <div className="aiue-private-preview"><p>登録される7マス <span>自分だけに見えます</span></p><div className="aiue-cells" aria-label="変換後の言葉">{(preview ?? Array(7).fill('・')).map((cell, index) => <span key={index}>{cell}</span>)}</div></div>
      <button type="button" className="button-primary aiue-setup-primary" disabled={busy || !preview} onClick={onConfirm}>{busy ? '登録しています…' : 'この言葉を確定'}</button>
      <details className="aiue-word-help"><summary>文字の変換ルールと例</summary><p>濁点・半濁点は取り除き、小さい文字は大きくします。「ー」はそのままです。</p><p>バナナ → はなな ／ おちゃ → おちや</p><p>足りないマスの「×」は自分だけに表示されます。</p></details>
    </>}
    <p className="aiue-ready-status" role="status"><strong>{readyCount} / {playerCount}人</strong> が登録済み{ready && <span>あなたの準備は完了です</span>}</p>
  </section>;
}

export function AiueResult({ winnerName, host, onBackToLobby }: { winnerName: string | null; host: boolean; onBackToLobby: () => void }) {
  return <section className="paper-card aiue-setup-card"><h2>{winnerName ? winnerName + 'の勝利！' : '全員脱落・引き分け！'}</h2>{host && <button type="button" className="button-primary aiue-setup-primary" onClick={onBackToLobby}>ロビーに戻る</button>}</section>;
}
