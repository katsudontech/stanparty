'use client';

import type { Player } from '@/games/core/types';

interface VotingPhaseProps {
  players: Player[];
}

export function VotingPhase({ players }: VotingPhaseProps) {
  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">投票</h3>
      <p className="text-slate-400">全員で「誰がエセ芸術家か」を投票する画面です。</p>
    </div>
  );
}
