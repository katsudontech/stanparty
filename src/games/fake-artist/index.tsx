'use client';

import type { Player } from '@/games/core/types';
import { GameHeader } from './components/GameHeader';
import { GameStatus } from './components/GameStatus';
import { Canvas } from './components/Canvas';
import type { RoomState } from '@/types/schemas';

interface FakeArtistGameProps {
  roomState: RoomState;
}

export function FakeArtistGame({ roomState }: FakeArtistGameProps) {


  return (
    <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center border border-slate-700">
      <GameHeader roomId={roomState.roomId} />

      <GameStatus
        players={roomState.players}
        currentPhase="role_assignment"
      />

      <Canvas
        players={roomState.players}
        currentTurnPlayerId={roomState.players[0]?.userId || null}
      />
    </div>
  );
}
