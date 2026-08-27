'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import { Avatar } from '@/components/shared/Avatar';
import type { FakeArtistGameState } from '../types';
import { Canvas } from './Canvas';

interface ResultPhaseProps {
  roomId: string;
  myUserId: string | null;
  players: Player[];
  gameState: FakeArtistGameState;
  isHost: boolean;
  onResetGame: () => Promise<void>;
}

export function ResultPhase({ roomId, myUserId, players, gameState, isHost, onResetGame }: ResultPhaseProps) {
  const winner = gameState.winner;
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleReset = async () => {
    if (isResetting) return;

    setIsResetting(true);
    setResetError(null);
    try {
      await onResetGame();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'ゲームをリセットできませんでした');
    } finally {
      setIsResetting(false);
    }
  };
  
  // 勝敗に応じたメッセージと色を設定
  let winnerText = "結果発表";
  let winnerColor = "text-white";
  let description = "";

  if (winner === 'fake_artist') {
    winnerText = "エセ芸術家の勝利！";
    winnerColor = "text-orange-400";
    if (gameState.fakeArtistGuess) {
      description = "見事、本当のお題を当てて逆転勝利しました！";
    } else {
      description = "見破られずに逃げ切りました！";
    }
  } else if (winner === 'artists') {
    winnerText = "芸術家チームの勝利！";
    winnerColor = "text-green-400";
    if (gameState.fakeArtistGuess) {
      description = "エセ芸術家の逆転チャレンジを防ぎました！";
    } else {
      description = "見事、エセ芸術家を見破りました！";
    }
  }

  // 役職名を見やすく表示するためのヘルパー
  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'fake_artist':
        return <span className="bg-orange-600/30 text-orange-400 border border-orange-600 px-3 py-1 rounded-full text-sm font-bold ml-2">エセ芸術家</span>;
      case 'questioner':
        return <span className="bg-purple-600/30 text-purple-400 border border-purple-600 px-3 py-1 rounded-full text-sm font-bold ml-2">出題者</span>;
      case 'artist':
        return <span className="bg-green-600/30 text-green-400 border border-green-600 px-3 py-1 rounded-full text-sm font-bold ml-2">芸術家</span>;
      default:
        return null;
    }
  };

  return (
    <div className="text-white mt-8">
      <div className="max-w-2xl mx-auto bg-slate-700/50 p-6 sm:p-8 rounded-xl border border-slate-600 flex flex-col items-center mb-8">
        <h3 className={`text-4xl font-bold mb-4 ${winnerColor} animate-bounce`}>
          {winnerText}
        </h3>
        <p className="text-lg text-slate-300 mb-8">{description}</p>

        {/* お題の正解発表 */}
        <div className="bg-slate-800/80 p-6 rounded-lg border border-slate-600 w-full max-w-md mb-8 text-center">
          <p className="text-slate-400 text-sm mb-2">本当のお題（ジャンル：{gameState.themeGenre}）</p>
          <p className="text-3xl font-bold text-white mb-4">{gameState.theme}</p>
          
          {gameState.fakeArtistGuess && (
            <div className="mt-4 pt-4 border-t border-slate-600">
              <p className="text-slate-400 text-sm mb-1">エセ芸術家の推測</p>
              <p className="text-xl font-bold text-orange-300">{gameState.fakeArtistGuess}</p>
            </div>
          )}
        </div>

        {/* プレイヤーの役職一覧 */}
        <div className="w-full max-w-md">
          <h4 className="text-xl font-bold mb-4 text-slate-200 border-b border-slate-600 pb-2">プレイヤーの役職</h4>
          <div className="flex flex-col gap-3">
            {players.map(player => {
              const role = gameState.playerStates[player.userId]?.role;
              const playerColor = gameState.playerStates[player.userId]?.color || player.color;
              return (
                <div 
                  key={player.userId}
                  className="flex items-center justify-between bg-slate-800 p-4 rounded border border-slate-600"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      avatarUrl={player.avatarUrl}
                      name={player.name}
                      color={playerColor}
                      size="md"
                      decorative
                    />
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: playerColor }} aria-hidden="true" />
                    <span className="text-lg font-black" style={{ color: playerColor }}>{player.name}</span>
                  </div>
                  <div>
                    {getRoleBadge(role)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center mb-8">
        <h4 className="text-xl font-bold mb-4 text-slate-300">完成した絵</h4>
        <Canvas 
          roomId={roomId}
          players={players}
          currentTurnPlayerId={null}
          myUserId={myUserId}
          isReadOnly={true}
        />
      </div>

      {/* リセットボタン（ホストのみ操作可能） */}
      <div className="max-w-2xl mx-auto w-full border-t border-slate-600 pt-8 mt-8">
        {isHost ? (
          <button
            onClick={() => void handleReset()}
            disabled={isResetting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isResetting ? 'ゲームをリセット中...' : 'もう一度遊ぶ（ルール選択へ）'}
          </button>
        ) : (
          <div className="bg-slate-800/80 p-4 rounded-xl text-center text-slate-400 font-bold border border-slate-600">
            ホストが次のゲームを準備中です...
          </div>
        )}
        {resetError && <p className="mt-4 rounded-lg border border-rose-500 bg-rose-950/60 p-3 text-sm font-bold text-rose-200" role="alert">{resetError}</p>}
      </div>
    </div>
  );
}
