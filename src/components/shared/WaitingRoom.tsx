'use client';

import { useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { GameSelectionMenu } from '@/components/shared/GameSelectionMenu';
import { GameRulesDialog } from '@/components/shared/GameRulesDialog';
import { buildLineInviteUrl } from '@/components/shared/lineInvite';
import { SiteHeader } from '@/components/site/SiteHeader';
import { GAME_CATALOG, getGameById, getGamePlayerCountError } from '@/games/catalog';

import type { RoomState, Player } from '@/games/core/types';

interface WaitingRoomProps {
  roomState: RoomState;
  players: Player[];
  onlineUserIds: string[];
  isHost: boolean;
  onStartGame: () => void;
  onChangeGame: (gameId: string) => void;
}

export function WaitingRoom({ roomState, players, onlineUserIds, isHost, onStartGame, onChangeGame }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const onlineUserIdSet = new Set(onlineUserIds);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  };

  const handleLineInvite = () => {
    window.open(
      buildLineInviteUrl(window.location.href),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const selectedGame = getGameById(roomState.game_type);
  const playerCountError = getGamePlayerCountError(roomState.game_type, players.length);

  const handleStartGame = () => {
    if (playerCountError) return;
    onStartGame();
  };

  return (
    <div className="site-shell mobile-page mobile-page--finite">
      <SiteHeader compact />
      <main className="site-container mobile-page__main py-10 sm:py-14">
        <div className="mb-9 flex min-w-0 flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0"><p className="section-kicker">Waiting room</p><h1 className="mt-2 text-[clamp(2.25rem,10vw,3rem)] font-black tracking-[-.055em] sm:text-5xl">みんなを待っています。</h1></div>
          <div className="waiting-room__invite-actions flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleLineInvite}
              className="button-secondary button-line shrink-0"
              aria-label="LINEでルームに招待"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 11.5a8.38 8.38 0 01-9 8.5 9.5 9.5 0 01-4.5-1.1L3 20l1.35-3.6A8.1 8.1 0 013 11.5C3 6.8 7 3 12 3s9 3.8 9 8.5z" />
              </svg>
              LINEで招待
            </button>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="button-secondary shrink-0"
            >
              {copied ? (
                <>
                  <svg className="h-5 w-5 text-[var(--green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>コピーしました</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  招待URLをコピー
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr]">
          <section className="paper-card waiting-room__panel waiting-room__panel--players min-w-0 p-5 sm:p-7">
          <div className="mb-5 flex items-end justify-between gap-3 border-b-2 border-[var(--line)] pb-4">
            <h2 className="text-xl font-black">参加者</h2>
            <span className="text-sm font-bold text-[var(--muted)]">{players.length}人</span>
          </div>

          <ul className="waiting-room__players space-y-2">
            {players.map((player, index) => (
              <li key={player.userId || index} className="flex min-w-0 items-center gap-3 border-b border-[#c8c6b9] p-3 last:border-0 sm:gap-4">
                <Avatar
                  avatarUrl={player.avatarUrl}
                  name={player.name || '名無し'}
                  color={player.color || '#3B82F6'}
                  size="lg"
                  decorative
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate font-black text-[var(--ink)]">{player.name || '名無し'}</span>
                    {player.isHost && (
                      <span className="border border-[var(--line)] bg-[var(--yellow)] px-2 py-0.5 text-[10px] font-black">
                        ホスト
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--muted)]">
                    <span className={`mr-1 inline-block h-2 w-2 rounded-full ${onlineUserIdSet.has(player.userId) ? 'bg-[var(--green)]' : 'bg-[#a39f92]'}`} />
                    {onlineUserIdSet.has(player.userId) ? 'オンライン' : 'オフライン'}
                  </span>
                </div>
              </li>
            ))}

            {players.length === 0 && (
              <div className="border-2 border-dashed border-[#b9b5a8] py-8 text-center font-bold text-[var(--muted)]">
                誰もいません
              </div>
            )}
          </ul>
          </section>

          <section className="paper-card waiting-room__panel waiting-room__panel--game min-w-0 p-5 sm:p-7">
          <p className="text-xs font-black tracking-[.14em] text-[var(--orange)]">PLAY NEXT</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">遊ぶゲームを選ぶ</h2>
          <div className="mt-6 border-y-2 border-[var(--line)] py-5">
            <GameSelectionMenu
              games={GAME_CATALOG}
              value={roomState.game_type}
              onChange={onChangeGame}
              browseOnly={!isHost}
            />
            {selectedGame && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="text-link self-start"
                  aria-haspopup="dialog"
                  onClick={() => setIsRulesOpen(true)}
                >
                  詳しいルールを見る →
                </button>
                <p className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--green)]" aria-hidden="true" />
                  ロビーを離れずに開きます
                </p>
              </div>
            )}
            {playerCountError && (
              <p className="mt-3 border-2 border-[var(--orange)] bg-[#fff0e6] px-3 py-2 text-sm font-black text-[#9f3d26]" role="alert">
                {playerCountError}
              </p>
            )}
          </div>

          {isHost ? (
            <button
              className="button-primary mt-6 w-full text-lg"
              onClick={handleStartGame}
              disabled={Boolean(playerCountError)}
            >
              {playerCountError ? '参加者を待っています' : 'このゲームを開始 →'}
            </button>
          ) : (
            <div className="mt-6 w-full border-2 border-dashed border-[#b9b5a8] bg-[var(--paper-deep)] px-4 py-4 text-center font-bold text-[var(--muted)]">
              ホストの開始を待機中...
            </div>
          )}
          </section>
        </div>
      </main>
      {selectedGame && (
        <GameRulesDialog
          game={selectedGame}
          isOpen={isRulesOpen}
          onClose={() => setIsRulesOpen(false)}
        />
      )}
    </div>
  );
}
