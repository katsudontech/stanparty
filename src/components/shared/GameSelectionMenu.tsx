'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { GameArtwork } from '@/components/site/GameArtwork';
import { GAME_GENRES, GAME_PLAY_MODES, getGamePlayerCountGuidance } from '@/games/catalog';
import type { GameCatalogEntry, GameGenre, GamePlayMode, PlayableGameId } from '@/games/catalog';

interface GameSelectionMenuProps {
  games: readonly GameCatalogEntry[];
  playerCount: number;
  value: string;
  onChange: (gameId: PlayableGameId) => Promise<boolean>;
  busy?: boolean;
  error?: string | null;
  /** Allows guests to browse the catalog without changing the room's game. */
  browseOnly?: boolean;
}

export function GameSelectionMenu({ games, playerCount, value, onChange, browseOnly = false, busy = false, error = null }: GameSelectionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<PlayableGameId, HTMLButtonElement>());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [genre, setGenre] = useState<GameGenre | 'all'>('all');
  const [playMode, setPlayMode] = useState<GamePlayMode | 'all'>('all');
  const visibleGames = games.filter((game) =>
    (genre === 'all' || game.genres.includes(genre)) &&
    (playMode === 'all' || game.playMode === playMode),
  );
  const resetFilters = () => { setGenre('all'); setPlayMode('all'); };
  const dialogId = useId();
  const titleId = useId();
  const helperId = useId();
  const dialogHintId = useId();
  const selectedIndex = games.findIndex((game) => game.id === value);
  const selectedGame = selectedIndex >= 0 ? games[selectedIndex] : undefined;
  const firstGameId = visibleGames.find((game) => game.id === value)?.id ?? visibleGames[0]?.id;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      const initialGameId = firstGameId;
      if (initialGameId) optionRefs.current.get(initialGameId)?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [firstGameId, isOpen, selectedGame?.id]);

  const closeMenu = () => {
    setIsOpen(false);
    if (dialogRef.current?.open) dialogRef.current.close();
    triggerRef.current?.focus();
  };

  const openMenu = () => {
    setIsOpen(true);
  };

  const chooseGame = async (gameId: PlayableGameId) => {
    if (browseOnly || busy) return;
    if (gameId === value || await onChange(gameId)) closeMenu();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, gameId: PlayableGameId) => {
    if (visibleGames.length === 0) return;
    const index = visibleGames.findIndex((game) => game.id === gameId);
    if (index < 0) return;

    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % visibleGames.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + visibleGames.length) % visibleGames.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleGames.length - 1;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      optionRefs.current.get(visibleGames[nextIndex].id)?.focus();
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
        disabled={busy}
        aria-busy={busy}
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
            {busy ? '処理中…' : selectedGame?.shortName || value}
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

          <div className="border-b-2 border-[var(--line)] p-3 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                ジャンル
                <select className="form-select mt-1" value={genre} onChange={(event) => setGenre(event.target.value as GameGenre | 'all')}>
                  <option value="all">すべてのジャンル</option>
                  {GAME_GENRES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold">
                プレイ環境
                <select className="form-select mt-1" value={playMode} onChange={(event) => setPlayMode(event.target.value as GamePlayMode | 'all')}>
                  <option value="all">すべてのプレイ環境</option>
                  {Object.entries(GAME_PLAY_MODES).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">オンライン可のゲームは対面でも遊べます。会話が必要なゲームでは、別途通話アプリをご利用ください。</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
              <p role="status">{games.length}件中 {visibleGames.length}件を表示</p>
              <button type="button" className="min-h-11 underline underline-offset-4" onClick={resetFilters} disabled={genre === 'all' && playMode === 'all'}>絞り込みをリセット</button>
            </div>
            {visibleGames.length === 0 && <p className="mt-3 font-bold">条件に合うゲームがありません。条件を変更するか、絞り込みをリセットしてください。</p>}
          </div>
          {busy && <p role="status" className="mb-3 font-bold">ゲームを変更中…</p>}
          {error && <p role="alert" className="mb-3 font-bold text-red-600">{error}</p>}
          <div className="game-selection-grid" aria-label="ゲーム一覧">
            {visibleGames.map((game, index) => {
              const isSelected = game.id === value;
              const playerCountGuidance = getGamePlayerCountGuidance(game, playerCount);

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
                    <p className="game-card__mood">{game.genres.join('・')}</p>
                    <p className="text-sm font-bold">{GAME_PLAY_MODES[game.playMode]}</p>
                    <h3>{game.shortName}</h3>
                    <p>{game.summary}</p>
                    <dl className="game-facts">
                      <div><dt>人数</dt><dd>{game.players}</dd></div>
                      <div><dt>難しさ</dt><dd>{game.difficulty}</dd></div>
                    </dl>
                    <span className="game-selection-card__status" aria-hidden="true">
                      {playerCountGuidance} · {busy ? 'ゲームを変更中…' : isSelected ? '選択中 ✓' : browseOnly ? 'ホストが選択します' : 'このゲームを選ぶ'}
                    </span>
                  </div>
                  <button
                    ref={(element) => {
                      if (element) optionRefs.current.set(game.id, element);
                      else optionRefs.current.delete(game.id);
                    }}
                    type="button"
                    className="game-selection-card__button"
                    aria-label={`${game.shortName}。${game.summary}。${game.genres.join('・')}。${GAME_PLAY_MODES[game.playMode]}。${playerCountGuidance}。${isSelected ? '選択中。' : browseOnly ? 'ホストのみ変更できます。' : 'このゲームを選ぶ。'}`}
                    aria-pressed={isSelected}
                    aria-disabled={browseOnly || busy}
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => chooseGame(game.id)}
                    onKeyDown={(event) => handleOptionKeyDown(event, game.id)}
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
