'use client';

import type { Player } from '@/games/core/types';

interface RuleSettingPhaseProps {
  players: Player[];
}

export function RuleSettingPhase({ players }: RuleSettingPhaseProps) {
  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">ルール設定</h3>
      <p className="text-slate-400">ホストがゲームのルール（お題のジャンルなど）を設定する画面です。</p>
    </div>
  );
}
