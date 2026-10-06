'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

function useCriminalDancesGame(room: RoomState) {
  const supabase = useMemo(() => createClient(), []);
  const [privateState, setPrivateState] = useState<CriminalDancesPrivateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const initializeInFlight = useRef(false);

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

  const publicGame = room.game_state && typeof room.game_state === 'object'
    ? (room.game_state as { game?: unknown }).game
    : null;
  const snapshotAvailable = room.status === 'finished' || publicGame === 'criminal-dances';

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
  return { state: privateState, error, action, retry, initialize, snapshotAvailable };
}

export function CriminalDancesStartScreen({
  isHost,
  busy,
  error,
  players,
  onStart,
}: {
  isHost: boolean;
  busy: boolean;
  players: RoomState['players'];
  error: string | null;
  onStart: () => Promise<void>;
}) {
  const motifCards: CriminalDancesCardType[] = ['first_discoverer', 'culprit', 'detective'];
  return <main className="criminal-dances-game criminal-dances-start">
    <div className="criminal-dances-start__hero">
      <div className="criminal-dances-start__cards" aria-hidden="true">
        {motifCards.map((type) => <span className={'criminal-card criminal-card--' + type + ' criminal-dances-start__motif'} key={type}>
          <span className="criminal-card__corner">{CARD_GLYPHS[type]}</span>
          <span className="criminal-card__name">{cardLabel(type)}</span>
          <span className="criminal-card__type">効果</span>
        </span>)}
      </div>
      <p className="section-kicker">PARTY CARD GAME</p>
      <h1>犯人は踊る</h1>
      <p className="criminal-dances-start__tagline">最後の1枚まで、犯人を追え。</p>
      <p className="criminal-dances-start__summary">カードを出して、秘密を読み合い、犯人の逃走を止めよう。</p>
    </div>
    <div className="criminal-dances-start__badges" aria-label="ゲーム情報">
      <span><b>{players.length}人</b>でプレイ</span>
      <span><b>4枚</b>スタート</span>
      <span><b>座席順</b>に進行</span>
    </div>
    <ol className="criminal-dances-start__steps" aria-label="遊び方">
      <li><b>1</b><span>第一発見者が事件を始める</span></li>
      <li><b>2</b><span>カードの効果で探る</span></li>
      <li><b>3</b><span>犯人を捕まえる／逃げ切る</span></li>
    </ol>
    <section className="criminal-dances-start__players" aria-labelledby="criminal-start-players">
      <h2 id="criminal-start-players">参加者 <span>{players.length}/8</span></h2>
      <ol>{players.map((player, index) => <li key={player.userId}><span>{index + 1}</span>{player.name}</li>)}</ol>
    </section>
    {error && <p className="criminal-dances-start__error" role="alert">{error}</p>}
    {isHost ? <button className="button-primary criminal-dances-start__button" type="button" disabled={busy} aria-busy={busy} onClick={() => void onStart()}>{busy ? '準備中…' : 'ゲームを始める'}</button> : <p className="criminal-dances-start__waiting" role="status">ホストが開始するまでお待ちください</p>}
  </main>;
}

const CARD_GLYPHS: Record<CriminalDancesCardType, string> = {
  first_discoverer: '!',
  culprit: '♠',
  detective: '⌕',
  alibi: '✓',
  conspiracy: '◎',
  boy: '♙',
  dog: '🐕',
  witness: '◉',
  trade: '⇄',
  information_control: '↔',
  rumor: '…',
  civilian: '●',
};

export function CriminalDancesCardTile({
  card,
  selected,
  disabled,
  reason,
  onSelect,
}: {
  card: { id: string; type: CriminalDancesCardType };
  selected: boolean;
  disabled: boolean;
  reason?: string;
  onSelect: () => void;
}) {
  const label = cardLabel(card.type);
  return <button
    type="button"
    className={'criminal-card criminal-card--' + card.type + (selected ? ' is-selected' : '')}
    aria-pressed={selected}
    aria-disabled={disabled}
    aria-label={label + (disabled && reason ? '（' + reason + '）' : '')}
    title={disabled ? reason : label + 'を選ぶ'}
    onClick={onSelect}
  >
    <span className="criminal-card__corner" aria-hidden="true">{CARD_GLYPHS[card.type]}</span>
    <span className="criminal-card__name">{label}</span>
    <span className="criminal-card__type" aria-hidden="true">{card.type === 'civilian' ? '市民' : '効果'}</span>
  </button>;
}

export function CriminalDancesLastPlayedCard({
  card,
  actorName,
}: {
  card: { actorId: string; cardType: CriminalDancesCardType } | null;
  actorName: string;
}) {
  return <section className={'criminal-last-played' + (card ? '' : ' is-empty')} aria-label="最後に使ったカード">
    <span className="criminal-last-played__label">最後に使ったカード</span>
    {card ? <>
      <div className={'criminal-card criminal-card--' + card.cardType + ' criminal-card--battle criminal-last-played__card'}>
        <span className="criminal-card__corner" aria-hidden="true">{CARD_GLYPHS[card.cardType]}</span>
        <span className="criminal-card__battle-glyph" aria-hidden="true">{CARD_GLYPHS[card.cardType]}</span>
        <span className="criminal-card__name">{cardLabel(card.cardType)}</span>
        <span className="criminal-card__type">公開カード</span>
      </div>
      <p><b>{actorName}</b> が出した</p>
    </> : <p className="criminal-last-played__placeholder">最初のカードを待っています</p>}
  </section>;
}

export function CriminalDancesModal({
  title,
  labelledBy,
  onClose,
  children,
}: {
  title: string;
  labelledBy?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal !== 'function') {
      dialog.setAttribute('open', '');
      return;
    }
    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      // Older browsers can still render the dialog as a regular open element.
    }
  }, []);
  return <dialog
    ref={dialogRef}
    className="criminal-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledBy}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section className="criminal-modal__panel">
      <header className="criminal-modal__header">
        <h2 id={labelledBy}>{title}</h2>
        <button className="criminal-modal__close" type="button" aria-label="閉じる" onClick={onClose}>×</button>
      </header>
      <div className="criminal-modal__body">{children}</div>
    </section>
  </dialog>;
}

function pendingText(
  pending: NonNullable<CriminalDancesPrivateState['pending']>,
  myUserId: string,
  submittedIds: string[],
  tradeAlreadySubmitted: boolean,
  isMyPending: boolean,
) {
  if (pending.kind === 'information_control') return submittedIds.includes(myUserId) ? 'カードを渡しました。ほかの参加者を待っています。' : '左隣へ渡すカードを選んでください。';
  if (pending.kind === 'rumor') return submittedIds.includes(myUserId) ? '右隣から引くカードを選びました。' : '右隣から引く裏向きカードを選んでください。';
  if (pending.kind === 'trade') {
    if (pending.targetId === myUserId) return tradeAlreadySubmitted ? '渡すカードを選びました。相手を待っています。' : 'あなたの手札から渡すカードを選んでください。';
    if (pending.actorId === myUserId) return pending.targetId
      ? (tradeAlreadySubmitted ? '渡すカードを選びました。相手を待っています。' : 'あなたの手札から渡すカードを選んでください。')
      : '取り引き相手を選んでください。';
    return '取り引きのカードを待っています。';
  }
  return isMyPending ? 'あなたの操作を選んでください。' : 'ほかの参加者の操作を待っています。';
}

export function CriminalDancesSecret({
  reveal,
  culpritName,
  canConfirm,
  onConfirm,
}: {
  reveal: NonNullable<CriminalDancesPrivateState['privateReveal']>;
  culpritName: string;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  return <section className="criminal-secret" role="status" aria-live="polite">
    <strong>あなたにだけ見える情報</strong>
    {reveal.kind === 'boy'
      ? <p>犯人カードを持つ人：<b>{culpritName}</b></p>
      : <div className="criminal-secret__cards">{reveal.cards?.map((card) => <span key={card.id}>{cardLabel(card.type)}</span>)}</div>}
    {canConfirm && <button className="button-primary criminal-pending__primary" type="button" onClick={onConfirm}>確認して続ける</button>}
  </section>;
}

export function CriminalDancesGame({ roomState, myUserId, onBackToLobby }: Props) {
  const { state, error, action, retry, initialize, snapshotAvailable } = useCriminalDancesGame(roomState);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [incidentText, setIncidentText] = useState('');
  const [starting, setStarting] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const currentId = state?.turnOrder[state.currentPlayerIndex];
  const isTurn = currentId === myUserId;
  const pending = state?.pending;

  if (!state && !snapshotAvailable) return <CriminalDancesStartScreen
    isHost={roomState.host_id === myUserId}
    busy={starting}
    error={error}
    players={roomState.players}
    onStart={async () => {
      setStarting(true);
      try { await initialize(); } catch { /* displayed below */ } finally { setStarting(false); }
    }}
  />;
  if (!state) return <main className="criminal-dances-game paper-card p-5"><p className="section-kicker">犯人は踊る</p><h1 className="mt-2 text-2xl font-black">{error ? 'ゲーム状態を読み込めません' : 'ゲームを読み込んでいます…'}</h1><p className="mt-2 text-sm text-[var(--muted)]">{error ?? 'ホストの開始処理を待っています。'}</p><div className="mt-4 flex flex-wrap gap-2"><button className="button-primary" type="button" onClick={retry}>再読み込み</button></div></main>;

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
  const lastPlayedCard = state.lastPlayedCard ?? (state.lastAction?.cardType ? { actorId: state.lastAction.actorId, cardType: state.lastAction.cardType } : null);
  const submit = async () => {
    if (!selected) return;
    if (!selectedRule?.allowed && !canSubmitTrade) return;
    if (isTradeParticipant) {
      if (!canSubmitTrade) return;
      await action('trade_card', { cardId: selected.id });
    } else {
      await action('play_card', { cardId: selected.id, incidentText: incidentText.trim() || null });
    }
    setSelectedCard(null);
  };

  const renderPendingChoices = () => {
    if (!pending) return null;
    if ((pending.kind === 'information_control' || pending.kind === 'rumor') && !submittedIds.includes(myUserId) && simultaneousCount > 0) {
      return <div className="criminal-pending__choices">{Array.from({ length: simultaneousCount }, (_, index) => <button className="criminal-choice" type="button" key={index} onClick={() => void action('simultaneous_choice', pending.kind === 'information_control' ? { cardId: state.myHand[index]?.id } : { cardIndex: index })}>{pending.kind === 'information_control' ? cardLabel(state.myHand[index]?.type ?? 'civilian') : '右隣の裏向きカード ' + (index + 1)}</button>)}</div>;
    }
    if (isMyPending && (pending.kind === 'boy_reveal' || pending.kind === 'witness_reveal') && !state.privateReveal) return <button className="button-primary criminal-pending__primary" type="button" onClick={() => void action('confirm_private_reveal')}>確認して続ける</button>;
    if (isMyPending && pending.kind === 'dog_card') return <div className="criminal-pending__choices">{Array.from({ length: dogCount }, (_, index) => <button className="criminal-choice" type="button" key={index} onClick={() => void action('choose_dog_card', { cardIndex: index })}>裏向きカード {index + 1}</button>)}</div>;
    if ('eligibleTargetIds' in pending && isMyPending) return <div className="criminal-pending__choices">{eligibleTargets.map((id) => <button className="criminal-choice" type="button" key={id} onClick={() => void action('select_target', { targetId: id })}>{playerName(id)}を指名</button>)}</div>;
    return null;
  };

  const phaseLabel = state.phase === 'finished' ? '結果' : state.round + '巡目';
  return <main className={'criminal-dances-game criminal-dances-game--' + state.phase + ' mx-auto w-full max-w-3xl px-2 pb-2'} data-phase={state.phase}>
    <header className="criminal-hud">
      <div className="criminal-hud__title"><span className="section-kicker">犯人は踊る</span><h1>カードを出して、犯人を追え</h1></div>
      <div className="criminal-hud__turn"><strong>{phaseLabel}</strong><span>{state.phase === 'finished' ? '結果を確認' : isTurn ? 'あなたの手番' : (currentId ? playerName(currentId) : '次の人') + 'の手番'}</span></div>
    </header>

    {error && <p className="criminal-alert" role="alert">{error}</p>}
    {state.phase === 'playing' && <section className="criminal-board">
      <section className="criminal-seats" aria-label="座席順">
        {state.turnOrder.map((id, index) => {
          const player = state.players[id];
          return <div key={id} className={'criminal-seat ' + (index === state.currentPlayerIndex ? 'is-current' : '')}>
            <span className="criminal-seat__number">{index + 1}</span>
            <strong>{id === myUserId ? 'あなた' : playerName(id)}</strong>
            <small>{player.handCount}枚</small>
            {player.conspirator && <em>たくらみ</em>}
          </div>;
        })}
      </section>

      <section className="criminal-center" aria-label="ゲーム進行">
        <CriminalDancesLastPlayedCard card={lastPlayedCard} actorName={lastPlayedCard ? playerName(lastPlayedCard.actorId) : ''} />
        {state.incidentText && <button className="criminal-notice" type="button" onClick={() => setIncidentOpen(true)}><span>事件内容</span><strong>{state.incidentText}</strong></button>}
        {state.lastAction && <p className="criminal-last-action" role="status"><span>直前</span>{playerName(state.lastAction.actorId)}：{state.lastAction.text}{state.revealedCardType && <b>公開：{cardLabel(state.revealedCardType)}</b>}</p>}
        {state.privateReveal && <CriminalDancesSecret
          reveal={state.privateReveal}
          culpritName={state.privateReveal.culpritPlayerId === myUserId ? 'あなた' : state.privateReveal.culpritPlayerId ? playerName(state.privateReveal.culpritPlayerId) : '不明'}
          canConfirm={Boolean(isMyPending && (pending?.kind === 'boy_reveal' || pending?.kind === 'witness_reveal'))}
          onConfirm={() => void action('confirm_private_reveal')}
        />}
        {pending ? <div className="criminal-pending" role="status">
          <strong>待っている操作</strong>
          <p>{pendingText(pending, myUserId, submittedIds, tradeAlreadySubmitted, isMyPending)}</p>
          {renderPendingChoices()}
        </div> : <p className="criminal-turn-status" role="status">{isTurn ? 'あなたの手番です。手札を選んでください。' : (currentId ? playerName(currentId) : '次の人') + 'の手番です。'}</p>}
      </section>
    </section>}

    {state.phase === 'finished' && outcome && <section className="criminal-result" aria-labelledby="criminal-result-title">
      <div className="criminal-result__stamp" aria-hidden="true">RESULT</div>
      <h2 id="criminal-result-title">{outcome.reason === 'culprit_escaped' ? '犯人が逃げ切った！' : outcome.reason === 'dog_caught' ? 'いぬが犯人を捕まえた！' : '探偵が犯人を捕まえた！'}</h2>
      <p>犯人：{outcome.culpritPlayerId === myUserId ? 'あなた' : outcome.culpritPlayerId ? playerName(outcome.culpritPlayerId) : '不明'}</p>
      <p>たくらみ：{outcome.conspirators.length ? outcome.conspirators.map((id) => id === myUserId ? 'あなた' : playerName(id)).join('、') : 'なし'}</p>
      <p>勝者：{outcome.winners.length ? outcome.winners.map((id) => id === myUserId ? 'あなた' : playerName(id)).join('、') : '勝者なし'}</p>
      <div className="criminal-result__players">{state.turnOrder.map((id) => <p key={id}><strong>{id === myUserId ? 'あなた' : playerName(id)}</strong><span>{resultLabel(state, id)}</span></p>)}</div>
      {isHost && <button className="button-primary criminal-result__button" type="button" onClick={() => void onBackToLobby()}>再戦する</button>}
    </section>}

    {state.phase === 'playing' && <section className="criminal-hand" aria-label="あなたの手札">
      <header className="criminal-hand__header"><h2>手札 <span>{state.myHand.length}枚</span></h2></header>
      <div className="criminal-hand__cards">{state.myHand.map((card) => {
        const rule = privateCardRule(state, myUserId, card);
        const tradeAllowed = Boolean(canSubmitTrade);
        return <CriminalDancesCardTile key={card.id} card={card} selected={selectedCard === card.id} disabled={!rule.allowed && !tradeAllowed} reason={tradeAllowed ? undefined : rule.reason} onSelect={() => setSelectedCard(card.id)} />;
      })}</div>
      <p className="criminal-hand__hint">{pending ? '効果の指示を優先してください。' : isTurn ? 'カードをタップすると詳細と確定操作が開きます。' : 'あなたの手番を待っています。'}</p>
    </section>}

    <footer className="criminal-footer">
      <button className="criminal-tool" type="button" onClick={() => setRulesOpen(true)}>ルール</button>
      <button className="criminal-tool" type="button" onClick={() => setHistoryOpen(true)}>履歴</button>
      {state.incidentText && <button className="criminal-tool" type="button" onClick={() => setIncidentOpen(true)}>事件</button>}
    </footer>

    {selected && <CriminalDancesModal title={cardLabel(selected.type) + 'カード'} labelledBy="criminal-card-title" onClose={() => setSelectedCard(null)}>
      <div className={'criminal-card criminal-card--' + selected.type + ' criminal-card--preview'} aria-hidden="true"><span className="criminal-card__corner">{CARD_GLYPHS[selected.type]}</span><span className="criminal-card__name">{cardLabel(selected.type)}</span><span className="criminal-card__type">効果</span></div>
      <p className="criminal-modal__description">{CARD_DESCRIPTIONS[selected.type]}</p>
      {selected.type === 'first_discoverer' && <label className="criminal-field">事件内容（省略可）<input className="input" value={incidentText} maxLength={200} onChange={(event) => setIncidentText(event.target.value)} placeholder="みんなに伝える一言" /></label>}
      {!selectedRule?.allowed && !canSubmitTrade && <p className="criminal-disabled">{selectedRule?.reason}</p>}
      {(isTurn || canSubmitTrade) && <CardConfirmation allowed={Boolean(selectedRule?.allowed || canSubmitTrade)} trade={canSubmitTrade} onConfirm={() => void submit()} />}
    </CriminalDancesModal>}

    {rulesOpen && <CriminalDancesModal title="ルール" labelledBy="criminal-rules-title" onClose={() => setRulesOpen(false)}>
      <p>3〜8人・各4枚。第一発見者から座席順に進み、全員の最初の手番が終わると2巡目です。手札0枚の手番は飛ばしますが、交換の受け取りは続きます。</p>
      <p className="criminal-modal__paragraph">探偵は2巡目から使用できます。1巡目にほかの合法なカードがない場合だけ、探偵を効果なしで捨てられます。犯人は最後の1枚を自分の手番に出すと逃げ切ります。</p>
      <p className="criminal-modal__paragraph">犯人が逃げ切ると犯人とたくらみ済みの人が勝利します。探偵・いぬで捕まえた場合は、捕まえた人だけが勝利し、犯人とたくらみ済みの人は敗北、残りは「その他」です。たくらみ済みの人が捕まえた場合は勝者なしです。</p>
      <div className="criminal-rules-grid">{(Object.keys(CARD_LABELS) as CriminalDancesCardType[]).map((type) => <p key={type}><strong>{CARD_GLYPHS[type]} {cardLabel(type)}</strong><span>{CARD_DESCRIPTIONS[type]}</span></p>)}</div>
    </CriminalDancesModal>}

    {historyOpen && <CriminalDancesModal title="カード履歴" labelledBy="criminal-history-title" onClose={() => setHistoryOpen(false)}>
      {state.turnOrder.map((id) => <section className="criminal-history-player" key={id}><h3>{id === myUserId ? 'あなた' : playerName(id)}</h3>{state.players[id].played.length ? <div>{state.players[id].played.map((cardType, index) => <span key={id + '-' + index}>{index + 1}. {cardLabel(cardType)}</span>)}</div> : <p>まだカードを出していません。</p>}</section>)}
    </CriminalDancesModal>}

    {incidentOpen && state.incidentText && <CriminalDancesModal title="事件内容" labelledBy="criminal-incident-title" onClose={() => setIncidentOpen(false)}><p className="criminal-incident-full">{state.incidentText}</p></CriminalDancesModal>}
  </main>;
}
