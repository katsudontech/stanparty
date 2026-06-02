'use client';

import type { Player } from '@/games/core/types';

interface ThemeSelectionPhaseProps {
  players: Player[];
}

export function ThemeSelectionPhase({ players }: ThemeSelectionPhaseProps) {
  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">お題決定</h3>
      <p className="text-slate-400">出題者が今回のお題を決める画面です。</p>
    </div>
  );
}
