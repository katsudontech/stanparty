'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import { Canvas } from './Canvas';
import { useVotingSync } from '../hooks/useVotingSync';

interface VotingPhaseProps {
  roomId: string;
  players: Player[];
  myUserId: string | null;
  onVote: (votedPlayerId: string) => void;
  isHost: boolean;
  onAllVoted: () => void;
}

export function VotingPhase({ roomId, players, myUserId, onVote, isHost, onAllVoted }: VotingPhaseProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const { votedPlayersCount } = useVotingSync({
    roomId,
    isHost,
    playersCount: players.length,
    onAllVoted,
  });

  const handleVoteSubmit = () => {
    if (selectedPlayerId) {
      onVote(selectedPlayerId);
      setHasVoted(true);
    }
  };



  return (
    <div className="text-white mt-8">
      <div className="max-w-2xl mx-auto bg-slate-700/50 p-6 sm:p-8 rounded-xl border border-slate-600 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold">投票</h3>
          <span className="bg-slate-600 px-4 py-1 rounded-full text-sm font-bold">
            投票状況: {votedPlayersCount} / {players.length}人
          </span>
        </div>
        <p className="text-slate-400">全員で「誰がエセ芸術家か」を投票する画面です。</p>
      </div>

      <div className="w-full">
        {/* 投票フェーズでは誰も描けないように currentTurnPlayerId={null} を渡します */}
        <Canvas
          roomId={roomId}
          players={players}
          currentTurnPlayerId={null}
          myUserId={myUserId}
        />
      </div>

      <div className="max-w-2xl mx-auto bg-slate-700/50 p-6 sm:p-8 rounded-xl border border-slate-600 mt-8">
        <div className="flex flex-wrap gap-4 justify-center">
          {players.map((player) => {
            const isSelected = selectedPlayerId === player.userId;
            return (
              <button
                key={player.userId}
                disabled={myUserId === player.userId || hasVoted}
                onClick={() => setSelectedPlayerId(player.userId)}
                className={`px-6 py-3 rounded-md transition-all border-2 font-bold ${isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/50 scale-105'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  } ${myUserId === player.userId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {player.name}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            disabled={!selectedPlayerId || hasVoted}
            onClick={handleVoteSubmit}
            className={`px-10 py-4 rounded-full font-bold text-lg transition-all ${hasVoted
                ? 'bg-emerald-600 text-white'
                : !selectedPlayerId
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400 hover:-translate-y-1 shadow-xl shadow-indigo-500/30'
              }`}
          >
            {hasVoted ? '投票完了！' : 'この人に投票する'}
          </button>
        </div>
      </div>
    </div>
  );
}
