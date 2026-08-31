'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { GameArtwork } from '@/components/site/GameArtwork';
import type { GameCatalogEntry, PlayableGameId } from '@/games/catalog';

interface GameSelectionMenuProps {
  games: readonly GameCatalogEntry[];
  value: string;
  onChange: (gameId: PlayableGameId) => void;
  /** Allows guests to browse the catalog without changing the room's game. */
  browseOnly?: boolean;
}

export function GameSelectionMenu({ games, value, onChange, browseOnly = false }: GameSelectionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const titleId = useId();
  const helperId = useId();
  const dialogHintId = useId();
  const selectedIndex = games.findIndex((game) => game.id === value);
  const selectedGame = selectedIndex >= 0 ? games[selectedIndex] : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, selectedIndex]);

  const closeMenu = () => {
    setIsOpen(false);
    if (dialogRef.current?.open) dialogRef.current.close();
    triggerRef.current?.focus();
  };

  const openMenu = () => {
    setIsOpen(true);
  };

  const chooseGame = (gameId: PlayableGameId) => {
    if (browseOnly) return;

    onChange(gameId);
    closeMenu();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (games.length === 0) return;

    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % games.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + games.length) % games.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = games.length - 1;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    closeMenu();
  };

  if (games.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        className="form-select flex cursor-pointer items-center justify-between gap-4 text-left"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        aria-describedby={browseOnly ? helperId : undefined}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="min-w-0">
          <span className="block truncate text-lg font-black">
            {selectedGame?.shortName || value}
          </span>
          <span className="mt-1 block truncate text-xs font-bold text-[var(--muted)]">
            {selectedGame?.summary || 'ゲームを選択してください'}
          </span>
        </span>
        <svg
          className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {browseOnly && (
        <p id={helperId} className="mt-2 text-xs font-bold text-[var(--muted)]">
          ホストのみゲームを変更できます。ゲームカードを見て選び方を確認できます。
        </p>
      )}

      <dialog
        id={dialogId}
        ref={dialogRef}
        className="game-selection-dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={dialogHintId}
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClose={() => {
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={handleBackdropClick}
      >
        <div className="game-selection-dialog__panel" onClick={(event) => event.stopPropagation()}>
          <header className="game-selection-dialog__header">
            <div className="min-w-0">
              <p className="section-kicker">Choose a game</p>
              <h2 id={titleId}>遊ぶゲームを選ぶ</h2>
              <p id={dialogHintId} className="game-selection-dialog__hint">
                {browseOnly ? 'カードを見て遊び方を確認できます。変更はホストだけができます。' : '遊びたいゲームをカードから選んでください。'}
              </p>
            </div>
            <button
              type="button"
              className="game-selection-dialog__close"
              onClick={closeMenu}
              aria-label="ゲーム選択を閉じる"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div className="game-selection-grid" aria-label="ゲーム一覧">
            {games.map((game, index) => {
              const isSelected = game.id === value;

              return (
                <article
                  key={game.id}
                  className={`game-card game-selection-card ${isSelected ? 'is-selected' : ''} ${browseOnly ? 'is-browse-only' : ''}`}
                  style={{ '--game-accent': game.accent, '--game-soft': game.softColor } as CSSProperties}
                >
                  <div className="game-card__topline">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{game.duration}</span>
                  </div>
                  <GameArtwork gameId={game.id} className="game-card__art" />
                  <div className="game-card__body">
                    <p className="game-card__mood">{game.mood}</p>
                    <h3>{game.shortName}</h3>
                    <p>{game.summary}</p>
                    <dl className="game-facts">
                      <div><dt>人数</dt><dd>{game.players}</dd></div>
                      <div><dt>難しさ</dt><dd>{game.difficulty}</dd></div>
                    </dl>
                    <span className="game-selection-card__status" aria-hidden="true">
                      {isSelected ? '選択中 ✓' : browseOnly ? 'ホストが選択します' : 'このゲームを選ぶ'}
                    </span>
                  </div>
                  <button
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="button"
                    className="game-selection-card__button"
                    aria-label={`${game.shortName}。${game.summary}。${isSelected ? '選択中。' : browseOnly ? 'ホストのみ変更できます。' : 'このゲームを選ぶ。'}`}
                    aria-pressed={isSelected}
                    aria-disabled={browseOnly}
                    onClick={() => chooseGame(game.id)}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  />
                </article>
              );
            })}
          </div>
        </div>
      </dialog>
    </div>
  );
}
