'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import { Avatar } from '@/components/shared/Avatar';
import type { FakeArtistGameState } from '../types';
import { Canvas } from './Canvas';

interface DrawingPhaseProps {
  roomId: string;
  players: Player[];
  gameState: FakeArtistGameState;
  myUserId: string | null;
  onUndoStroke?: () => Promise<void>;
}

export function DrawingPhase({ roomId, players, gameState, myUserId, onUndoStroke }: DrawingPhaseProps) {
  const { themeGenre, theme, currentTurnPlayerId, playerStates } = gameState;
  const turnPlayer = players.find(p => p.userId === currentTurnPlayerId);
  const myRole = playerStates[myUserId || '']?.role;
  const isFakeArtist = myRole === 'fake_artist';

  const isMyTurn = myUserId !== null && myUserId === currentTurnPlayerId;
  const canUndo = gameState.currentLap > 1 || gameState.turnOrder.indexOf(currentTurnPlayerId || '') > 0;

  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  const handleUndo = async () => {
    if (!onUndoStroke || isUndoing) return;

    setIsUndoing(true);
    setUndoError(null);
    try {
      await onUndoStroke();
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : '線をやり直せませんでした');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="mt-2 flex w-full flex-col space-y-3 sm:mt-8 sm:space-y-6">
      <div className="w-full rounded-xl border border-slate-600 bg-slate-700/50 p-3 text-left shadow-lg sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">ジャンル · ラウンド {gameState.currentLap}/{gameState.ruleSettings.roundLimit}</p>
            <p className="truncate text-base font-black text-white">{themeGenre || '未設定'}</p>
          </div>
          <button
            type="button"
            aria-expanded={isInfoVisible}
            onClick={() => setIsInfoVisible(!isInfoVisible)}
            className="shrink-0 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-400"
          >
            {isInfoVisible ? '閉じる ▲' : 'お題・役職 ▼'}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-slate-600 pt-2">
          <span className="shrink-0 text-[11px] font-bold text-slate-500">いまの番</span>
          {turnPlayer ? (
            <>
              <Avatar
                avatarUrl={turnPlayer.avatarUrl}
                name={turnPlayer.name}
                color={turnPlayer.color}
                size="xs"
                decorative
              />
              <span className="min-w-0 truncate text-sm font-black" style={{ color: turnPlayer.color }}>
                {turnPlayer.name}
              </span>
            </>
          ) : (
            <span className="text-sm font-black text-white">だれか</span>
          )}
        </div>

        {isInfoVisible && (
          <div className="mt-3 border-t border-slate-600 pt-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
              <span className="block text-[10px] text-slate-500">お題</span>
              <span className={`text-base font-black ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isFakeArtist ? '???' : (theme || '未設定')}
              </span>
            </div>
            <p className={`mt-2 text-xs font-black ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
              あなたの役職: {isFakeArtist ? 'エセ芸術家 🎨' : '芸術家 🖌️'}
            </p>
            {isMyTurn && canUndo && (
              <div className="mt-3 border-t border-slate-700/50 pt-3">
                <button
                  type="button"
                  onClick={() => void handleUndo()}
                  disabled={isUndoing}
                  className="w-full rounded-md bg-rose-500/90 px-3 py-2 text-sm font-bold text-white"
                >
                  ↩ {isUndoing ? 'やり直し中...' : '前の人の線をやり直す'}
                </button>
                {undoError && <p className="mt-2 text-xs font-bold text-rose-300" role="alert">{undoError}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto hidden w-full max-w-2xl flex-col items-start justify-between gap-6 rounded-xl border border-slate-600 bg-slate-700/50 p-6 shadow-lg sm:flex sm:flex-row sm:items-center">
        
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

              {isMyTurn && canUndo && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => void handleUndo()}
                    disabled={isUndoing}
                    className="w-full bg-rose-500/90 text-white px-3 py-2 rounded-md text-sm font-bold shadow hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>↩</span> {isUndoing ? 'やり直し中...' : '前の人の線をやり直す'}
                  </button>
                  {undoError && <p className="mt-2 text-xs font-bold text-rose-300" role="alert">{undoError}</p>}
                  <p className="text-[10px] text-slate-500 mt-1 text-center">
                    ※間違えて描いてしまった場合などに使ってください
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-indigo-900/40 border border-indigo-500/30 px-6 py-4 rounded-xl text-center shadow-inner min-w-0 w-full sm:min-w-[200px] sm:w-auto self-start sm:self-stretch flex flex-col justify-center">
          <p className="text-indigo-300 text-sm font-medium mb-1">
            現在のターン (ラウンド {gameState.currentLap}/{gameState.ruleSettings.roundLimit})
          </p>
          {turnPlayer ? (
            <div className="flex items-center justify-center gap-3">
              <Avatar
                avatarUrl={turnPlayer.avatarUrl}
                name={turnPlayer.name}
                color={turnPlayer.color}
                size="md"
                decorative
              />
              <p className="break-words text-2xl font-black" style={{ color: turnPlayer.color }}>
                {turnPlayer.name}
              </p>
            </div>
          ) : (
            <p className="text-2xl font-bold text-white">だれか</p>
          )}
          <p className="text-sm text-indigo-200 mt-1">の番です</p>
        </div>
      </div>

      <Canvas 
        roomId={roomId}
        players={players} 
        currentTurnPlayerId={currentTurnPlayerId} 
        turnKey={`${gameState.currentLap}:${currentTurnPlayerId ?? ''}:${gameState.turnRevision}`}
        myUserId={myUserId}
      />
    </div>
  );
}
