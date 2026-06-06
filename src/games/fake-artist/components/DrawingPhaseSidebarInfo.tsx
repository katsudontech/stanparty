'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';

interface DrawingPhaseSidebarInfoProps {
  players: Player[];
  gameState: FakeArtistGameState;
  myUserId: string | null;
}

export function DrawingPhaseSidebarInfo({ players, gameState, myUserId }: DrawingPhaseSidebarInfoProps) {
  const { themeGenre, theme, currentTurnPlayerId, playerStates } = gameState;
  const turnPlayer = players.find(p => p.userId === currentTurnPlayerId);
  const myRole = playerStates[myUserId || '']?.role;
  const isFakeArtist = myRole === 'fake_artist';

  const [isInfoVisible, setIsInfoVisible] = useState(false);

  return (
    <div className="w-full flex flex-col space-y-4 mt-6">
      {/* ターンの情報 */}
      <div className="bg-indigo-900/40 border border-indigo-500/30 p-4 rounded-xl text-center shadow-inner">
        <p className="text-indigo-300 text-xs font-medium mb-1">
          ターン (ラウンド {gameState.currentLap}/{gameState.ruleSettings.roundLimit})
        </p>
        <p className="text-xl font-bold text-white break-words">
          {turnPlayer?.name || 'だれか'}
        </p>
        <p className="text-xs text-indigo-200 mt-1">の番です</p>
      </div>

      {/* 公開情報: ジャンル */}
      <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 shadow-lg">
        <p className="text-slate-400 text-xs font-medium mb-2">公開情報</p>
        <div className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 shadow-inner">
          <span className="text-[10px] text-slate-500 block mb-1">ジャンル</span>
          <span className="text-sm font-bold text-white">{themeGenre || '未設定'}</span>
        </div>

        {/* シークレット情報 */}
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-600 mt-3 shadow-inner">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => setIsInfoVisible(!isInfoVisible)}
          >
             <p className="text-slate-300 font-bold text-xs flex flex-col gap-1">
               <span>シークレット情報</span>
               <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded w-max">自分だけ見てね</span>
             </p>
             <span className="text-indigo-400 text-[10px] font-bold bg-indigo-500/10 px-2 py-1 rounded transition-colors hover:bg-indigo-500/20 whitespace-nowrap">
               {isInfoVisible ? '▲ 隠す' : '▼ 確認'}
             </span>
          </div>
          
          <div className={`transition-all duration-300 overflow-hidden ${isInfoVisible ? 'max-h-60 mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 mb-2">
              <span className="text-[10px] text-slate-500 block mb-1">お題</span>
              <span className={`text-base font-bold ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isFakeArtist ? '???' : (theme || '未設定')}
              </span>
            </div>
            <p className={`text-xs font-bold ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
              あなたの役職:<br/> {isFakeArtist ? 'エセ芸術家 🎨' : '芸術家 🖌️'}
            </p>
            {isFakeArtist ? (
              <p className="text-[9px] text-rose-400/80 mt-1 font-medium animate-pulse leading-tight">
                ※周りにバレないようにそれっぽく描いてください。
              </p>
            ) : (
              <p className="text-[9px] text-emerald-400/80 mt-1 font-medium leading-tight">
                ※エセにお題がバレないよう、かつ仲間には伝わるように描いてください。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
