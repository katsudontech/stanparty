'use client';

import type { Player } from '@/games/core/types';

interface RoleAssignmentPhaseProps {
  players: Player[];
  myUserId: string | null;
}

export function RoleAssignmentPhase({ players, myUserId }: RoleAssignmentPhaseProps) {
  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">役職確認</h3>
      <p className="text-slate-400">自分が「エセ芸術家」か「本物の芸術家」かを確認する画面です。</p>
    </div>
  );
}
