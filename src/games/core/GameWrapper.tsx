'use client';

import { ReactNode } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import type { Player } from '@/games/core/types';

interface GameWrapperProps {
  children: ReactNode;
  players: Player[];
  myUserId: string | null;
  showPlayerBar?: boolean;
}

export function GameWrapper({ children, players, myUserId, showPlayerBar = true }: GameWrapperProps) {
  return (
    <div className="party-game min-h-screen overflow-x-clip bg-[var(--paper)] p-2 text-[var(--ink)] sm:p-4">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-3 flex items-center border-b-2 border-[var(--line)] px-1 pb-3 sm:mb-5 sm:pb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="site-brand__mark">
              SP
            </div>
            <h1 className="text-base font-black tracking-[-.03em] sm:text-lg">StanParty</h1>
          </div>
        </header>

        {showPlayerBar && (
          <section className="mb-4 border-y-2 border-[var(--line)] py-3" aria-label="参加プレイヤー">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {players.map((player) => {
                const isMe = player.userId === myUserId;

                return (
                  <div
                    key={player.userId}
                    className={`flex shrink-0 items-center gap-2 border px-3 py-2 ${
                      isMe
                        ? 'border-[var(--line)] bg-[var(--yellow)]'
                        : 'border-[#b7b3a7] bg-[var(--surface)]'
                    }`}
                  >
                    <Avatar
                      avatarUrl={player.avatarUrl}
                      name={player.name}
                      color={player.color}
                      size="sm"
                      decorative
                    />
                    <span className="max-w-28 truncate text-sm font-black">
                      {player.name}
                    </span>
                    {isMe && <span className="text-[10px] font-black">あなた</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}
