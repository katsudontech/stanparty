'use client';

import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';

interface ResultPhaseProps {
  players: Player[];
  gameState: FakeArtistGameState;
}

export function ResultPhase({ players, gameState }: ResultPhaseProps) {
  const winner = gameState.winner;
  
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
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600 flex flex-col items-center">
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
            return (
              <div 
                key={player.userId}
                className="flex items-center justify-between bg-slate-800 p-4 rounded border border-slate-600"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: player.color }} 
                  />
                  <span className="font-bold text-lg">{player.name}</span>
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
  );
}
