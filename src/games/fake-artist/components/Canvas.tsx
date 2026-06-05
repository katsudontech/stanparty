'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { ReactSketchCanvas, type ReactSketchCanvasRef, type CanvasPath } from 'react-sketch-canvas';
import type { Player } from '@/games/core/types';
import { useCanvasSync } from '../hooks/useCanvasSync';

interface CanvasProps {
  roomId: string;
  players: Player[];
  currentTurnPlayerId: string | null;
  myUserId: string | null;
  onTurnEnd?: () => void;
  isReadOnly?: boolean;
}

export function Canvas({ roomId, players, currentTurnPlayerId, myUserId, onTurnEnd, isReadOnly = false }: CanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const lastPathsLengthRef = useRef(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ターンが自分に回ってきたら送信状態をリセットする
  useEffect(() => {
    if (myUserId !== null && myUserId === currentTurnPlayerId) {
      setIsSubmitting(false);
    }
  }, [currentTurnPlayerId, myUserId]);

  // 初回ロード用
  const handleInitialStrokesLoaded = useCallback((strokes: CanvasPath[]) => {
    if (canvasRef.current) {
      canvasRef.current.loadPaths(strokes);
      lastPathsLengthRef.current = strokes.length;
    }
  }, []);

  // リアルタイム受信時
  const handleNewStrokeReceived = useCallback(async (stroke: CanvasPath) => {
    if (!canvasRef.current) return;
    try {
      const currentPaths = await canvasRef.current.exportPaths();
      canvasRef.current.loadPaths([...currentPaths, stroke]);
      lastPathsLengthRef.current = currentPaths.length + 1;
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
  const isMyTurn = !isReadOnly && myUserId !== null && myUserId === currentTurnPlayerId;

  const handleStroke = async () => {
    // 自分のターンじゃない時、または既に送信処理中の発火は無視する
    if (!isMyTurn || isSubmitting) return;

    if (myUserId && canvasRef.current) {
      try {
        const allPaths = await canvasRef.current.exportPaths();
        // パスが増えていない場合はスキップ（単なるクリックなど）
        if (allPaths.length <= lastPathsLengthRef.current) return;

        // パスが増えていれば送信中フラグを立てる（次の描画をブロック）
        setIsSubmitting(true);
        lastPathsLengthRef.current = allPaths.length;

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

        {/* 自分のターンでない時や送信中は pointer-events-none で操作を無効化 */}
        {/* touch-none はブラウザがスクロールと勘違いして線を切断するバグを防止します */}
        <div
          className={`w-full h-full touch-none ${isMyTurn && !isSubmitting ? '' : 'pointer-events-none'}`}
          onPointerUp={() => setTimeout(handleStroke, 100)}
        >
          <ReactSketchCanvas
            ref={canvasRef}
            strokeWidth={5}
            strokeColor={turnPlayer?.color || "#334155"}
            canvasColor="transparent"
            className="!border-none"
          />
        </div>

        <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-md text-sm font-bold shadow pointer-events-none transition-colors ${isMyTurn ? 'bg-indigo-500 text-white' : 'bg-slate-100/90 text-slate-600'}`}>
          {isReadOnly ? '🎨 完成した絵' : (isMyTurn ? '✨ あなたのターンです！描いてください' : `${turnPlayerName} のターン`)}
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
