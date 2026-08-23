'use client';

import { useMemo, useState } from 'react';

import type { Player } from '@/games/core/types';

import { getIncorrectItoCardIds, getOrderedItoCards } from '../rules';
import type { ItoGameState } from '../types';

interface ResultPhaseProps {
  gameState: ItoGameState;
  players: Player[];
  isHost: boolean;
  onResetGame: () => Promise<void>;
  onBackToLobby: () => Promise<void>;
}

export function ResultPhase({
  gameState,
  players,
  isHost,
  onResetGame,
  onBackToLobby,
}: ResultPhaseProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.userId, player])),
    [players],
  );
  const orderedCards = getOrderedItoCards(gameState.cards, gameState.cardOrder);
  const incorrectCardIds = new Set(
    getIncorrectItoCardIds(gameState.cards, gameState.cardOrder),
  );
  const succeeded = gameState.result === 'success';

  const runAction = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '操作に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className={`rounded-3xl border p-7 ${succeeded ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-rose-400/30 bg-rose-400/10'}`}>
        <p className={`text-sm font-black uppercase tracking-[0.3em] ${succeeded ? 'text-emerald-300' : 'text-rose-300'}`}>
          {succeeded ? 'Success' : 'Failed'}
        </p>
        <h2 className="mt-2 text-4xl font-black text-white">
          {succeeded ? 'きれいに並びました！' : '惜しい！順番が違いました'}
        </h2>
        <p className="mt-3 font-bold text-slate-300">お題：{gameState.selectedTheme}</p>
      </div>

      <div className="mx-auto max-w-xl space-y-3 rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6">
        <div className="text-center text-xl font-black text-cyan-300">1</div>
        {orderedCards.map((card, index) => {
          const owner = playersById.get(card.ownerId);
          const isIncorrect = incorrectCardIds.has(card.id);
          return (
            <article
              key={card.id}
              className={`rounded-2xl border p-4 ${isIncorrect ? 'border-rose-400 bg-rose-400/15' : 'border-white/10 bg-slate-950'}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-white"
                  style={{ backgroundColor: owner?.color ?? '#475569' }}
                >
                  {owner?.name?.charAt(0) ?? '?'}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate font-black text-white">
                    {index + 1}. {owner?.name ?? '退出したプレイヤー'}・カード{card.ownerCardNumber}
                  </p>
                  <p className="truncate text-sm text-slate-400">{card.hint || 'たとえは口頭で共有'}</p>
                </div>
                <span className={`text-3xl font-black ${isIncorrect ? 'text-rose-300' : 'text-white'}`}>
                  {card.value}
                </span>
              </div>
            </article>
          );
        })}
        <div className="text-center text-xl font-black text-fuchsia-300">100</div>
      </div>

      {isHost ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => runAction(onResetGame)}
            disabled={submitting}
            className="rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            もう一度遊ぶ
          </button>
          <button
            type="button"
            onClick={() => runAction(onBackToLobby)}
            disabled={submitting}
            className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-4 font-black text-white hover:bg-slate-700 disabled:opacity-40"
          >
            ロビーへ戻る
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-900 p-4 font-bold text-slate-400">
          ホストが次のゲームを準備しています...
        </p>
      )}

      {errorMessage && (
        <p className="rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{errorMessage}</p>
      )}
    </section>
  );
}
