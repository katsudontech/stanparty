'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(0, games.findIndex((game) => game.id === value)),
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const helperId = useId();
  const selectedIndex = games.findIndex((game) => game.id === value);
  const selectedGame = selectedIndex >= 0 ? games[selectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[highlightedIndex]?.focus();
    }
  }, [highlightedIndex, isOpen]);

  const openMenu = () => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const chooseGame = (gameId: PlayableGameId) => {
    onChange(gameId);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index + 1) % games.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index - 1 + games.length) % games.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(games.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!browseOnly) {
        chooseGame(games[index].id);
      }
    }
  };

  if (games.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        ref={triggerRef}
        className="form-select flex cursor-pointer items-center justify-between gap-4 text-left"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-describedby={browseOnly ? helperId : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
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
          ホストのみゲームを変更できます。ゲーム名と概要を確認できます。
        </p>
      )}

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="遊ぶゲーム"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-20 max-h-80 overflow-y-auto border-2 border-[var(--line)] bg-[var(--surface)] p-2 shadow-[5px_5px_0_var(--line)]"
        >
          {games.map((game, index) => (
            <button
              key={game.id}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={game.id === value}
              aria-disabled={browseOnly}
              className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors ${
                index === highlightedIndex ? 'bg-[var(--paper-deep)]' : 'bg-transparent hover:bg-[var(--paper-deep)]'
              }`}
              onClick={() => {
                if (!browseOnly) {
                  chooseGame(game.id);
                }
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span className="min-w-0">
                <span className="block font-black text-[var(--ink)]">{game.shortName}</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-[var(--muted)]">{game.summary}</span>
              </span>
              {game.id === value && (
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green)]" viewBox="0 0 20 20" fill="currentColor" aria-label="選択中">
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.416 0l-3.75-3.75a1 1 0 011.414-1.42l3.043 3.043 6.543-6.543a1 1 0 011.416 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
