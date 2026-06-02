'use client';

import type { Player } from '@/games/core/types';

interface CanvasProps {
  players: Player[];
  currentTurnPlayerId: string | null;
}

export function Canvas({ players, currentTurnPlayerId }: CanvasProps) {
  // ターンプレイヤーの名前を検索
  const turnPlayer = players.find(p => p.userId === currentTurnPlayerId);
  const turnPlayerName = turnPlayer?.name || (players.length > 0 ? players[0]?.name : 'だれか');

  return (
    <div className="w-full max-w-2xl h-80 bg-white rounded-xl shadow-inner flex flex-col items-center justify-center text-slate-400 relative overflow-hidden">
      <span className="text-6xl mb-4 opacity-20">🎨</span>
      <span className="font-bold text-xl">キャンバスのモックアップ</span>
      <div className="absolute bottom-4 right-4 bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-sm font-bold shadow">
        {turnPlayerName} のターン
      </div>
    </div>
  );
}
