'use client';

import { useMemo, useState } from 'react';

import type { Player } from '@/games/core/types';

import { getIncorrectItoCardIds, getOrderedItoCards } from '../rules';
import type { ItoGameState } from '../types';

interface ShowdownPhaseProps {
  gameState: ItoGameState;
  players: Player[];
  isHost: boolean;
  onRevealNext: () => Promise<void>;
}

export function ShowdownPhase({
  gameState,
  players,
  isHost,
  onRevealNext,
}: ShowdownPhaseProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.userId, player])),
    [players],
  );
  const orderedCards = getOrderedItoCards(gameState.cards, gameState.cardOrder);
  const revealedCards = orderedCards.slice(0, gameState.revealedCardCount);
  const revealedCardOrder = revealedCards.map((card) => card.id);
  const incorrectCardIds = new Set(
    getIncorrectItoCardIds(revealedCards, revealedCardOrder),
  );

  const handleRevealNext = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onRevealNext();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'カードを公開できませんでした');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">Showdown</p>
        <h2 className="mt-2 text-3xl font-black text-white">小さい順にオープン！</h2>
        <p className="mt-2 font-bold text-slate-400">お題：{gameState.selectedTheme}</p>
      </div>

      <div className="mx-auto max-w-xl space-y-3 rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6">
        <div className="text-center text-xl font-black text-cyan-300">1</div>
        {orderedCards.map((card, index) => {
          const owner = playersById.get(card.ownerId);
          const isRevealed = index < gameState.revealedCardCount;
          const isIncorrect = isRevealed && incorrectCardIds.has(card.id);

          return (
            <article
              key={card.id}
              className={`rounded-2xl border p-4 transition-all duration-500 ${isIncorrect ? 'border-rose-400 bg-rose-400/15' : isRevealed ? 'border-cyan-300/40 bg-cyan-400/10' : 'border-white/10 bg-slate-950'}`}
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
                    {owner?.name ?? '退出したプレイヤー'}・カード{card.ownerCardNumber}
                  </p>
                  <p className="truncate text-sm text-slate-400">{card.hint || 'たとえは口頭で共有'}</p>
                </div>
                <span className={`min-w-14 text-center text-3xl font-black ${isIncorrect ? 'text-rose-300' : 'text-white'}`}>
                  {isRevealed ? card.value : '🂠'}
                </span>
              </div>
            </article>
          );
        })}
        <div className="text-center text-xl font-black text-fuchsia-300">100</div>
      </div>

      <p className="text-sm font-bold text-slate-400">
        {gameState.revealedCardCount}/{orderedCards.length}枚公開
      </p>

      {isHost ? (
        <button
          type="button"
          onClick={handleRevealNext}
          disabled={submitting || gameState.revealedCardCount >= orderedCards.length}
          className="w-full rounded-2xl bg-amber-400 px-5 py-4 text-lg font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40"
        >
          {submitting ? '公開中...' : gameState.revealedCardCount + 1 === orderedCards.length ? '最後のカードをめくる' : '次のカードをめくる'}
        </button>
      ) : (
        <p className="rounded-2xl bg-slate-900 p-4 font-bold text-slate-400">
          ホストがカードをめくっています...
        </p>
      )}

      {errorMessage && (
        <p className="rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{errorMessage}</p>
      )}
    </section>
  );
}
