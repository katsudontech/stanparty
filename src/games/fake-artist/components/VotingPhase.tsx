'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import { Avatar } from '@/components/shared/Avatar';
import { Canvas } from './Canvas';
import { useVotingSync } from '../hooks/useVotingSync';

interface VotingPhaseProps {
  roomId: string;
  players: Player[];
  myUserId: string | null;
  onVote: (votedPlayerId: string) => Promise<void>;
  isHost: boolean;
  onAllVoted: () => Promise<void>;
}

export function VotingPhase({ roomId, players, myUserId, onVote, isHost, onAllVoted }: VotingPhaseProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  const {
    votedPlayersCount,
    hasCurrentPlayerVoted,
    isSyncReady,
    isFinalizing,
    syncError,
    progressionError,
    retryFinalization,
  } = useVotingSync({
    roomId,
    myUserId,
    isHost,
    playersCount: players.length,
    onAllVoted,
  });
  const hasVoted = hasSubmittedVote || hasCurrentPlayerVoted;

  const handleVoteSubmit = async () => {
    if (!selectedPlayerId || hasVoted || isSubmitting || !isSyncReady) return;

    setIsSubmitting(true);
    setVoteError(null);
    try {
      await onVote(selectedPlayerId);
      setHasSubmittedVote(true);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : '投票できませんでした');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="text-white mt-8">
      <div className="max-w-2xl mx-auto bg-slate-700/50 p-6 sm:p-8 rounded-xl border border-slate-600 mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-bold">投票</h3>
          <span className="bg-slate-600 px-4 py-1 rounded-full text-sm font-bold">
            投票状況: {votedPlayersCount} / {players.length}人{isFinalizing ? '（集計中）' : ''}
          </span>
        </div>
        <p className="text-slate-400">全員で「誰がエセ芸術家か」を投票する画面です。</p>
        {(syncError || voteError || progressionError) && (
          <div className="mt-4 rounded-lg border border-rose-500 bg-rose-950/60 px-4 py-3 text-sm font-bold text-rose-200" role="alert">
            <p>{voteError || progressionError || syncError}</p>
            {isHost && (progressionError || syncError) && (
              <button
                type="button"
                onClick={() => void retryFinalization()}
                disabled={isFinalizing}
                className="mt-3 min-h-11 max-w-full rounded-md bg-rose-600 px-4 py-2 text-white disabled:opacity-50"
              >
                投票結果の集計を再試行
              </button>
            )}
          </div>
        )}
      </div>

      <div className="w-full">
        {/* 投票フェーズでは誰も描けないように currentTurnPlayerId={null} を渡します */}
        <Canvas
          roomId={roomId}
          players={players}
          currentTurnPlayerId={null}
          myUserId={myUserId}
          isReadOnly={true}
        />
      </div>

      <div className="max-w-2xl mx-auto bg-slate-700/50 p-6 sm:p-8 rounded-xl border border-slate-600 mt-8">
        <div className="flex flex-wrap gap-4 justify-center">
          {players.map((player) => {
            const isSelected = selectedPlayerId === player.userId;
            return (
              <button
                key={player.userId}
                disabled={!isSyncReady || myUserId === player.userId || hasVoted || isSubmitting}
                onClick={() => setSelectedPlayerId(player.userId)}
                className={`flex min-w-0 items-center gap-3 px-4 py-3 rounded-md transition-all border-2 font-bold ${isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/50 scale-105'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  } ${myUserId === player.userId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Avatar
                  avatarUrl={player.avatarUrl}
                  name={player.name}
                  color={player.color}
                  size="sm"
                  decorative
                />
                <span className="max-w-40 truncate font-black" style={{ color: player.color }}>{player.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            disabled={!isSyncReady || !selectedPlayerId || hasVoted || isSubmitting}
            onClick={() => void handleVoteSubmit()}
            className={`px-10 py-4 rounded-full font-bold text-lg transition-all ${hasVoted
                ? 'bg-emerald-600 text-white'
                : !selectedPlayerId
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400 hover:-translate-y-1 shadow-xl shadow-indigo-500/30'
              }`}
          >
            {hasVoted ? '投票完了！' : isSubmitting ? '投票中...' : !isSyncReady ? '投票状況を同期中...' : 'この人に投票する'}
          </button>
        </div>
      </div>
    </div>
  );
}
