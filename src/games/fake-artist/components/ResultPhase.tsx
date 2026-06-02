'use client';

import type { Player } from '@/games/core/types';

interface ResultPhaseProps {
  players: Player[];
}

export function ResultPhase({ players }: ResultPhaseProps) {
  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">結果発表</h3>
      <p className="text-slate-400">勝敗とスコアを表示する画面です。</p>
    </div>
  );
}
