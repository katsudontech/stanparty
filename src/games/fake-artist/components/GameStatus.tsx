'use client';

import type { Player } from '@/games/core/types';
import type { FakeArtistPhase } from '../types';

interface GameStatusProps {
  players: Player[];
  currentPhase: FakeArtistPhase;
}

export function GameStatus({ players, currentPhase }: GameStatusProps) {
  return (
    <div className="grid grid-cols-2 gap-6 w-full max-w-2xl mb-8">
      <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600">
        <p className="text-slate-400 mb-2 font-medium">参加プレイヤー</p>
        <p className="text-4xl font-bold text-white">
          {players.length}<span className="text-xl text-slate-500 ml-1">人</span>
        </p>
      </div>
      
      <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600">
        <p className="text-slate-400 mb-2 font-medium">現在のフェーズ</p>
        <p className="text-2xl font-bold text-blue-400 mt-2">{currentPhase}</p>
      </div>
    </div>
  );
}
