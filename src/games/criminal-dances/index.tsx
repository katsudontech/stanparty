'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RoomState } from '@/games/core/types';
import { CARD_DESCRIPTIONS, CARD_LABELS } from './rules';
import type { CriminalDancesCardType, CriminalDancesPrivateState } from './types';

type Props = { roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void> };

function errorMessage(value: unknown): string {
  if (value && typeof value === 'object' && 'message' in value) return String(value.message);
  return 'ゲーム操作に失敗しました。通信状況を確認してください。';
}

function cardLabel(type: CriminalDancesCardType): string { return CARD_LABELS[type] ?? type; }

export function CardConfirmation({ allowed, trade, onConfirm }: { allowed: boolean; trade: boolean; onConfirm: () => void }) {
  return <button className="button-primary mt-3" type="button" disabled={!allowed} onClick={onConfirm}>{trade ? '渡すカードを確定' : '使う'}</button>;
}

export function resultLabel(state: CriminalDancesPrivateState, playerId: string): string {
  if (state.outcome?.winners.includes(playerId)) return '勝利';
  if (state.outcome?.reason === 'culprit_escaped') return '敗北';
  if (state.outcome?.culpritPlayerId === playerId || state.outcome?.conspirators.includes(playerId)) return '敗北';
  return 'その他';
}

function privateCardRule(state: CriminalDancesPrivateState, playerId: string, card: { id: string; type: CriminalDancesCardType }) {
  if (state.phase !== 'playing') return { allowed: false, reason: 'ゲームは終了しています' };
  if (state.pending) return { allowed: false, reason: '処理中の効果を完了してください' };
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) return { allowed: false, reason: 'あなたの手番ではありません' };
  if (!state.firstDiscovererPlayed) return card.type === 'first_discoverer' && playerId === state.firstDiscovererPlayerId ? { allowed: true } : { allowed: false, reason: '最初は第一発見者を出してください' };
  if (card.type === 'culprit' && state.myHand.length !== 1) return { allowed: false, reason: '犯人は最後の1枚のときだけ出せます' };
  if (card.type === 'detective' && state.round < 2 && state.myHand.some((candidate) => candidate.id !== card.id && candidate.type !== 'detective' && (candidate.type !== 'culprit' || state.myHand.length === 1))) return { allowed: false, reason: '探偵は2巡目以降に使えます' };
  return { allowed: true };
}

function useCriminalDancesGame(room: RoomState, myUserId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [privateState, setPrivateState] = useState<CriminalDancesPrivateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);


  const callApi = useCallback(async (payload: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('認証セッションが切れています');
    const response = await fetch('/api/criminal-dances', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ roomId: room.id, ...payload }) });
    const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
    if (!response.ok) throw new Error(body.error ?? 'ゲーム操作に失敗しました');
    return body.data;
  }, [room.id, supabase]);

  const acceptSnapshot = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const snapshot = data as CriminalDancesPrivateState;
    setPrivateState(previous => previous?.matchId === snapshot.matchId && previous.revision > snapshot.revision ? previous : snapshot);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const publicState = room.game_state as { game?: string } | null;
    if (room.status === 'playing' && room.host_id === myUserId && publicState?.game !== 'criminal-dances') {
      acceptSnapshot(await callApi({ action: 'initialize' }));
    } else {
      acceptSnapshot(await callApi({ action: 'snapshot' }));
    }
  }, [acceptSnapshot, callApi, myUserId, room.game_state, room.host_id, room.status]);

  useEffect(() => {
    if (room.status !== 'playing' && room.status !== 'finished') return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refresh(); }).catch((caught: unknown) => { if (!cancelled) setError(errorMessage(caught)); });
    return () => { cancelled = true; };
  }, [refresh, room.status]);

  useEffect(() => {
    const reconnect = () => { void refresh().catch(() => {}); };
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    return () => { window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', reconnect); };
  }, [refresh]);

  useEffect(() => {
    const channel = supabase.channel(`criminal-dances-${room.id}`)
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
    } catch (caught: unknown) { setError(errorMessage(caught)); void refresh().catch(() => {}); return false; }
    finally { inFlight.current = false; }
  }, [acceptSnapshot, callApi, privateState, refresh]);

  const retry = () => { void refresh().catch((caught: unknown) => setError(errorMessage(caught))); };
  return { state: privateState, error, action, retry };
}

export function CriminalDancesGame({ roomState, myUserId, onBackToLobby }: Props) {
  const { state, error, action, retry } = useCriminalDancesGame(roomState, myUserId);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [incidentText, setIncidentText] = useState('');
  const currentId = state?.turnOrder[state.currentPlayerIndex];
  const isTurn = currentId === myUserId;
  const pending = state?.pending;

  if (!state) return <main className="criminal-dances-game paper-card p-5"><p className="section-kicker">犯人は踊る</p><h1 className="mt-2 text-2xl font-black">{error ? 'ゲーム状態を読み込めません' : 'ゲームを準備中…'}</h1><p className="mt-2 text-sm text-[var(--muted)]">{error ?? 'ホストの開始処理を待っています。'}</p><div className="mt-4 flex flex-wrap gap-2"><button className="button-primary" type="button" onClick={retry}>再読み込み</button>{roomState.host_id === myUserId && <button className="button-secondary" type="button" onClick={() => void onBackToLobby()}>ゲームを中断</button>}</div></main>;
  const selected = state.myHand.find((card) => card.id === selectedCard) ?? null;
  const selectedRule = selected ? privateCardRule(state, myUserId, selected) : null;
  const isMyPending = Boolean(pending && 'actorId' in pending && pending.actorId === myUserId);
  const eligibleTargets = pending && 'eligibleTargetIds' in pending ? pending.eligibleTargetIds ?? [] : [];
  const dogCount = pending?.kind === 'dog_card' ? pending.cardCount ?? 0 : 0;
  const playerName = (id: string) => roomState.players.find((player) => player.userId === id)?.name ?? 'プレイヤー';
  const submittedIds = pending && 'submittedPlayerIds' in pending ? pending.submittedPlayerIds ?? [] : [];
  const rightPlayerId = state.turnOrder[(state.turnOrder.indexOf(myUserId) - 1 + state.turnOrder.length) % state.turnOrder.length];
  const simultaneousCount = pending?.kind === 'information_control' ? state.myHand.length : pending?.kind === 'rumor' ? state.players[rightPlayerId]?.handCount ?? 0 : 0;
  const isHost = roomState.host_id === myUserId;
  const outcome = state.outcome;
  const tradeAlreadySubmitted = submittedIds.includes(myUserId);
  const isTradeParticipant = pending?.kind === 'trade' && (pending.actorId === myUserId || pending.targetId === myUserId);
  const canSubmitTrade = Boolean(isTradeParticipant && pending?.kind === 'trade' && pending.targetId && !tradeAlreadySubmitted);
  const submit = async () => {
    if (!selected) return;
    if (!selectedRule?.allowed && !canSubmitTrade) return;
    if (isTradeParticipant) { if (!canSubmitTrade) return; await action('trade_card', { cardId: selected.id }); }
    else { await action('play_card', { cardId: selected.id, incidentText: incidentText.trim() || null }); }
    setSelectedCard(null);
  };
  return <main className="criminal-dances-game mx-auto w-full max-w-3xl px-3 pb-8">
    <header className="paper-card mb-3 p-4"><p className="section-kicker">犯人は踊る</p><h1 className="mt-1 text-2xl font-black">カードを出して、犯人を追え</h1><p className="mt-2 text-sm text-[var(--muted)]">{state.round}巡目 · {isTurn ? 'あなたの手番' : `${currentId ? playerName(currentId) : '次の人'}の手番`}</p></header>
    {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
    {state.incidentText && <section className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm"><strong>事件内容</strong><p className="mt-1">{state.incidentText}</p></section>}{state.lastAction && <section className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm"><strong>直前の行動</strong><p className="mt-1">{playerName(state.lastAction.actorId)}: {state.lastAction.text}</p>{state.revealedCardType && <p className="mt-1 font-bold">公開されたカード: {cardLabel(state.revealedCardType)}</p>}</section>}
    <section className="paper-card mb-3 p-3" aria-label="プレイヤー一覧"><h2 className="font-black">座席順 <span className="text-xs font-normal">次の番号が左隣・次の手番</span></h2><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{state.turnOrder.map((id, index) => { const player = state.players[id]; return <div key={id} className={`rounded-xl border p-2 ${index === state.currentPlayerIndex ? 'border-[var(--orange)] bg-orange-50' : 'border-[var(--line)]'}`}><strong>{id === myUserId ? 'あなた' : playerName(id)}</strong><span className="ml-2 text-sm text-[var(--muted)]">手札 {player.handCount}枚</span>{player.played.at(-1) && <small className="mt-1 block text-[var(--muted)]">最後: {cardLabel(player.played.at(-1)!)}</small>}{player.played.length > 0 && <details className="mt-1 text-xs"><summary className="cursor-pointer font-bold">履歴（{player.played.length}枚）</summary><div className="mt-1 space-y-0.5">{player.played.map((cardType, cardIndex) => <span className="mr-1 inline-block" key={`${id}-${cardIndex}`}>{cardLabel(cardType)}</span>)}</div></details>}{player.conspirator && <small className="mt-1 block font-bold text-red-700">たくらみ済み</small>}</div>; })}</div></section>
    {state.phase === 'playing' && !pending && isTurn && <p role="status" className="mb-3 rounded-xl bg-orange-100 p-3 font-bold">あなたの手番です。手札を選んで「使う」を押してください。</p>}
    {pending && <section className="mb-3 rounded-2xl border-2 border-[var(--orange)] bg-orange-50 p-4" role="status"><strong>待っている操作</strong><p className="mt-1 text-sm">{pending.kind === 'information_control' ? (submittedIds.includes(myUserId) ? 'カードを渡しました。ほかの参加者を待っています。' : '左隣へ渡すカードを選んでください。') : pending.kind === 'rumor' ? (submittedIds.includes(myUserId) ? '右隣から引くカードを選びました。' : '右隣から引く裏向きカードを選んでください。') : pending.kind === 'trade' ? (pending.targetId === myUserId ? (tradeAlreadySubmitted ? '渡すカードを選びました。相手を待っています。' : 'あなたの手札から渡すカードを選んでください。') : pending.actorId === myUserId ? (pending.targetId ? (tradeAlreadySubmitted ? '渡すカードを選びました。相手を待っています。' : 'あなたの手札から渡すカードを選んでください。') : '取り引き相手を選んでください。') : '取り引きのカードを待っています。') : isMyPending ? 'あなたの操作を選んでください。' : 'ほかの参加者の操作を待っています。'}</p>{(pending.kind === 'information_control' || pending.kind === 'rumor') && !submittedIds.includes(myUserId) && simultaneousCount > 0 && <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: simultaneousCount }, (_, index) => <button className="button-secondary" type="button" key={index} onClick={() => void action('simultaneous_choice', pending.kind === 'information_control' ? { cardId: state.myHand[index]?.id } : { cardIndex: index })}>{pending.kind === 'information_control' ? cardLabel(state.myHand[index]?.type ?? 'civilian') : `右隣の裏向きカード ${index + 1}`}</button>)}</div>}{isMyPending && (pending.kind === 'boy_reveal' || pending.kind === 'witness_reveal') && <button className="button-primary mt-3" type="button" onClick={() => void action('confirm_private_reveal')}>確認して続ける</button>}{isMyPending && pending.kind === 'dog_card' && <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: dogCount }, (_, index) => <button className="button-secondary" type="button" key={index} onClick={() => void action('choose_dog_card', { cardIndex: index })}>裏向きカード {index + 1}</button>)}</div>}{pending && 'eligibleTargetIds' in pending && isMyPending && <div className="mt-3 flex flex-wrap gap-2">{eligibleTargets.map((id) => <button className="button-secondary" type="button" key={id} onClick={() => void action('select_target', { targetId: id })}>{playerName(id)}を指名</button>)}</div>}</section>}
    {state.privateReveal && <section className="paper-card mb-3 border-2 border-blue-300 p-4"><h2 className="font-black">秘密の確認</h2>{state.privateReveal.kind === 'boy' ? <p className="mt-2">犯人カードを持つ人: <strong>{state.privateReveal.culpritPlayerId === myUserId ? 'あなた' : state.privateReveal.culpritPlayerId ? playerName(state.privateReveal.culpritPlayerId) : '不明'}</strong></p> : <div className="mt-2 flex flex-wrap gap-2">{state.privateReveal.cards?.map((card) => <span className="rounded-full bg-blue-50 px-3 py-1 text-sm" key={card.id}>{cardLabel(card.type)}</span>)}</div>}</section>}
    {state.phase === 'finished' && outcome && <section className="paper-card mb-3 border-2 border-[var(--orange)] p-5"><h2 className="text-2xl font-black">{outcome.reason === 'culprit_escaped' ? '犯人が逃げ切った！' : outcome.reason === 'dog_caught' ? 'いぬが犯人を捕まえた！' : '探偵が犯人を捕まえた！'}</h2><p className="mt-2">犯人: {outcome.culpritPlayerId === myUserId ? 'あなた' : outcome.culpritPlayerId ? playerName(outcome.culpritPlayerId) : '不明'}</p><p className="mt-1">たくらみ: {outcome.conspirators.length ? outcome.conspirators.map((id) => id === myUserId ? 'あなた' : playerName(id)).join('、') : 'なし'}</p><p className="mt-1">勝者: {outcome.winners.length ? outcome.winners.map((id) => id === myUserId ? 'あなた' : playerName(id)).join('、') : '勝者なし'}</p><div className="mt-3 space-y-1 border-t border-[var(--line)] pt-3 text-sm">{state.turnOrder.map((id) => <p key={id}><strong>{id === myUserId ? 'あなた' : playerName(id)}</strong>: {resultLabel(state, id)}</p>)}</div>{isHost && <button className="button-primary mt-4" type="button" onClick={() => void onBackToLobby()}>再戦する</button>}</section>}
    <details className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm"><summary className="cursor-pointer font-black">カード効果を見る</summary><p className="mt-2">3〜8人・各4枚。第一発見者から左隣へ進み、全員の最初の手番が終わると2巡目です。手札0枚の手番は飛ばしますが、交換の受け取りは続きます。</p><p className="mt-2">探偵は2巡目から使用できます。1巡目に他の合法なカードがなければ、効果なしで捨てられます。犯人は最後の1枚を自分の手番に出すと逃げ切ります。</p><p className="mt-2">逃げ切りでは犯人とたくらみ済みの人が勝利。捕まえた場合は捕まえた人だけが勝利し、犯人とたくらみ済みの人は敗北、残りは「その他」です。たくらみ済みの人が捕まえたときは勝者なしです。</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{(Object.keys(CARD_LABELS) as CriminalDancesCardType[]).map((type) => <p key={type}><strong>{cardLabel(type)}</strong>: {CARD_DESCRIPTIONS[type]}</p>)}</div></details>
    {state.phase === 'playing' && <section className="paper-card p-4"><h2 className="font-black">あなたの手札</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{state.myHand.map((card) => { const rule = privateCardRule(state, myUserId, card); return <button type="button" key={card.id} onClick={() => setSelectedCard(card.id)} className={`min-h-28 rounded-2xl border-2 p-3 text-left ${selectedCard === card.id ? 'border-[var(--orange)] bg-orange-50' : 'border-[var(--line)]'}`}><strong className="block">{cardLabel(card.type)}</strong><small className="mt-2 block text-[var(--muted)]">{CARD_DESCRIPTIONS[card.type]}</small>{!rule.allowed && !canSubmitTrade && <small className="mt-2 block font-bold text-red-700">{rule.reason}</small>}</button>; })}</div>{selected && <div className="mt-4 rounded-xl bg-[var(--paper)] p-3"><p className="font-bold">{cardLabel(selected.type)}を{canSubmitTrade ? '渡しますか？' : '使いますか？'}</p><p className="mt-1 text-sm text-[var(--muted)]">{CARD_DESCRIPTIONS[selected.type]}</p>{selected.type === 'first_discoverer' && <input className="input mt-3 w-full" value={incidentText} maxLength={200} onChange={(event) => setIncidentText(event.target.value)} placeholder="事件内容（省略可）" />}{(isTurn || canSubmitTrade) && <CardConfirmation allowed={Boolean(selectedRule?.allowed || canSubmitTrade)} trade={canSubmitTrade} onConfirm={() => void submit()} />}</div>}</section>}
    {isHost && <button className="button-secondary mt-4" type="button" onClick={() => void onBackToLobby()}>ゲームを中断してロビーへ戻る</button>}
  </main>;
}

