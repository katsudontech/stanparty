'use client';

import { useEffect, useState } from 'react';
import type { RoomState } from '@/games/core/types';
import { getRevealTargets, type Action, type DiscKind, type PrivateState, type PublicState } from './rules';
import { useSkullGame } from './useSkullGame';
import './style.css';

const discLabel = { flower: '花', skull: 'ドクロ', back: '裏向き' };
const discSymbol = { flower: '✿', skull: '☠', back: '◇' };

function Disc({ kind }: { kind: DiscKind | null }) {
  const face = kind ?? 'back';
  return <span className={`skull-disc skull-disc--${face}`} role="img" aria-label={discLabel[face]}>
    <span aria-hidden="true">{discSymbol[face]}</span>
  </span>;
}

type ActionHandler = (action: Action, value?: string | number) => Promise<void>;
type Name = (id: string) => string;

function SkullTable({ state, myUserId, name, busy, action }: {
  state: PublicState; myUserId: string; name: Name; busy: boolean; action: ActionHandler;
}) {
  const targets = state.actorId === myUserId ? getRevealTargets(state) : [];
  return <section aria-label="全員のディスクの山" className="skull-table">
    {state.seats.map(seat => <article key={seat.id} className="skull-seat" data-current={state.actorId === seat.id}>
      <div className="skull-seat-heading"><h2>{name(seat.id)}{seat.id === myUserId && <small>（あなた）</small>}</h2>
        <strong aria-label={`成功 ${seat.successes} 回`} className="skull-score">
          <span aria-hidden="true">{'✿'.repeat(seat.successes)}{'○'.repeat(2 - seat.successes)}</span>
        </strong>
      </div>
      <p className="skull-seat-meta">残り {seat.remaining} 枚
        {seat.remaining === 0 && ' · 脱落'}
        {state.passed.includes(seat.id) && ' · パス'}
        {state.bid?.playerId === seat.id && ` · 宣言 ${state.bid.count} 枚`}
      </p>
      <ol className="skull-disc-list" aria-label={`${name(seat.id)}の山（左から下、右が上）`}>
        {seat.stack.map((kind, position) => <li key={position}><Disc kind={kind} /></li>)}
      </ol>
      {targets.includes(seat.id) && <button type="button" className="skull-reveal" disabled={busy}
        aria-label={`${name(seat.id)}の山の一番上をめくる`}
        onClick={() => void action('reveal', seat.id)}>一番上をめくる</button>}
    </article>)}
  </section>;
}

function RoundStatus({ state, name }: { state: PublicState; name: Name }) {
  const actor = state.actorId ? name(state.actorId) : null;
  const challenger = state.bid ? name(state.bid.playerId) : null;
  const ready = state.seats.filter(seat => seat.stack.length > 0).length;
  const active = state.seats.filter(seat => seat.remaining > 0).length;
  const progress = state.revealed.filter(reveal => reveal.kind === 'flower').length;

  return <div className="skull-status" aria-live="polite">
    {state.phase === 'opening' && <><h2>最初のディスクを置く</h2><p>先手は {name(state.starterId)} · 準備 {ready}/{active} 人</p></>}
    {state.phase === 'placing' && <><h2>{actor}の手番</h2><p>ディスクを重ねるか、めくる枚数を宣言します。</p></>}
    {state.phase === 'bidding' && <><h2>{actor}の手番</h2><p>{challenger}が {state.bid?.count} 枚を宣言。枚数を上げるかパスします。</p></>}
    {state.phase === 'challenge' && <><h2>{challenger}のチャレンジ</h2><p>めくった花 {progress}/{state.bid?.count} 枚 · 自分の山からめくります。</p></>}
    {state.result?.kind === 'failure' && <><h2>{challenger}のチャレンジ失敗</h2><p>{name(state.result.skullOwnerId)}の山からドクロが出ました。</p></>}
    {state.result?.kind === 'success' && <><h2>{challenger}のチャレンジ成功</h2><p>花を {state.bid?.count} 枚めくりました。</p></>}
    {state.phase === 'loss-choice' && <p>{actor}が失うディスクを選んでいます。</p>}
    {state.phase === 'starter-choice' && <p>{actor}が次の先手を選んでいます。</p>}
    {state.phase === 'result' && state.nextStarterId && <p>次の先手は {name(state.nextStarterId)} です。</p>}
    {state.winner && <div className="skull-winner">
      <h2>{name(state.winner.playerId)}の勝ち！</h2>
      <p>{state.winner.reason === 'two-successes' ? 'チャレンジに2回成功しました。' : '最後までディスクが残りました。'}</p>
    </div>}
  </div>;
}

function PrivateDiscs({ mine, peek, showChoices, loss, busy, selected, openChoices, onSelect, close, confirm, canChoose }: {
  mine: NonNullable<PrivateState['mine']>;
  peek: boolean; showChoices: boolean; loss: boolean; busy: boolean; selected: string; canChoose: boolean;
  openChoices: () => void; onSelect: (value: string) => void; close: () => void; confirm: () => void;
}) {
  const choices = loss ? mine.lossOptions : mine.hand;
  return <>
    {peek && <div className="skull-private" id="skull-private-discs" aria-label="自分だけに見えるディスク">
      <div><h3>自分の山（下から上の順）</h3><ol className="skull-disc-list">
        {mine.stack.map((kind, position) => <li key={position}><Disc kind={kind} /></li>)}
      </ol>{mine.stack.length === 0 && <p>まだ置いていません</p>}</div>
      <div><h3>残りの手札</h3><ul className="skull-disc-list">
        {mine.hand.map(disc => <li key={disc.id}><Disc kind={disc.kind} /></li>)}
      </ul>{mine.hand.length === 0 && <p>手札はありません</p>}</div>
      {mine.lost && <p>失ったディスクは {discLabel[mine.lost]} です。</p>}
    </div>}
    {showChoices && <div className="skull-private" aria-label={loss ? '失うディスクの選択' : '置くディスクの選択'}>
      <p>自分だけに見えるディスク</p>
      <div className="skull-choices">
        {choices.map((disc, index) => <button type="button" className="skull-choice" key={disc.id}
          aria-label={`${discLabel[disc.kind]} ${index + 1}枚目`} aria-pressed={selected === disc.id}
          disabled={busy} onClick={() => onSelect(disc.id)}><Disc kind={disc.kind} /></button>)}
      </div>
      <div className="skull-actions">
        <button type="button" className="skull-primary" disabled={!selected || busy} onClick={confirm}>
          {loss ? 'このディスクを失う' : '裏向きで置く'}
        </button>
        <button type="button" className="skull-secondary" onClick={close}>閉じる</button>
      </div>
    </div>}
    {canChoose && !showChoices && choices.length > 0 && <button type="button" className="skull-primary" disabled={busy} onClick={openChoices}>
      {loss ? '失うディスクを選ぶ' : '置くディスクを選ぶ'}
    </button>}
  </>;
}

function BidControls({ state, action, busy }: { state: PublicState; action: ActionHandler; busy: boolean }) {
  const minimum = (state.bid?.count ?? 0) + 1;
  const maximum = state.seats.reduce((sum, seat) => sum + seat.stack.length, 0);
  const [value, setValue] = useState(minimum);

  return <div className="skull-actions">
    <label htmlFor="skull-bid">めくる枚数</label>
    <select id="skull-bid" value={value} disabled={busy} onChange={event => setValue(Number(event.target.value))}>
      {Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index).map(count =>
        <option key={count} value={count}>{count} 枚</option>)}
    </select>
    <button type="button" className="skull-primary" disabled={busy} onClick={() => void action('bid', value)}>
      {state.phase === 'bidding' ? '宣言を上げる' : '枚数を宣言する'}
    </button>
    {state.phase === 'bidding' && <button type="button" className="skull-secondary" disabled={busy}
      onClick={() => void action('pass')}>パス</button>}
  </div>;
}

export function SkullRound({ state, myUserId, host, busy, name, action, onBackToLobby }: {
  state: PrivateState; myUserId: string; host: boolean; busy: boolean; name: Name;
  action: ActionHandler; onBackToLobby: () => Promise<void>;
}) {
  const [peek, setPeek] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [selected, setSelected] = useState('');
  const [returning, setReturning] = useState(false);

  function clearPrivate() {
    setPeek(false);
    setShowChoices(false);
    setSelected('');
  }

  useEffect(() => {
    window.addEventListener('blur', clearPrivate);
    document.addEventListener('visibilitychange', clearPrivate);
    return () => {
      window.removeEventListener('blur', clearPrivate);
      document.removeEventListener('visibilitychange', clearPrivate);
    };
  }, []);

  async function run(actionType: Action, value?: string | number) {
    clearPrivate();
    await action(actionType, value);
  }

  const mine = state.mine;
  const myTurn = state.actorId === myUserId;
  const opening = state.phase === 'opening';
  const placing = myTurn && state.phase === 'placing';
  const loss = myTurn && state.phase === 'loss-choice';
  const mayPlace = mine && ((opening && mine.stack.length === 0) || placing) && mine.hand.length > 0;
  const mayChoose = mine && (mayPlace || loss);
  const mayBid = myTurn && (state.phase === 'placing' || state.phase === 'bidding');
  const mySeat = state.seats.find(seat => seat.id === myUserId);

  return <>
    <RoundStatus state={state} name={name} />
    <SkullTable state={state} myUserId={myUserId} name={name} busy={busy} action={run} />
    <section className="skull-controls" aria-label="あなたの操作">
      {opening && mine && !mayPlace && <p role="status">置きました。全員が置くまでお待ちください。</p>}
      {placing && !mayPlace && !busy && <p>手札がないので、枚数を宣言してください。</p>}
      {mayBid && <BidControls state={state} busy={busy} action={run} />}
      {state.phase === 'challenge' && myTurn && <p>めくる山を選んでください。</p>}
      {mySeat?.remaining === 0 && <p>ディスクがなくなりました。</p>}
      {state.phase === 'starter-choice' && myTurn && <div className="skull-actions">
        {state.seats.filter(seat => seat.remaining > 0).map(seat => <button type="button" className="skull-secondary"
          disabled={busy} key={seat.id} onClick={() => void run('choose-starter', seat.id)}>{name(seat.id)}を先手にする</button>)}
      </div>}
      {state.phase === 'result' && (host ?
        <button type="button" className="skull-primary" disabled={busy} onClick={() => void run('next')}>次のラウンドへ</button> :
        <p>ホストが次のラウンドを始めるまでお待ちください。</p>)}
      {state.phase === 'finished' && (host ?
        <button type="button" className="skull-primary" disabled={returning} onClick={async () => {
          clearPrivate();
          setReturning(true);
          try { await onBackToLobby(); } finally { setReturning(false); }
        }}>ロビーに戻る</button> : <p>ホストがロビーに戻るまでお待ちください。</p>)}
      {mine && <div className="skull-own">
        <button type="button" className="skull-secondary skull-peek" disabled={busy || showChoices}
          aria-pressed={peek} onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setPeek(true);
          }} onPointerUp={() => setPeek(false)} onPointerCancel={() => setPeek(false)} onLostPointerCapture={() => setPeek(false)}
          onBlur={() => setPeek(false)} onContextMenu={event => event.preventDefault()}
          onKeyDown={event => {
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setPeek(true); }
          }} onKeyUp={event => {
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setPeek(false); }
          }}>長押しで自分のディスクを見る</button>
        <PrivateDiscs mine={mine} peek={peek && !busy} showChoices={!!mayChoose && showChoices} loss={loss}
          busy={busy} selected={selected} openChoices={() => { setPeek(false); setShowChoices(true); }}
          onSelect={setSelected} close={clearPrivate} confirm={() => void run(loss ? 'choose-loss' : 'place', selected)}
          canChoose={!!mayChoose} />
      </div>}
    </section>
  </>;
}

function SkullGame({ roomState, myUserId, onBackToLobby }: {
  roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void>;
}) {
  const { state, error, pending, busy, initializing, initialize, action, refresh } = useSkullGame(roomState);
  const host = myUserId === roomState.host_id;
  const name: Name = id => roomState.players.find(player => player.userId === id)?.name ?? 'プレイヤー';
  return <main className="skull-game">
    <header className="skull-header"><h1>スカル</h1>{state && <span>第 {state.round} ラウンド</span>}</header>
    {error && <p className="skull-error" role="alert">{error}
      {!initializing && <button type="button" className="skull-secondary" onClick={() => void refresh()}>再読み込み</button>}
    </p>}
    {state ? <SkullRound key={`${state.matchId}:${state.revision}`} state={state} myUserId={myUserId}
      host={host} busy={busy} name={name} action={action} onBackToLobby={onBackToLobby} /> :
      <section className="skull-status">
        {initializing && host ? <button type="button" className="skull-primary" disabled={pending}
          onClick={() => void initialize()}>{pending ? '開始しています…' : 'ゲームを始める'}</button> :
          <p role="status">{initializing ? 'ホストの開始を待っています。' : 'ゲームを読み込んでいます。'}</p>}
      </section>}
  </main>;
}

export function SkullRoomGame(props: Parameters<typeof SkullGame>[0]) {
  return <SkullGame key={`${props.roomState.id}:${props.myUserId}:${props.roomState.skull_epoch ?? 0}`} {...props} />;
}
