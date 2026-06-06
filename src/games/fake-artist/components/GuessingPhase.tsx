'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';
import { Canvas } from './Canvas';

interface GuessingPhaseProps {
  roomId: string;
  players: Player[];
  gameState: FakeArtistGameState;
  myUserId: string | null;
  isHost: boolean;
  onGuessSubmit: (guess: string) => void;
  onJudgeSubmit: (isCorrect: boolean) => void;
}

export function GuessingPhase({ roomId, players, gameState, myUserId, isHost, onGuessSubmit, onJudgeSubmit }: GuessingPhaseProps) {
  const [guessInput, setGuessInput] = useState('');

  // エセ芸術家のIDを特定
  const fakeArtistId = Object.keys(gameState.playerStates).find(
    id => gameState.playerStates[id]?.role === 'fake_artist'
  );

  // 判定者のIDを特定（基本はホスト、ホストがエセ芸術家なら他の誰か）
  const hostPlayer = players.find(p => p.isHost);
  let judgeId = hostPlayer?.userId;
  if (judgeId === fakeArtistId) {
    judgeId = gameState.turnOrder.find(id => id !== fakeArtistId) || players[0]?.userId;
  }

  const isFakeArtist = myUserId === fakeArtistId;
  const isJudge = myUserId === judgeId;
  const hasGuessed = gameState.fakeArtistGuess !== null;

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guessInput.trim()) {
      onGuessSubmit(guessInput.trim());
    }
  };

  return (
    <div className="text-white mt-8">
      <div className="max-w-2xl mx-auto bg-slate-700/50 p-6 sm:p-8 rounded-xl border border-slate-600">
        <h3 className="text-2xl font-bold mb-4 text-orange-400">エセ芸術家の逆転チャレンジ</h3>
        
        {/* エセ芸術家の画面 */}
        {isFakeArtist && !hasGuessed && (
          <div className="flex flex-col items-center">
            <p className="text-lg mb-6">あなたはエセ芸術家だと見破られました！<br/>しかし、本当のお題を当てれば逆転勝利です！</p>
            <form onSubmit={handleGuessSubmit} className="flex flex-col gap-4 w-full max-w-md">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="本当のお題は何？"
                className="px-4 py-3 rounded bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 text-center text-xl"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors"
              >
                回答を送信する
              </button>
            </form>
          </div>
        )}

        {isFakeArtist && hasGuessed && (
          <div>
            <p className="text-xl font-bold mb-2">あなたの回答: 「{gameState.fakeArtistGuess}」</p>
            <p className="text-slate-400 animate-pulse mt-4">判定結果を待っています...</p>
          </div>
        )}

        {/* 判定者の画面 */}
        {isJudge && !hasGuessed && (
          <div>
            <p className="text-lg mb-2">あなたは判定者に選ばれました！</p>
            <p className="text-slate-400 animate-pulse">エセ芸術家が回答を考えています...</p>
          </div>
        )}

        {isJudge && hasGuessed && (
          <div className="flex flex-col items-center">
            <p className="text-lg mb-4 text-slate-300">エセ芸術家の回答はこちらです：</p>
            <p className="text-3xl font-bold text-white mb-8 border-b-2 border-orange-500 pb-2 inline-block">
              {gameState.fakeArtistGuess}
            </p>
            <p className="text-lg mb-6 text-slate-300">本当のお題（{gameState.theme}）と合っていますか？</p>
            
            <div className="flex gap-4">
              <button
                onClick={() => onJudgeSubmit(true)}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex-1"
              >
                正解！（エセ芸術家の逆転勝利）
              </button>
              <button
                onClick={() => onJudgeSubmit(false)}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors flex-1"
              >
                不正解（芸術家チームの勝利）
              </button>
            </div>
          </div>
        )}

        {/* その他のプレイヤーの画面 */}
        {!isFakeArtist && !isJudge && (
          <div>
            {!hasGuessed ? (
              <p className="text-slate-400 animate-pulse">エセ芸術家が回答を考えています...</p>
            ) : (
              <div className="flex flex-col items-center">
                <p className="text-lg mb-4 text-slate-300">エセ芸術家の回答はこちらです：</p>
                <p className="text-3xl font-bold text-white mb-8 border-b-2 border-orange-500 pb-2 inline-block">
                  {gameState.fakeArtistGuess}
                </p>
                <p className="text-slate-400 animate-pulse">判定者がエセ芸術家の回答を判定しています...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 完成した絵の表示 */}
      <div className="mt-8 flex flex-col items-center w-full">
        <h4 className="text-xl font-bold mb-4 text-slate-300">完成した絵</h4>
        <Canvas 
          roomId={roomId}
          players={players}
          currentTurnPlayerId={null}
          myUserId={myUserId}
          isReadOnly={true}
        />
      </div>
    </div>
  );
}
