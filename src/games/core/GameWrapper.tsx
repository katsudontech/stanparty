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
    <div className="min-h-screen bg-slate-900 text-white p-1 sm:p-2 font-sans overflow-x-hidden">
      <div className="w-full mx-auto">
        <header className="flex justify-between items-center mb-2 pb-2 sm:mb-4 sm:pb-4 border-b border-slate-700 px-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">
              SP
            </div>
            <h1 className="text-xl font-bold tracking-wider">STANPARTY</h1>
          </div>
          
          <button 
            className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700"
            onClick={() => alert('TODO: 退室処理')}
          >
            退出する
          </button>
        </header>

        {showPlayerBar && (
          <section className="mb-4 rounded-2xl border border-slate-700 bg-slate-800/80 p-3" aria-label="参加プレイヤー">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {players.map((player) => {
                const isMe = player.userId === myUserId;

                return (
                  <div
                    key={player.userId}
                    className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 ${
                      isMe
                        ? 'border-indigo-400/70 bg-indigo-500/15'
                        : 'border-slate-700 bg-slate-900/70'
                    }`}
                  >
                    <Avatar
                      avatarUrl={player.avatarUrl}
                      name={player.name}
                      color={player.color}
                      size="sm"
                      decorative
                    />
                    <span className="max-w-28 truncate text-sm font-bold text-slate-100">
                      {player.name}
                    </span>
                    {isMe && <span className="text-[10px] font-black text-indigo-300">あなた</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        
        <main className="animate-in fade-in duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
