'use client';

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import type { RoomState } from '@/games/core/types';
import { useAiBarenaiGame } from './hooks/useAiBarenaiGame';
import type { AiBarenaiPhase, AiBarenaiRoundHints } from './types';

interface Props {
  roomState: RoomState;
  myUserId: string;
  onBackToLobby: () => Promise<void>;
}

const PHASE_LABELS: Record<AiBarenaiPhase, string> = {
  rule_setting: 'ルール設定',
  hinting: 'ヒントタイム',
  answering: '回答タイム',
  revealing: '結果発表',
  game_over: 'ゲーム終了',
};

function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = `aib-dialog-title-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="aib-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={() => { restoreRef.current?.focus(); restoreRef.current = null; onClose(); }}
      onClick={(event: MouseEvent<HTMLDialogElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const clickedOutside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (clickedOutside) onClose();
      }}
    >
      <header className="aib-dialog__header"><h2 id={titleId}>{title}</h2><button className="aib-icon-button" type="button" onClick={onClose} aria-label="閉じる">×</button></header>
      <div className="aib-dialog__body">{children}</div>
    </dialog>
  );
}

function Hud({ phase, round, answerer, players, onPlayers }: { phase: AiBarenaiPhase; round: number; answerer: string; players: RoomState['players']; onPlayers: () => void }) {
  return (
    <header className="aib-hud">
      <div className="aib-hud__round"><span>ROUND</span><strong>{round}</strong></div>
      <div className="aib-hud__phase">{PHASE_LABELS[phase]}</div>
      <div className="aib-hud__answerer"><span>回答者</span><strong>{answerer}</strong></div>
      <button className="aib-player-button" type="button" onClick={onPlayers} aria-label={`参加者 ${players.length}人を表示`}><span aria-hidden="true">●</span>{players.length}人</button>
    </header>
  );
}

function PlayersDialog({ open, onClose, players, myUserId }: { open: boolean; onClose: () => void; players: RoomState['players']; myUserId: string }) {
  return (
    <Dialog open={open} title="参加者" onClose={onClose}>
      <ul className="aib-player-list">
        {players.map((player) => <li key={player.userId}><Avatar avatarUrl={player.avatarUrl} name={player.name} color={player.color} size="sm" decorative /><span className="aib-player-list__name">{player.name}</span>{player.userId === myUserId && <span className="aib-chip">あなた</span>}{player.isHost && <span className="aib-chip">ホスト</span>}<span className={`aib-online-dot ${player.isOnline ? 'is-online' : ''}`} aria-label={player.isOnline ? 'オンライン' : 'オフライン'} /></li>)}
      </ul>
    </Dialog>
  );
}

function HistoryDialog({ open, onClose, hints, answers, playerName }: { open: boolean; onClose: () => void; hints: AiBarenaiRoundHints[]; answers: ReturnType<typeof useAiBarenaiGame>['gameState']['answerHistory']; playerName: (id: string) => string }) {
  return (
    <Dialog open={open} title="ゲームの履歴" onClose={onClose}>
      <div className="aib-history-dialog">
        <section><h3>公開ヒント</h3>{hints.length === 0 ? <p className="aib-empty">まだありません。</p> : hints.map((round) => <div className="aib-history-group" key={round.round}><p className="aib-history-label">ラウンド {round.round}</p>{round.hints.map((hint) => <p className="aib-history-entry" key={`${round.round}-${hint.playerId}`}><strong>{playerName(hint.playerId)}</strong>{hint.text}</p>)}</div>)}</section>
        <section><h3>回答履歴</h3>{answers.length === 0 ? <p className="aib-empty">まだありません。</p> : answers.map((entry) => <div className="aib-answer-history" key={entry.round}><p className="aib-history-label">ラウンド {entry.round}</p><p>人間：<strong>{entry.humanAnswer}</strong>（{entry.humanCorrect ? '正解' : '不正解'}）</p><p>AI：<strong>{entry.aiError ? 'AI回答を取得できませんでした' : entry.aiAnswer}</strong>（確信度 {entry.aiConfidence}%・{entry.aiCorrect ? '正解' : '不正解'}）</p></div>)}</section>
      </div>
    </Dialog>
  );
}

function Composer({ value, onChange, onSubmit, label, placeholder, submitLabel, maxLength }: { value: string; onChange: (value: string) => void; onSubmit: () => void; label: string; placeholder: string; submitLabel: string; maxLength: number }) {
  const inputId = `aib-composer-${useId().replace(/:/g, '')}`;
  return <form className="aib-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="aib-composer__field"><label className="aib-composer__label" htmlFor={inputId}>{label}</label><input id={inputId} className="aib-composer__input" value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} required placeholder={placeholder} /></div><button className="button-primary aib-composer__submit" type="submit">{submitLabel}</button></form>;
}

function HintList({ hints, playerName }: { hints: AiBarenaiRoundHints[]; playerName: (id: string) => string }) {
  const total = hints.reduce((count, round) => count + round.hints.length, 0);
  if (total === 0) return <p className="aib-empty">ヒントが公開されるとここに表示されます。</p>;
  return <div className="aib-hints" aria-live="polite">{hints.map((round) => <section className="aib-hint-round" key={round.round}><p className="aib-history-label">ラウンド {round.round}</p>{round.hints.map((hint) => <div className="aib-hint" key={`${round.round}-${hint.playerId}`}><span>{playerName(hint.playerId)}</span><strong>{hint.text}</strong></div>)}</section>)}</div>;
}

function ResultPanel({ result, phase, onComment }: { result: NonNullable<ReturnType<typeof useAiBarenaiGame>['gameState']['result']>; phase: AiBarenaiPhase; onComment: () => void }) {
  const title = phase === 'revealing' ? '両者不正解' : result.winner === 'ai' ? 'AIの勝利' : result.winner === 'humans' ? '人間の勝利' : '引き分け';
  return (
    <section className="aib-result" aria-labelledby="aib-result-title"><div className="aib-result__heading"><p className="section-kicker">RESULT</p><h2 id="aib-result-title">{title}</h2></div>{result.topic ? <p className="aib-topic aib-topic--result">お題：{result.topic}</p> : <p className="aib-muted">お題は次のラウンドまで秘密です。</p>}<div className="aib-result__grid"><div className={`aib-result-card ${result.humanCorrect ? 'is-correct' : ''}`}><span>人間の回答</span><strong>{result.humanAnswer || '未回答'}</strong><b>{result.humanCorrect ? '正解' : '不正解'}</b></div><div className={`aib-result-card ${result.aiCorrect ? 'is-correct' : ''}`}><span>AIの回答</span><strong>{result.aiError ? '取得できませんでした' : result.aiAnswer}</strong><b>確信度 {result.aiConfidence}%・{result.aiCorrect ? '正解' : '不正解'}</b></div></div>{phase === 'game_over' && result.aiComment && <div className="aib-comment"><p>AIの感想</p><div className="aib-comment__preview">{result.aiComment}</div><button className="text-link" type="button" onClick={onComment}>全文を読む</button></div>}</section>
  );
}

export function AiBarenaiGame({ roomState, myUserId, onBackToLobby }: Props) {
  const isHost = roomState.host_id === myUserId;
  const { gameState, topic, handleInitialize, handleHint, handleAnswer, handleNextRound, handleTopic } = useAiBarenaiGame(roomState, isHost);
  const [hints, setHints] = useState(gameState.hintsPerRound);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [playersOpen, setPlayersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const isAnswerer = gameState.answererId === myUserId;
  const isAssignee = gameState.currentAssigneeIds.includes(myUserId);
  const submitted = gameState.submittedHintPlayerIds.includes(myUserId);
  const answerHistory = gameState.answerHistory;
  const playerName = (id: string | null) => roomState.players.find((player) => player.userId === id)?.name ?? '参加者';
  const assigneeNames = gameState.currentAssigneeIds.map(playerName).join('、');
  const maxHints = Math.max(1, roomState.players.length - 1);
  const selectedHints = Math.min(hints, maxHints);
  const revealedHintCount = gameState.revealedHintHistory.reduce((count, round) => count + round.hints.length, 0);
  const historyCount = revealedHintCount + answerHistory.length;

  const act = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); } catch (caught) { setError(caught instanceof Error ? caught.message : '操作に失敗しました'); } };
  const submitHint = () => void act(async () => { await handleHint(text); setText(''); });
  const submitAnswer = () => void act(async () => { await handleAnswer(text); setText(''); });
  const hud = <Hud phase={gameState.phase} round={gameState.round} answerer={gameState.answererId ? playerName(gameState.answererId) : '未決定'} players={roomState.players} onPlayers={() => setPlayersOpen(true)} />;
  const historyButton = historyCount > 0 && <button className="aib-history-button" type="button" onClick={() => setHistoryOpen(true)} aria-label={`履歴を見る（${historyCount}件）`}><svg className="aib-history-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg><span className="aib-history-button__label">履歴を見る</span><span className="aib-history-button__count">{historyCount}</span></button>;
  const showLobbyLink = gameState.phase === 'rule_setting';

  let content: ReactNode;
  let composer: ReactNode = null;
  let bottomAction: ReactNode = null;

  if (gameState.phase === 'rule_setting') {
    content = <section className="aib-rule-stage"><div><p className="section-kicker">AI GAME</p><h1>AIにバレるな！</h1><p className="aib-lede">お題を知らない回答者に、みんなでヒントを出します。AIより先に当てられるか挑戦しましょう。</p></div><div className="aib-rule-note"><strong>ルール</strong><span>回答者にはお題を見せず、担当者がヒントを1つずつ出します。</span></div></section>;
    bottomAction = isHost ? <div className="aib-rule-controls"><div className="aib-stepper"><span>1ラウンドのヒント担当</span><div><button type="button" aria-label="ヒント担当を減らす" disabled={selectedHints <= 1} onClick={() => setHints((value) => Math.max(1, value - 1))}>−</button><strong>{selectedHints}人</strong><button type="button" aria-label="ヒント担当を増やす" disabled={selectedHints >= maxHints} onClick={() => setHints((value) => Math.min(maxHints, value + 1))}>＋</button></div></div><button className="button-primary aib-full-button" type="button" onClick={() => void act(() => handleInitialize(selectedHints))}>ゲームを始める</button></div> : <p className="aib-waiting">ホストがルールを設定しています…</p>;
  } else if (gameState.phase === 'hinting') {
    content = <section className="aib-phase-stage"><div className="aib-stage-heading"><div><p className="section-kicker">HINTING</p><h1>ヒントを積み上げよう</h1></div><span className="aib-progress">{gameState.submittedHintPlayerIds.length}/{gameState.currentAssigneeIds.length} 提出</span></div><div className="aib-role-card">{isAnswerer ? <><strong>あなたは回答者</strong><span>お題は見えません。みんながヒントを出すのを待ちましょう。</span></> : isAssignee ? <><strong>あなたはヒント担当</strong><span>{submitted ? 'このラウンドは提出済みです。' : 'お題を確認して、ヒントを1つ出してください。'}</span>{topic ? <p className="aib-topic">お題：{topic}</p> : <button className="button-secondary aib-inline-button" type="button" onClick={() => void act(handleTopic)}>お題を確認する</button>}</> : <><strong>今回はヒント担当ではありません</strong><span>{assigneeNames || '担当者'}がヒントを出しています。</span></>}</div><div className="aib-hint-waiting"><span>担当者</span><strong>{assigneeNames || '未決定'}</strong></div></section>;
    if (isAssignee && !submitted) composer = <Composer value={text} onChange={setText} onSubmit={submitHint} label="ヒント（お題を直接言わない）" placeholder="ヒントを入力（お題を直接言わない）" submitLabel="提出" maxLength={300} />;
  } else if (gameState.phase === 'answering') {
    content = <section className="aib-phase-stage aib-answer-stage"><div className="aib-stage-heading"><div><p className="section-kicker">ANSWERING</p><h1>ヒントから答えよう</h1></div><span className="aib-progress">{revealedHintCount} ヒント</span></div><div className="aib-public-hints"><h2>公開されたヒント</h2><HintList hints={gameState.revealedHintHistory} playerName={playerName} /></div><div className="aib-status-row"><span>人間の回答</span><strong>{gameState.humanAnswerSubmitted ? '提出済み' : '待機中'}</strong><span>AI</span><strong>{gameState.aiGuessReady ? '準備完了' : '思考中…'}</strong></div></section>;
    if (isAnswerer && !gameState.humanAnswerSubmitted) composer = <Composer value={text} onChange={setText} onSubmit={submitAnswer} label="お題の答え" placeholder="お題の答え" submitLabel="回答する" maxLength={200} />;
  } else if (gameState.result) {
    content = <ResultPanel result={gameState.result} phase={gameState.phase} onComment={() => setCommentOpen(true)} />;
    if (gameState.phase === 'revealing') bottomAction = isHost ? <button className="button-primary aib-full-button" type="button" onClick={() => void act(handleNextRound)}>次のラウンドへ</button> : <p className="aib-waiting">ホストが次のラウンドを始めるまでお待ちください。</p>;
    if (gameState.phase === 'game_over') bottomAction = isHost ? <button className="button-secondary aib-full-button" type="button" onClick={() => void act(onBackToLobby)}>ロビーに戻る</button> : <p className="aib-waiting">ホストがロビーに戻るまでお待ちください。</p>;
  } else {
    content = <section className="aib-phase-stage"><p className="aib-muted">結果を読み込んでいます…</p></section>;
  }

  return <div className="ai-barenai-game" data-phase={gameState.phase}>{hud}{historyButton && <div className="aib-toolbar">{historyButton}</div>}<main className="aib-main"><div className="aib-stage">{content}</div>{composer && <div className="aib-bottom-composer">{composer}</div>}{bottomAction && <div className="aib-bottom-action">{bottomAction}</div>}{showLobbyLink && <button className="aib-lobby-link" type="button" onClick={() => void act(onBackToLobby)}>ロビーに戻る</button>}{error && <p className="aib-error" role="alert">{error}</p>}</main><PlayersDialog open={playersOpen} onClose={() => setPlayersOpen(false)} players={roomState.players} myUserId={myUserId} /><HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} hints={gameState.revealedHintHistory} answers={answerHistory} playerName={playerName} /><Dialog open={commentOpen} title="AIの感想" onClose={() => setCommentOpen(false)}><p className="aib-comment-full">{gameState.result?.aiComment}</p></Dialog></div>;
}
