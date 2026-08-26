'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { GameArtwork } from '@/components/site/GameArtwork';

import type { GameCatalogEntry } from '@/games/catalog';

interface GameRulesDialogProps {
  game: GameCatalogEntry;
  isOpen: boolean;
  onClose: () => void;
}

export function GameRulesDialog({ game, isOpen, onClose }: GameRulesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickedOutside =
      event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom;

    if (clickedOutside) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="rules-dialog"
      style={{ '--game-accent': game.accent, '--game-soft': game.softColor } as CSSProperties}
      aria-labelledby="game-rules-title"
      aria-describedby="game-rules-summary"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="max-h-[88dvh] overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b-2 border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[.14em] text-[var(--game-accent)] sm:text-xs">
              GAME RULES
            </p>
            <p className="mt-0.5 flex items-center gap-2 truncate text-xs font-bold text-[var(--muted)]">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--green)]" aria-hidden="true" />
              ロビーを開いたまま確認中
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--line)] bg-[var(--paper-deep)] text-2xl font-black leading-none transition hover:bg-[var(--game-soft)] focus:outline-none focus:ring-4 focus:ring-[var(--yellow)]"
            aria-label="ルールを閉じる"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="bg-[var(--surface)]">
          <section className="grid items-center gap-5 bg-[var(--game-soft)] px-5 py-7 sm:grid-cols-[1fr_240px] sm:px-8 sm:py-9">
            <div>
              <p className="text-xs font-black tracking-[.14em] text-[var(--game-accent)]">{game.mood}</p>
              <h2 id="game-rules-title" className="mt-2 text-4xl font-black tracking-[-.06em] sm:text-5xl">
                {game.shortName}
              </h2>
              <p className="mt-4 max-w-xl text-lg font-black leading-7">{game.catchphrase}</p>
            </div>
            <GameArtwork gameId={game.id} className="mx-auto h-40 w-full max-w-60" />
          </section>

          <dl className="grid grid-cols-2 border-y-2 border-[var(--line)] sm:grid-cols-4">
            {[
              ['人数', game.players],
              ['時間', game.duration],
              ['難しさ', game.difficulty],
              ['タイプ', game.mood],
            ].map(([term, value], index) => (
              <div
                key={term}
                className={`px-4 py-4 ${index % 2 === 1 ? 'border-l-2 border-[var(--line)]' : ''} ${index >= 2 ? 'border-t-2 border-[var(--line)] sm:border-t-0' : ''} sm:border-l-2 sm:border-[var(--line)] sm:first:border-l-0`}
              >
                <dt className="text-[11px] font-black text-[var(--muted)]">{term}</dt>
                <dd className="mt-1 font-black">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-10 px-5 py-8 sm:px-8 sm:py-10">
            <section aria-labelledby="game-rules-overview">
              <p className="section-kicker">Overview</p>
              <h3 id="game-rules-overview" className="mt-2 text-2xl font-black tracking-[-.04em]">
                まず知っておくこと
              </h3>
              <div id="game-rules-summary" className="mt-5 space-y-3 font-medium leading-7 text-[var(--muted)]">
                {game.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>

            <section aria-labelledby="game-rules-steps">
              <p className="section-kicker">How to play</p>
              <h3 id="game-rules-steps" className="mt-2 text-2xl font-black tracking-[-.04em]">
                ゲームの流れ
              </h3>
              <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                {game.steps.map((step, index) => (
                  <li key={step.title} className="border-2 border-[var(--line)] bg-[var(--paper)] p-4">
                    <div className="flex items-start gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center bg-[var(--game-accent)] text-xl font-black text-white" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-black">{step.title}</h4>
                        <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{step.body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="border-t-2 border-[var(--line)] pt-6" aria-labelledby="game-rules-tips">
              <h3 id="game-rules-tips" className="text-xl font-black tracking-[-.03em]">盛り上がるコツ</h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {game.tips.map((tip) => (
                  <li key={tip} className="flex gap-3 text-sm font-bold leading-6">
                    <span className="text-[var(--game-accent)]" aria-hidden="true">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            <button type="button" onClick={onClose} className="button-secondary w-full">
              ルールを閉じてロビーに戻る
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
