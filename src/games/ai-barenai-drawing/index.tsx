'use client';

import { useCallback, useEffect, useState } from 'react';

import type { RoomState } from '@/games/core/types';

import { Canvas } from './components/Canvas';
import { useAiBarenaiDrawingGame } from './hooks/useAiBarenaiDrawingGame';

interface Props {
  roomState: RoomState;
  myUserId: string;
  onBackToLobby: () => Promise<void>;
}

export function AiBarenaiDrawingGame({ roomState, myUserId, onBackToLobby }: Props) {
  const {
    state,
    error,
    initialize,
    judge,
    answer,
    continueDrawing,
    topic: loadTopic,
  } = useAiBarenaiDrawingGame(roomState);
  const [topic, setTopic] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  const isHost = roomState.host_id === myUserId;
  const isDrawer = state.drawerId === myUserId;
  const drawer = roomState.players.find((player) => player.userId === state.drawerId);
  const answerers = roomState.players.filter((player) => player.userId !== state.drawerId);
  const playerName = (playerId: string) => (
    roomState.players.find((player) => player.userId === playerId)?.name ?? '参加者'
  );

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      // The game hook exposes the user-facing error.
    }
  };

  const showTopic = useCallback(async () => {
    try {
      const value = await loadTopic();
      if (typeof value === 'object' && value !== null && 'answer' in value) {
        setTopic(String((value as { answer: string }).answer));
      }
    } catch {
      // Non-drawers must not receive the hidden topic before game over.
    }
  }, [loadTopic]);

  useEffect(() => {
    if (state.phase !== 'game_over' || topic !== null) return;
    const timer = window.setTimeout(() => void showTopic(), 0);
    return () => window.clearTimeout(timer);
  }, [showTopic, state.phase, topic]);

  if (state.phase === 'rule_setting') {
    return (
      <main className="ai-barenai-drawing-game ai-barenai-drawing-game--rules paper-card mx-auto min-w-0 max-w-2xl p-5 sm:p-10" data-phase={state.phase}>
        <p className="section-kicker">AI DRAWING GAME</p>
        <h1 className="mt-2 text-3xl font-black">AIにバレるな！お絵かき版</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          人間には伝わるけれど、AIにはまだ伝わらない絵を描きましょう。
        </p>
        {isHost ? (
          <>
            <button className="button-primary mt-7" onClick={() => void runAction(initialize)}>
              ゲームを始める
            </button>
            <button className="text-link mt-6 block" onClick={() => void onBackToLobby()}>
              ← ロビーに戻る
            </button>
          </>
        ) : (
          <p className="mt-7 font-bold text-[var(--muted)]">ホストがゲームを始めるまでお待ちください。</p>
        )}
      </main>
    );
  }

  const phaseLabel = state.phase === 'drawing'
    ? '描画中'
    : state.phase === 'answering'
      ? '回答中'
      : state.phase === 'revealing'
        ? '結果確認'
        : 'ゲーム終了';

  return (
    <main className="ai-barenai-drawing-game mx-auto min-w-0 max-w-3xl" data-phase={state.phase}>
      <header className="aibd-hud paper-card min-w-0 p-5 sm:p-7">
        <div className="aibd-hud__round">
          <p className="section-kicker">ROUND</p>
          <strong>{state.round}</strong>
        </div>
        <span className="aibd-hud__phase">{phaseLabel}</span>
        <div className="aibd-hud__drawer">
          <span>描く人</span>
          <strong>{drawer?.name ?? '決定中'}</strong>
        </div>
        {isDrawer && (
          <div className="aibd-hud__topic">
            {topic ? (
              <p className="font-black text-[var(--purple)]">お題：{topic}</p>
            ) : (
              <button className="button-secondary" onClick={() => void showTopic()}>お題を確認</button>
            )}
          </div>
        )}
      </header>

      <section className="aibd-title" aria-live="polite">
        <h1>AIにバレるな！お絵かき版</h1>
        {state.phase === 'drawing' && (
          <p>
            {isDrawer
              ? '人間には伝わる。でもAIにはバレない絵を狙いましょう。'
              : `${drawer?.name ?? '描く人'}さんがお絵かき中です。絵を見てお題を考えましょう。`}
          </p>
        )}
      </section>

      <section className="aibd-canvas-card paper-card p-5">
        <Canvas
          roomId={roomState.id}
          players={roomState.players}
          drawerId={state.drawerId}
          myUserId={myUserId}
          canDraw={state.phase === 'drawing' && isDrawer}
          onJudge={state.phase === 'drawing' && isDrawer
            ? async (snapshot) => { await judge(snapshot); }
            : undefined}
        />
      </section>

      {state.phase === 'answering' && (
        <section className="aibd-answer-card paper-card p-5">
          <p className="font-bold">絵からお題を1回だけ回答してください。全員の回答が揃うまで内容は公開されません。</p>
          {!isDrawer && !state.answerSubmittedPlayerIds.includes(myUserId) && (
            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(async () => {
                  await answer(answerText);
                  setAnswerText('');
                });
              }}
            >
              <input
                required
                maxLength={200}
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
                className="min-w-0 flex-1 rounded border-2 border-[var(--line)] bg-white p-3"
                placeholder="お題の答え"
              />
              <button className="button-primary" type="submit">回答する</button>
            </form>
          )}
          {!isDrawer && state.answerSubmittedPlayerIds.includes(myUserId) && (
            <p className="mt-4 font-bold text-[var(--muted)]">他のプレイヤーとAIの回答を待っています…</p>
          )}
          <p className="mt-3 text-sm text-[var(--muted)]">
            回答済み {state.answerSubmittedPlayerIds.length}/{answerers.length}・AI {state.aiGuessReady ? '回答済み' : '考え中…'}
          </p>
        </section>
      )}

      {state.result && (
        <section className="aibd-result-card paper-card p-5">
          <p className="section-kicker">RESULT</p>
          <h2 className="mt-2 text-3xl font-black">
            {state.result.winner === 'ai'
              ? 'AIの勝利'
              : state.result.winner === 'humans'
                ? '人間の勝利'
                : '両者不正解'}
          </h2>
          {state.phase === 'game_over' && topic && (
            <p className="mt-3 font-black text-[var(--purple)]">お題：{topic}</p>
          )}
          <p className="mt-4 font-bold">
            AI：{state.result.aiAnswer}（{state.result.aiConfidence}%・{state.result.aiCorrect ? '正解' : '不正解'}）
          </p>
          <div className="mt-3 space-y-2">
            {state.result.answers.map((submittedAnswer) => (
              <p key={submittedAnswer.playerId}>
                {playerName(submittedAnswer.playerId)}：{submittedAnswer.answer}（{submittedAnswer.correct ? '正解' : '不正解'}）
              </p>
            ))}
          </div>
          {state.judgmentHistory.length > 1 && (
            <details className="mt-5 border-t pt-4">
              <summary className="cursor-pointer text-sm font-black">これまでの判定履歴（{state.judgmentHistory.length}回）</summary>
              <div className="mt-3 space-y-3">
                {state.judgmentHistory.map((judgment) => (
                  <div key={judgment.round} className="rounded bg-[var(--surface)] p-3 text-sm">
                    <p className="font-black">Round {judgment.round}</p>
                    <p>AI：{judgment.aiAnswer}（{judgment.aiConfidence}%）</p>
                    <p>人間：{judgment.answers.map((item) => item.answer).join(' / ')}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
          {state.phase === 'revealing' && (
            isDrawer ? (
              <button className="button-primary mt-5" onClick={() => void runAction(continueDrawing)}>
                さらに描く
              </button>
            ) : (
              <p className="mt-5 font-bold text-[var(--muted)]">描く人が再開するのを待っています…</p>
            )
          )}
          {state.phase === 'game_over' && (
            isHost ? (
              <button className="text-link mt-5 block" onClick={() => void onBackToLobby()}>ロビーに戻る</button>
            ) : (
              <p className="mt-5 font-bold text-[var(--muted)]">ホストがロビーに戻るのを待っています…</p>
            )
          )}
        </section>
      )}

      {error && <p role="alert" className="aibd-page-error font-bold text-red-600">{error}</p>}
    </main>
  );
}
