'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RoomState } from '@/games/core/types';
import { GameWrapper } from '@/games/core/GameWrapper';
import { usePinchHintGame } from './hooks/usePinchHintGame';
import { getPinchDraftKey, parsePinchDraft } from './draft';
import type { PinchGameState } from './types';
import type { PinchItem } from './items';
import { getSharedRank } from './rules';

interface Props { headerActions?: React.ReactNode; roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void>; onRefreshRoom?: () => Promise<void> }

export function PinchHintGame({ roomState, myUserId, onBackToLobby, onRefreshRoom, headerActions }: Props) {
  const { state, privateState, privateLoading, error, setError, initialize, prepare, reveal, finishPresentation, vote, nextTurn } = usePinchHintGame(roomState);
  const [rounds, setRounds] = useState<1 | 2 | 3>(state.rounds as 1 | 2 | 3);
  const [selected, setSelected] = useState<string[]>(privateState.selection ?? []);
  const [draftIdentity, setDraftIdentity] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isHost = roomState.host_id === myUserId;
  const isPresenter = state.currentPlayerId === myUserId;
  const playerName = (id: string | null) => roomState.players.find((player) => player.userId === id)?.name ?? '参加者';
  const orderedHand = useMemo(() => privateState.hand, [privateState.hand]);

  useEffect(() => {
    if (privateLoading) return;
    const draftKey = getPinchDraftKey(roomState.id, state.matchId, state.turnIndex, myUserId);
    let draft: string | null = null;
    try { draft = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null; } catch { /* storage can be unavailable in private browsing */ }
    const timer = window.setTimeout(() => {
      const allowedIds = new Set(privateState.hand.map((item) => item.id));
      const restored = parsePinchDraft(draft).filter((itemId) => allowedIds.has(itemId)).slice(0, state.requiredCount);
      const serverSelection = privateState.selection?.filter((itemId) => allowedIds.has(itemId)).slice(0, state.requiredCount) ?? null;
      setSelected(serverSelection ?? restored);
      setDraftIdentity(draftKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [myUserId, privateLoading, privateState.hand, privateState.selection, roomState.id, state.matchId, state.requiredCount, state.turnIndex]);

  useEffect(() => {
    if (!isPresenter || state.phase !== 'turn_setup' || typeof window === 'undefined') return;
    const draftKey = getPinchDraftKey(roomState.id, state.matchId, state.turnIndex, myUserId);
    if (draftIdentity !== draftKey) return;
    try { window.localStorage.setItem(draftKey, JSON.stringify(selected)); } catch { /* storage can be unavailable in private browsing */ }
  }, [draftIdentity, isPresenter, myUserId, roomState.id, selected, state.matchId, state.phase, state.turnIndex]);

  useEffect(() => {
    if (!onRefreshRoom) return;
    const refresh = () => { void onRefreshRoom(); };
    const visibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visibility); };
  }, [onRefreshRoom]);

  const act = async (operation: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(null);
    try { await operation(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : '操作に失敗しました'); } finally { busyRef.current = false; setBusy(false); }
  };

  const toggleItem = (id: string) => {
    if (!isPresenter || state.phase !== 'turn_setup') return;
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < state.requiredCount ? [...current, id] : current);
  };
  const moveSelected = (index: number, delta: -1 | 1) => {
    setSelected((current) => { const next = [...current]; const target = index + delta; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  };

  if (state.phase === 'rule_setting') return (
    <GameWrapper headerActions={headerActions} players={roomState.players} myUserId={myUserId}>
      <section className="pinch-game mx-auto w-full max-w-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-4 shadow-[5px_5px_0_var(--line)] sm:p-7">
        <GameHeading subtitle="PINCH &amp; HINT">ピンチにひらめき！</GameHeading>
        <div className="mt-6 border-2 border-[var(--line)] bg-[var(--yellow)] p-4 sm:p-6">
          <h2 className="text-xl font-black">ラウンド数を選ぶ</h2><p className="mt-2 text-sm font-bold text-[var(--muted)]">全員が1回ずつ回答することを1ラウンドとします。</p>
          <div className="mt-5 grid grid-cols-3 gap-2">{([1, 2, 3] as const).map((value) => <button key={value} type="button" disabled={!isHost} onClick={() => setRounds(value)} aria-pressed={rounds === value} className={`min-h-12 border-2 border-[var(--line)] px-2 py-3 text-lg font-black ${rounds === value ? 'bg-[var(--orange)] text-white' : 'bg-white'} disabled:cursor-not-allowed disabled:opacity-60`}>{value}ラウンド</button>)}</div>
        </div>
        {isHost ? <button type="button" disabled={busy} onClick={() => act(() => initialize(rounds))} className="button-primary mt-5 min-h-12 w-full text-lg">ゲームを始める →</button> : <p className="mt-5 border-2 border-dashed border-[#b9b5a8] p-4 text-center font-bold text-[var(--muted)]">ホストがラウンド数を決めています…</p>}
        {isHost && <button type="button" onClick={() => void onBackToLobby()} className="mt-4 min-h-11 w-full font-black text-[var(--muted)] underline underline-offset-4">ロビーへ戻る</button>}
        <ErrorMessage message={error} />
      </section>
    </GameWrapper>
  );

  if (state.phase === 'finished') return (
    <GameWrapper headerActions={headerActions} players={roomState.players} myUserId={myUserId}>
      <section className="pinch-game mx-auto w-full max-w-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-4 shadow-[5px_5px_0_var(--line)] sm:p-7"><GameHeading subtitle="FINAL SCORE">最終ランキング</GameHeading><Ranking state={state} players={roomState.players} />{isHost && <button type="button" onClick={() => void onBackToLobby()} className="button-primary mt-6 min-h-12 w-full">ロビーへ戻る</button>}</section>
    </GameWrapper>
  );

  return (
    <GameWrapper headerActions={headerActions} players={roomState.players} myUserId={myUserId} showPlayerBar={state.phase !== 'presenting' && state.phase !== 'voting'}>
      <section className="pinch-game mx-auto w-full max-w-3xl border-2 border-[var(--line)] bg-[var(--surface)] p-3 shadow-[5px_5px_0_var(--line)] sm:p-7">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--line)] pb-4"><div><p className="text-xs font-black tracking-[.2em] text-[var(--orange)]">PINCH &amp; HINT</p><h1 className="mt-1 text-2xl font-black tracking-[-.05em] sm:text-3xl">ピンチにひらめき！</h1></div><div className="text-right text-sm font-black text-[var(--muted)]">{state.round} / {state.rounds}ラウンド<br />{state.turnIndex + 1} / {state.totalTurns}ターン</div></header>
        <div className="mt-4 flex items-center justify-between gap-2 border-b border-[#c8c6b9] pb-3 text-sm font-black"><span>回答者：<strong>{playerName(state.currentPlayerId)}</strong></span><span>使用 {state.requiredCount}個</span></div>
        <article className="mt-4 border-2 border-[var(--line)] bg-[var(--yellow)] p-4 sm:p-6"><p className="text-xs font-black tracking-[.15em] text-[var(--muted)]">今回のピンチ</p><p className="mt-2 text-xl font-black leading-relaxed sm:text-2xl">{state.topic}</p></article>
        {state.phase === 'turn_setup' && <SetupPhase isPresenter={isPresenter} state={state} hand={orderedHand} selected={selected} privateLoading={privateLoading} busy={busy} onToggle={toggleItem} onMove={moveSelected} onStart={() => act(() => prepare(selected, state.turnIndex, state.matchId))} />}
        {state.phase === 'presenting' && <PresentPhase key={`${state.matchId}-${state.turnIndex}-${state.revealedItems.length}`} isPresenter={isPresenter} state={state} playerName={playerName(state.currentPlayerId)} busy={busy} onReveal={() => act(() => reveal(state.revealedItems.length, state.turnIndex, state.matchId))} onFinish={() => act(() => finishPresentation(state.turnIndex, state.matchId))} />}
        {state.phase === 'voting' && <VotePhase isPresenter={isPresenter} hasVoted={privateState.vote !== null} state={state} busy={busy} onVote={(choice) => act(() => vote(choice, state.turnIndex, state.matchId))} />}
        {state.phase === 'result' && <ResultPhase state={state} players={roomState.players} isHost={isHost} busy={busy} onNext={() => act(() => nextTurn(state.turnIndex, state.matchId))} />}
        <ErrorMessage message={error} />
      </section>
    </GameWrapper>
  );
}

function GameHeading({ subtitle, children }: { subtitle: string; children: React.ReactNode }) { return <header><p className="text-xs font-black tracking-[.2em] text-[var(--orange)]">{subtitle}</p><h1 className="mt-2 text-3xl font-black tracking-[-.06em] sm:text-4xl">{children}</h1><p className="mt-3 text-sm font-bold leading-6 text-[var(--muted)]">アイテムの使い方をひらめき、みんなの「アリ」を勝ち取ろう。</p></header>; }
function ErrorMessage({ message }: { message: string | null }) { return message ? <p className="mt-4 border-2 border-[var(--orange)] bg-[#fff0e6] p-3 text-sm font-black text-[#9f3d26]" role="alert">{message}</p> : null; }
function SetupPhase({ isPresenter, state, hand, selected, privateLoading, busy, onToggle, onMove, onStart }: { isPresenter: boolean; state: PinchGameState; hand: PinchItem[]; selected: string[]; privateLoading: boolean; busy: boolean; onToggle: (id: string) => void; onMove: (i: number, d: -1 | 1) => void; onStart: () => void }) {
  return <div className="mt-5"><h2 className="text-lg font-black">{isPresenter ? `手札から${state.requiredCount}個を選ぼう` : '回答者が作戦を考えています'}</h2>{isPresenter ? privateLoading ? <p className="mt-4 p-4 text-center font-bold text-[var(--muted)]">手札を読み込んでいます…</p> : <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{hand.map((item) => <button key={item.id} type="button" onClick={() => onToggle(item.id)} aria-pressed={selected.includes(item.id)} className={`min-h-20 border-2 border-[var(--line)] p-3 text-left ${selected.includes(item.id) ? 'bg-[var(--orange)] text-white' : 'bg-white'}`}><span className="text-2xl" aria-hidden="true">{item.icon}</span><span className="mt-1 block text-sm font-black">{item.name}</span></button>)}</div><div className="mt-4 border-2 border-dashed border-[#b9b5a8] p-3"><p className="text-sm font-black">使う順番（{selected.length}/{state.requiredCount}）</p>{selected.length === 0 ? <p className="mt-2 text-sm font-bold text-[var(--muted)]">カードをタップして選択</p> : selected.map((id, index) => { const item = hand.find((entry) => entry.id === id); return <div key={id} className="mt-2 flex items-center gap-2 border border-[var(--line)] bg-white p-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--orange)] text-sm font-black text-white">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-black">{item?.icon} {item?.name}</span><button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} className="min-h-11 min-w-11 border border-[var(--line)] font-black" aria-label="上へ">↑</button><button type="button" disabled={index === selected.length - 1} onClick={() => onMove(index, 1)} className="min-h-11 min-w-11 border border-[var(--line)] font-black" aria-label="下へ">↓</button></div> })}</div><button type="button" disabled={busy || selected.length !== state.requiredCount} onClick={onStart} className="button-primary mt-4 min-h-12 w-full">回答を開始する →</button></> : <p className="mt-4 border-2 border-dashed border-[#b9b5a8] p-5 text-center font-bold text-[var(--muted)]">{state.requiredCount}個のアイテムを選択中…</p>}</div>;
}
function PresentPhase({ isPresenter, state, playerName, busy, onReveal, onFinish }: { isPresenter: boolean; state: ReturnType<typeof import('./types').normalizePinchState>; playerName: string; busy: boolean; onReveal: () => void; onFinish: () => void }) { const latest = state.revealedItems[state.revealedItems.length - 1]; return <div className="mt-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{playerName}のひらめき</h2><span className="text-sm font-black text-[var(--muted)]">残り {state.requiredCount - state.revealedItems.length}個</span></div>{latest && <div className="pinch-latest-card pinch-item-pop mt-5 border-2 border-[var(--line)] bg-[var(--orange)] p-6 text-center text-white" aria-live="polite"><span className="block text-6xl" aria-hidden="true">{latest.icon}</span><strong className="mt-2 block text-2xl">{latest.name}</strong><span className="mt-1 block text-xs font-black tracking-[.18em]">ITEM {latest.revealedAt + 1}</span></div>}<div className="mt-4 grid gap-3">{state.revealedItems.map((item) => <div key={`${item.id}-${item.revealedAt}`} className="flex items-center gap-3 border-2 border-[var(--line)] bg-white p-3"><span className="text-3xl" aria-hidden="true">{item.icon}</span><span className="font-black">{item.name}</span></div>)}</div>{state.revealedItems.length < state.requiredCount ? isPresenter ? <button type="button" disabled={busy} onClick={onReveal} className="pinch-reveal-button mt-5 min-h-32 w-full border-2 border-[var(--line)] bg-[var(--orange)] p-4 text-xl font-black text-white shadow-[4px_4px_0_var(--line)] active:translate-y-1 active:shadow-none">タップして次のアイテムを公開<br /><span className="text-sm">説明しながら押してね</span></button> : <p className="mt-5 border-2 border-dashed border-[#b9b5a8] p-5 text-center font-bold text-[var(--muted)]">回答者が説明中…</p> : isPresenter ? <button type="button" disabled={busy} onClick={onFinish} className="button-primary mt-5 min-h-12 w-full">説明終了 →</button> : <p className="mt-5 text-center text-sm font-bold text-[var(--muted)]">説明終了を待っています…</p>}</div>; }
function VotePhase({ isPresenter, hasVoted, state, busy, onVote }: { isPresenter: boolean; hasVoted: boolean; state: ReturnType<typeof import('./types').normalizePinchState>; busy: boolean; onVote: (choice: 'yes' | 'no') => void }) { return <div className="mt-5"><h2 className="text-xl font-black">この解決策は…？</h2><p className="mt-2 text-sm font-bold text-[var(--muted)]">回答者以外のみ投票できます。全員の投票後に結果が出ます。</p><RevealedList state={state} />{isPresenter ? <p className="mt-5 border-2 border-dashed border-[#b9b5a8] p-5 text-center font-bold text-[var(--muted)]">みんなの判定を待っています…</p> : hasVoted ? <p className="mt-5 bg-[var(--yellow)] p-5 text-center font-black">投票しました。ほかの人を待っています…</p> : <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={busy} onClick={() => onVote('yes')} className="min-h-24 border-2 border-[var(--line)] bg-[#dff3dc] text-2xl font-black">アリ<br /><span className="text-sm">ひらめいた！</span></button><button type="button" disabled={busy} onClick={() => onVote('no')} className="min-h-24 border-2 border-[var(--line)] bg-[#ffe2d5] text-2xl font-black">ナシ<br /><span className="text-sm">もう一声…</span></button></div>}<p className="mt-4 text-right text-sm font-black text-[var(--muted)]">投票済み {state.votedPlayerIds.length} / {state.turnOrder.length - 1}</p></div>; }
function RevealedList({ state }: { state: ReturnType<typeof import('./types').normalizePinchState> }) { return <div className="mt-4"><p className="text-sm font-black text-[var(--muted)]">公開されたアイテム</p><div className="mt-2 flex flex-wrap gap-2">{state.revealedItems.map((item) => <span key={`${item.id}-${item.revealedAt}`} className="border border-[var(--line)] bg-white px-3 py-2 text-sm font-black">{item.icon} {item.name}</span>)}</div></div>; }
function ResultPhase({ state, players, isHost, busy, onNext }: { state: ReturnType<typeof import('./types').normalizePinchState>; players: RoomState['players']; isHost: boolean; busy: boolean; onNext: () => void }) { const result = state.result; return <div className="mt-5"><div className={`border-2 border-[var(--line)] p-5 text-center ${result?.success ? 'bg-[#dff3dc]' : 'bg-[#ffe2d5]'}`}><p className="text-sm font-black tracking-[.2em]">{result?.success ? 'SUCCESS' : 'FAILED'}</p><h2 className="mt-2 text-3xl font-black">{result?.success ? 'アリ！ +1ポイント' : '今回はナシ…'}</h2><p className="mt-3 font-bold">アリ {result?.yes ?? 0}票 / ナシ {result?.no ?? 0}票</p></div><RevealedList state={state} /><div className="mt-4 grid grid-cols-2 gap-2">{players.map((player) => <div key={player.userId} className="border border-[#c8c6b9] bg-white p-3 text-sm font-black">{player.name}<span className="float-right">{state.scores[player.userId] ?? 0}pt</span></div>)}</div>{isHost ? <button type="button" disabled={busy} onClick={onNext} className="button-primary mt-5 min-h-12 w-full">{state.turnIndex + 1 >= state.totalTurns ? '最終結果を見る →' : '次の回答者へ →'}</button> : <p className="mt-5 border-2 border-dashed border-[#b9b5a8] p-4 text-center font-bold text-[var(--muted)]">ホストが次のターンを進めています…</p>}</div>; }
function Ranking({ state, players }: { state: PinchGameState; players: RoomState['players'] }) { const ranked = [...players].sort((a, b) => (state.scores[b.userId] ?? 0) - (state.scores[a.userId] ?? 0)); const allScores = ranked.map((player) => state.scores[player.userId] ?? 0); return <ol className="mt-6 space-y-2">{ranked.map((player) => { const currentScore = state.scores[player.userId] ?? 0; const rank = getSharedRank(currentScore, allScores); return <li key={player.userId} className="flex items-center gap-3 border-b border-[#c8c6b9] p-3"><strong className="w-8 text-2xl font-black text-[var(--orange)]">{rank}</strong><span className="min-w-0 flex-1 truncate font-black">{player.name}</span><span className="font-black">{currentScore}pt</span></li>; })}</ol>; }
