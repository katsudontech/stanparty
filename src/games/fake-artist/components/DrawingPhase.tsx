'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import { Avatar } from '@/components/shared/Avatar';
import type { FakeArtistGameState } from '../types';
import { Canvas } from './Canvas';
import { TurnNotification } from './TurnNotification';
import { TurnOrder } from './TurnOrder';

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

  const turnKey = `${gameState.currentLap}:${currentTurnPlayerId ?? ''}:${gameState.turnRevision}`;
  const roleLabel = isFakeArtist ? 'エセ芸術家 🎨' : myRole === 'questioner' ? '出題者' : '芸術家 🖌️';

  return (
    <div className="mt-1 flex w-full flex-col gap-2 sm:mt-6 sm:gap-4">
      {isMyTurn && <TurnNotification key={`${roomId}:${myUserId}:${turnKey}`} />}
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-600 bg-slate-700/50 p-2 text-left sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400">ジャンル · ラウンド {gameState.currentLap}/{gameState.ruleSettings.roundLimit}</p>
            <p className="truncate text-sm font-black text-white">{themeGenre || '未設定'}</p>
          </div>
          <button type="button" aria-expanded={isInfoVisible} onClick={() => setIsInfoVisible(!isInfoVisible)}
            className="shrink-0 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 text-xs font-black text-indigo-400">
            {isInfoVisible ? '閉じる ▲' : 'お題・役職 ▼'}
          </button>
        </div>
        <div className="my-2 flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-bold text-slate-400">いまの番</span>
          {turnPlayer && <Avatar avatarUrl={turnPlayer.avatarUrl} name={turnPlayer.name} color={playerStates[turnPlayer.userId]?.color || turnPlayer.color} size="xs" decorative />}
          <span className="min-w-0 truncate text-sm font-black text-white">{turnPlayer?.name || 'だれか'}</span>
          {isMyTurn && <span className="shrink-0 text-xs font-bold text-indigo-400">あなた</span>}
        </div>
        <TurnOrder players={players} gameState={gameState} />
        {isInfoVisible && (
          <div className="mt-2 border-t border-slate-600 pt-2 text-sm">
            <p className="break-words font-black text-emerald-400">お題：{isFakeArtist ? '???' : (theme || '未設定')}</p>
            <p className="mt-1 text-xs font-bold text-slate-300">あなたの役職：{roleLabel}</p>
          </div>
        )}
      </div>
      <Canvas
        roomId={roomId}
        players={players}
        currentTurnPlayerId={currentTurnPlayerId}
        turnKey={turnKey}
        myUserId={myUserId}
      />
      {isMyTurn && canUndo && onUndoStroke && (
        <div className="text-center">
          <button type="button" onClick={() => void handleUndo()} disabled={isUndoing}
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-bold text-rose-400 disabled:opacity-50">
            ↩ {isUndoing ? 'やり直し中...' : '前の人の線をやり直す'}
          </button>
          {undoError && <p className="mt-1 text-xs font-bold text-rose-300" role="alert">{undoError}</p>}
        </div>
      )}
    </div>
  );
}
