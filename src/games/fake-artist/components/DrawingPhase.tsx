'use client';

import { useState } from 'react';
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
  const { themeGenre, theme, currentTurnPlayerId, playerStates } = gameState;
  const turnPlayer = players.find(p => p.userId === currentTurnPlayerId);
  const myRole = playerStates[myUserId || '']?.role;
  const isFakeArtist = myRole === 'fake_artist';

  const [isInfoVisible, setIsInfoVisible] = useState(false);

  return (
    <div className="w-full mt-8 flex flex-col space-y-6">
      <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg gap-6">
        
        <div className="text-left w-full sm:flex-1">
          <p className="text-slate-400 text-sm font-medium mb-2">公開情報</p>
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-600 shadow-inner inline-block">
            <span className="text-xs text-slate-500 block mb-1">ジャンル</span>
            <span className="text-lg font-bold text-white">{themeGenre || '未設定'}</span>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-600 mt-4 shadow-inner">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => setIsInfoVisible(!isInfoVisible)}
            >
               <p className="text-slate-300 font-bold text-sm flex items-center gap-2">
                 <span>シークレット情報</span>
                 <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">自分だけ見てね</span>
               </p>
               <span className="text-indigo-400 text-sm font-bold bg-indigo-500/10 px-2 py-1 rounded transition-colors hover:bg-indigo-500/20">
                 {isInfoVisible ? '▲ 隠す' : '▼ 確認する'}
               </span>
            </div>
            
            <div className={`transition-all duration-300 overflow-hidden ${isInfoVisible ? 'max-h-60 mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 mb-3">
                <span className="text-xs text-slate-500 block mb-1">お題</span>
                <span className={`text-lg font-bold ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isFakeArtist ? '???' : (theme || '未設定')}
                </span>
              </div>
              <p className={`text-sm font-bold ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
                あなたの役職: {isFakeArtist ? 'エセ芸術家 🎨' : '芸術家 🖌️'}
              </p>
              {isFakeArtist ? (
                <p className="text-xs text-rose-400/80 mt-1 font-medium animate-pulse">
                  ※周りにバレないようにそれっぽく描いてください。
                </p>
              ) : (
                <p className="text-xs text-emerald-400/80 mt-1 font-medium">
                  ※エセにお題がバレないよう、かつ仲間には伝わるように描いてください。
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-indigo-900/40 border border-indigo-500/30 px-6 py-4 rounded-xl text-center shadow-inner min-w-[200px] w-full sm:w-auto self-start sm:self-stretch flex flex-col justify-center">
          <p className="text-indigo-300 text-sm font-medium mb-1">
            現在のターン (ラウンド {gameState.currentLap}/{gameState.ruleSettings.roundLimit})
          </p>
          <p className="text-2xl font-bold text-white break-words">
            {turnPlayer?.name || 'だれか'}
          </p>
          <p className="text-sm text-indigo-200 mt-1">の番です</p>
        </div>
      </div>

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
