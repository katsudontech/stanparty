'use client';

import type { Player } from '@/games/core/types';

interface GuessingPhaseProps {
  players: Player[];
}

export function GuessingPhase({ players }: GuessingPhaseProps) {
  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">エセ芸術家の逆転チャレンジ</h3>
      <p className="text-slate-400">見破られたエセ芸術家が、本当のお題を当てる画面です。</p>
    </div>
  );
}
