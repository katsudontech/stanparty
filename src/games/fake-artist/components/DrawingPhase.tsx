'use client';

import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';
import { Canvas } from './Canvas';

interface DrawingPhaseProps {
  roomId: string;
  players: Player[];
  gameState: FakeArtistGameState;
  myUserId: string | null;
  onTurnEnd: () => void;
}

export function DrawingPhase({ roomId, players, gameState, myUserId, onTurnEnd }: DrawingPhaseProps) {
  const { currentTurnPlayerId } = gameState;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <Canvas 
        roomId={roomId}
        players={players} 
        currentTurnPlayerId={currentTurnPlayerId} 
        myUserId={myUserId}
        onTurnEnd={onTurnEnd}
      />
    </div>
  );
}
