'use client';

import type { Player } from '@/games/core/types';
import { GameHeader } from './components/GameHeader';
import { GameStatus } from './components/GameStatus';
import { Canvas } from './components/Canvas';

interface FakeArtistGameProps {
  roomId: string;
  players: Player[];
}

export function FakeArtistGame({ roomId, players }: FakeArtistGameProps) {
  return (
    <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center border border-slate-700">
      <GameHeader roomId={roomId} />
      
      <GameStatus 
        players={players} 
        currentPhase="role_assignment" 
      />

      <Canvas 
        players={players} 
        currentTurnPlayerId={players[0]?.userId || null} 
      />
    </div>
  );
}
