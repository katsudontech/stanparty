'use client';

import { useRef, useCallback } from 'react';
import { ReactSketchCanvas, type ReactSketchCanvasRef, type CanvasPath } from 'react-sketch-canvas';
import type { Player } from '@/games/core/types';
import { useCanvasSync } from '../hooks/useCanvasSync';

interface CanvasProps {
  roomId: string;
  players: Player[];
  currentTurnPlayerId: string | null;
  myUserId: string | null;
  onTurnEnd?: () => void;
}

export function Canvas({ roomId, players, currentTurnPlayerId, myUserId, onTurnEnd }: CanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  // 初回ロード用
  const handleInitialStrokesLoaded = useCallback((strokes: CanvasPath[]) => {
    if (canvasRef.current) {
      canvasRef.current.loadPaths(strokes);
    }
  }, []);

  // リアルタイム受信時
  const handleNewStrokeReceived = useCallback(async (stroke: CanvasPath) => {
    if (!canvasRef.current) return;
    try {
      const currentPaths = await canvasRef.current.exportPaths();
      canvasRef.current.loadPaths([...currentPaths, stroke]);
    } catch (err) {
      console.error('パスの結合に失敗しました:', err);
    }
  }, []);

  const { insertStroke } = useCanvasSync({
    roomId,
    myUserId,
    onInitialStrokesLoaded: handleInitialStrokesLoaded,
    onNewStrokeReceived: handleNewStrokeReceived,
  });

  // ターンプレイヤーの名前を検索
  const turnPlayer = players.find(p => p.userId === currentTurnPlayerId);
  const turnPlayerName = turnPlayer?.name || (players.length > 0 ? players[0]?.name : 'だれか');
  
  // 自分のターンかどうかを判定
  const isMyTurn = myUserId !== null && myUserId === currentTurnPlayerId;

  const handleStroke = async () => {
    // 自分のターンじゃない時の発火は絶対に無視する
    if (!isMyTurn) return;

    if (myUserId && canvasRef.current) {
      try {
        const allPaths = await canvasRef.current.exportPaths();
        if (allPaths.length > 0) {
          const latestStroke = allPaths[allPaths.length - 1];
          insertStroke(myUserId, latestStroke);
        }
      } catch (err) {
        console.error('ストロークの保存に失敗しました:', err);
      }
    }
    
    if (onTurnEnd) {
      onTurnEnd();
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div className={`w-full aspect-[4/3] bg-white rounded-xl shadow-inner relative overflow-hidden border-2 transition-colors duration-300 ${isMyTurn ? 'border-indigo-400 ring-4 ring-indigo-400/20' : 'border-slate-300'}`}>
        
        {/* 自分のターンでない時は pointer-events-none で操作を無効化 */}
        {/* touch-none はブラウザがスクロールと勘違いして線を切断するバグを防止します */}
        <div className={`w-full h-full touch-none ${isMyTurn ? '' : 'pointer-events-none'}`}>
          <ReactSketchCanvas
            ref={canvasRef}
            strokeWidth={5}
            strokeColor="#334155"
            canvasColor="transparent"
            className="!border-none"
            onStroke={handleStroke}
          />
        </div>

        <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-md text-sm font-bold shadow pointer-events-none transition-colors ${isMyTurn ? 'bg-indigo-500 text-white' : 'bg-slate-100/90 text-slate-600'}`}>
          {isMyTurn ? '✨ あなたのターンです！描いてください' : `${turnPlayerName} のターン`}
        </div>

        {/* 自分のターンではない場合のオーバーレイ表示（任意で少し暗くするなど） */}
        {!isMyTurn && (
          <div className="absolute inset-0 bg-slate-500/5 pointer-events-none flex items-center justify-center">
          </div>
        )}
      </div>
    </div>
  );
}
