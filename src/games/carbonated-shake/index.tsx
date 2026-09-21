'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { PendingButton } from '@/components/shared/PendingButton';
import type { RoomState } from '@/games/core/types';
import { MAX_ACCEPTED_SHAKE_AMOUNT, MAX_TURN_SCORE, SCORE_LEVELS } from './constants';
import { rankScores } from './rules';
import { useCarbonatedShakeGame } from './hooks/useCarbonatedShakeGame';
import { useShakeDetection } from './hooks/useShakeDetection';
import type { CarbonatedShakePrivateHint } from './types';

interface Props { roomState: RoomState; myUserId: string; onBackToLobby: () => Promise<void> }

function playerName(room: RoomState, id: string | null): string {
  return room.players.find((player) => player.userId === id)?.name ?? '参加者';
}

function FizzBottle({ level, burst = false }: { level?: CarbonatedShakePrivateHint['level']; burst?: boolean }) {
  return <div className={`carbonated-fizz carbonated-fizz--${level ?? 'neutral'} ${burst ? 'carbonated-fizz--burst' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 160 220" role="presentation" focusable="false">
      <defs><linearGradient id="carbonated-can" x1="0" x2="1"><stop offset="0" stopColor="#f47b20" /><stop offset=".5" stopColor="#ffca3a" /><stop offset="1" stopColor="#e95735" /></linearGradient></defs>
      <path className="carbonated-fizz__spray" d="M80 40 C60 17 59 3 50 0 M80 40 C91 16 98 9 111 2 M80 40 C78 16 81 7 82 0" />
      <rect x="38" y="36" width="84" height="158" rx="23" fill="url(#carbonated-can)" stroke="currentColor" strokeWidth="5" />
      <g className="carbonated-fizz__foam" fill="#fff5d6"><circle cx="44" cy="54" r="13" /><circle cx="66" cy="46" r="16" /><circle cx="92" cy="47" r="18" /><circle cx="117" cy="57" r="12" /></g>
      <g className="carbonated-fizz__lid"><ellipse cx="80" cy="38" rx="36" ry="8" fill="#d9e4e5" stroke="currentColor" strokeWidth="3" /><ellipse cx="80" cy="36" rx="10" ry="3" fill="none" stroke="currentColor" strokeWidth="2" /></g>
      <path d="M48 68h64M48 176h64" stroke="currentColor" strokeWidth="4" opacity=".45" />
      <path d="M55 45h50" stroke="#fff5d6" strokeWidth="7" strokeLinecap="round" />
      <circle cx="61" cy="111" r="8" fill="#fff5d6" /><circle cx="94" cy="131" r="5" fill="#fff5d6" /><circle cx="78" cy="153" r="4" fill="#fff5d6" />
      <text x="80" y="102" textAnchor="middle" fill="#fff5d6" fontSize="15" fontWeight="900">FIZZ!</text>
    </svg>
    <span className="carbonated-fizz__bubble carbonated-fizz__bubble--one" />
    <span className="carbonated-fizz__bubble carbonated-fizz__bubble--two" />
    <span className="carbonated-fizz__bubble carbonated-fizz__bubble--three" />
  </div>;
}

function TurnOrder({ state, room }: { state: ReturnType<typeof useCarbonatedShakeGame>['state']; room: RoomState }) {
  return <ol className="carbonated-turn-order" aria-label="固定されたターン順">
    {state.turnOrder.map((id, index) => <li key={id} className={index === state.turnIndex ? 'is-current' : ''}>
      <span>{index + 1}</span><strong>{playerName(room, id)}</strong>{index === state.turnIndex && <em>NOW</em>}
    </li>)}
  </ol>;
}

function Scoreboard({ state, room }: { state: ReturnType<typeof useCarbonatedShakeGame>['state']; room: RoomState }) {
  return <div className="carbonated-scoreboard" aria-label="得点">
    {room.players.map((player) => {
      const score = state.scores[player.userId] ?? { totalScore: 0, turnScore: 0 };
      return <div key={player.userId} className="carbonated-scoreboard__row"><span>{player.name}</span><strong>{score.totalScore}pt</strong><small>今回 +{score.turnScore}pt</small></div>;
    })}
  </div>;
}

const DANGER_LABELS: Record<CarbonatedShakePrivateHint['level'], string> = {
  1: 'かなり余裕',
  2: '少しシュワシュワ',
  3: 'そこそこ危険',
  4: 'かなり危険',
  5: '限界寸前',
};

function HintReveal({ hint }: { hint: CarbonatedShakePrivateHint }) {
  return <section className="carbonated-hint-reveal" aria-live="polite"><p>危険度：{DANGER_LABELS[hint.level]}</p><FizzBottle level={hint.level} /><strong>この情報は一度だけ表示されます</strong></section>;
}

export function CarbonatedShakeGame({ roomState, myUserId, onBackToLobby }: Props) {
  const isHost = roomState.host_id === myUserId;
  const game = useCarbonatedShakeGame(roomState, myUserId);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [burstDismissedKey, setBurstDismissedKey] = useState<string | null>(null);
  const finishLock = useRef(false);
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const motion = useShakeDetection(game.queueShakeAmount, fallbackEnabled);
  const { finishTurn, isMyTurn } = game;
  const { endHold, holding } = motion;
  const currentName = playerName(roomState, game.state.currentPlayerId);
  const canStart = !game.state.matchId && isHost;
  const nextLevel = SCORE_LEVELS.find((level) => level.minimumAmount > game.localAmount);

  const finish = useCallback(async () => {
    if (finishLock.current || !isMyTurn) return;
    finishLock.current = true;
    pointerRef.current = null;
    setFinishing(true);
    endHold();
    try { await finishTurn(); } catch { /* displayed below */ }
    finally { finishLock.current = false; setFinishing(false); }
  }, [endHold, finishTurn, isMyTurn]);

  useEffect(() => {
    if (!isMyTurn) {
      pointerRef.current = null;
      if (holding) endHold();
    }
  }, [endHold, holding, isMyTurn]);

  useEffect(() => {
    if (game.state.phase !== 'finished' || !game.state.burstPlayerId) return;
    const key = `${game.state.matchId}:${game.state.turnNumber}:${game.state.burstPlayerId}`;
    const timer = window.setTimeout(() => setBurstDismissedKey(key), 900);
    return () => window.clearTimeout(timer);
  }, [game.state.burstPlayerId, game.state.matchId, game.state.phase, game.state.turnNumber]);

  useEffect(() => {
    if (game.plannedScore >= MAX_TURN_SCORE && game.isMyTurn) void finish();
  }, [finish, game.isMyTurn, game.plannedScore]);

  useEffect(() => {
    const stopAndCommit = () => { if (holding && isMyTurn) void finish(); };
    window.addEventListener('blur', stopAndCommit);
    document.addEventListener('visibilitychange', stopAndCommit);
    return () => { window.removeEventListener('blur', stopAndCommit); document.removeEventListener('visibilitychange', stopAndCommit); };
  }, [finish, holding, isMyTurn]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isMyTurn || finishing || !event.isPrimary || event.button !== 0 || pointerRef.current
      || (!fallbackEnabled && motion.permission !== 'granted')) return;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    motion.beginHold();
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const previous = pointerRef.current;
    if (!previous || previous.id !== event.pointerId || !fallbackEnabled) return;
    motion.addFallbackShake(Math.hypot(event.clientX - previous.x, event.clientY - previous.y));
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current?.id !== event.pointerId) return;
    pointerRef.current = null;
    void finish();
  };

  const enableMotion = async () => {
    setPermissionBusy(true);
    if (await motion.requestPermission()) setFallbackEnabled(false);
    setPermissionBusy(false);
  };

  if (canStart) return <main className="carbonated-shake-game">
    <header className="carbonated-title"><p className="section-kicker">PARTY GAME</p><h1>炭酸シェイク！</h1><p>順番に振って、欲張って、でも吹き出させない。</p></header>
    <section className="carbonated-start-card"><FizzBottle /><h2>1本のジュースを、みんなで振ります</h2><p>振った量が増えるほど得点は伸びます。炭酸の危険度は、ターンを終えた本人だけが一瞬確認できます。</p><PendingButton busy={initializing} className="button-primary carbonated-wide-button" type="button" disabled={initializing} onClick={() => { setInitializing(true); void game.initialize().catch(() => {}).finally(() => setInitializing(false)); }}>{initializing ? '準備中…' : 'ゲームを始める'}</PendingButton></section>
    {game.error && <p className="carbonated-error" role="alert">{game.error}</p>}
  </main>;

  if (!game.state.matchId) return <main className="carbonated-shake-game"><header className="carbonated-title"><p className="section-kicker">炭酸シェイク！</p><h1>準備中…</h1><p>ホストがゲームを始めています。</p></header></main>;

  const isFinished = game.state.phase === 'finished';
  const burstKey = `${game.state.matchId}:${game.state.turnNumber}:${game.state.burstPlayerId ?? ''}`;
  const burstVisible = isFinished && Boolean(game.state.burstPlayerId) && burstDismissedKey !== burstKey;
  const isHint = game.state.phase === 'hint_pending' || game.state.phase === 'hint_display';
  const rankings = Object.fromEntries(roomState.players.map((player) => [player.userId, game.state.scores[player.userId]?.totalScore ?? 0]));
  const ranked = rankScores(rankings);

  return <main className={`carbonated-shake-game ${isFinished ? 'is-finished' : ''}`}>
    <header className="carbonated-title"><p className="section-kicker">PARTY GAME</p><h1>炭酸シェイク！</h1><p>{isFinished ? 'ブシャーー！！' : `いま振るのは ${currentName}`}</p></header>
    {!isFinished && <div className="carbonated-game-grid">
      <section className="carbonated-stage">
        <div className="carbonated-stage__meta"><span>TURN {game.state.turnNumber}</span><strong>{currentName} の番</strong></div>
        {!isHint && <FizzBottle />}
        {isHint ? <>{game.hint ? <HintReveal hint={game.hint} /> : <div className="carbonated-waiting">危険度を確認中…</div>}</> : game.isMyTurn ? <>
          <div className="carbonated-score-callout"><span>現在の獲得予定</span><strong>+{game.plannedScore}<small>pt</small></strong><em>MAX {MAX_TURN_SCORE}pt</em></div>
          <div className="carbonated-progress" role="progressbar" aria-label="シェイクの得点段階" aria-valuemin={0} aria-valuemax={MAX_TURN_SCORE} aria-valuenow={game.plannedScore}><span style={{ width: `${Math.min(100, (game.localAmount / MAX_ACCEPTED_SHAKE_AMOUNT) * 100)}%` }} /><i /><i /><i /><i /></div>
          <p className="carbonated-stage-note">{nextLevel ? `次の段階で +${Math.min(MAX_TURN_SCORE, nextLevel.score)}pt。どこまで欲張る？` : 'MAX！得点を確定しています'}</p>
          <button type="button" className="carbonated-hold-button" disabled={finishing || (!fallbackEnabled && motion.permission !== 'granted')} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd} aria-pressed={motion.holding}>{motion.holding ? 'SHAKING…' : 'HOLD TO SHAKE'}<small>{motion.holding ? '指を離すと確定' : fallbackEnabled ? '押したまま指・マウスを左右に動かす' : '押しながらスマホを振る'}</small></button>
          {(!motion.sensorSeen || fallbackEnabled || motion.permission !== 'granted') && <div className="carbonated-motion-help">
            {!fallbackEnabled && <button type="button" className="button-secondary" disabled={permissionBusy || holding || finishing} onClick={() => void enableMotion()}>{permissionBusy ? '確認中…' : 'モーションセンサーを有効にする'}</button>}
            <button type="button" className="text-link" disabled={holding || finishing} onClick={() => setFallbackEnabled((current) => !current)}>{fallbackEnabled ? 'スマホを振る操作に戻す' : 'センサーなしの代替操作を使う'}</button>
            <p>{fallbackEnabled ? '代替操作：HOLD中の指・マウスの移動で振れます。' : motion.permission === 'denied' ? 'センサーの権限が許可されませんでした。代替操作を選べます。' : motion.permission === 'unsupported' ? 'HTTPS接続または対応センサーが必要です。代替操作を選べます。' : motion.permission === 'granted' ? 'スマホを振っても反応がない場合は、代替操作を選んでください。' : 'iPhoneではセンサーを有効にして許可してください。'}</p>
          </div>}
        </> : <div className="carbonated-waiting"><strong>{currentName}が振っています…</strong><span>発言でブラフを仕掛けよう</span></div>}
      </section>
      <aside className="carbonated-sidebar"><section><h2>固定ターン順</h2><TurnOrder state={game.state} room={roomState} /></section><section><h2>スコア</h2><Scoreboard state={game.state} room={roomState} /></section></aside>
    </div>}
    {burstVisible && <div className="carbonated-burst-overlay" aria-live="assertive"><FizzBottle burst /><strong>ブシャーー！！</strong><p>{playerName(roomState, game.state.burstPlayerId)}が吹き出させました！</p></div>}
    {isFinished && <section className="carbonated-result"><h2>ブシャーー！！</h2><p><strong>{playerName(roomState, game.state.burstPlayerId)}</strong>が吹き出させました。</p><p className="carbonated-loser">このターンのプレイヤーは -999pt</p><ol>{ranked.map((entry) => <li key={entry.playerId}><strong>{entry.rank}位</strong><span>{playerName(roomState, entry.playerId)}</span><b>{entry.score}pt</b></li>)}</ol><PendingButton busy={false} type="button" className="button-primary carbonated-wide-button" disabled={!isHost} onClick={() => void onBackToLobby()}>{isHost ? 'ロビーに戻る' : 'ホストがロビーに戻すのを待っています'}</PendingButton></section>}
    {game.error && <p className="carbonated-error" role="alert">{game.error}</p>}
  </main>;
}
