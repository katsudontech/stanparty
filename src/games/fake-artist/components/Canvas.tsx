'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { ReactSketchCanvas, type ReactSketchCanvasRef, type CanvasPath } from 'react-sketch-canvas';
import type { Player } from '@/games/core/types';
import { Avatar } from '@/components/shared/Avatar';
import { useCanvasSync } from '../hooks/useCanvasSync';

interface CanvasProps {
  roomId: string;
  players: Player[];
  currentTurnPlayerId: string | null;
  turnKey?: string;
  myUserId: string | null;
  onTurnEnd?: () => void;
  isReadOnly?: boolean;
}

const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 800;
const LOGICAL_STROKE_WIDTH = 6;

const scalePath = (path: CanvasPath, scaleX: number, scaleY: number): CanvasPath => {
  return {
    ...path,
    strokeWidth: path.strokeWidth * scaleX,
    paths: path.paths.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }))
  };
};

const scalePaths = (paths: CanvasPath[], scaleX: number, scaleY: number): CanvasPath[] => {
  return paths.map(p => scalePath(p, scaleX, scaleY));
};

export function Canvas({ roomId, players, currentTurnPlayerId, turnKey, myUserId, onTurnEnd, isReadOnly = false }: CanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPathsLengthRef = useRef(0);
  const [submittedTurnKey, setSubmittedTurnKey] = useState<string | null>(null);
  const activeTurnKey = turnKey ?? currentTurnPlayerId;
  const isSubmitting = activeTurnKey !== null && submittedTurnKey === activeTurnKey;
  
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const logicalPathsRef = useRef<CanvasPath[]>([]);

  // コンテナのサイズを監視してCanvasの物理サイズをトラッキングする
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width, height });
          canvasSizeRef.current = { width, height };
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 初回ロード用
  const handleInitialStrokesLoaded = useCallback((strokes: CanvasPath[]) => {
    logicalPathsRef.current = strokes;
    const { width, height } = canvasSizeRef.current;
    if (canvasRef.current && width > 0) {
      const scaleX = width / LOGICAL_WIDTH;
      const scaleY = height / LOGICAL_HEIGHT;
      const localStrokes = scalePaths(strokes, scaleX, scaleY);
      
      canvasRef.current.clearCanvas();
      canvasRef.current.loadPaths(localStrokes);
      lastPathsLengthRef.current = localStrokes.length;
    }
  }, []);

  // リアルタイム受信時
  const handleNewStrokeReceived = useCallback((stroke: CanvasPath) => {
    logicalPathsRef.current.push(stroke);
    const { width, height } = canvasSizeRef.current;
    
    if (canvasRef.current && width > 0) {
      const scaleX = width / LOGICAL_WIDTH;
      const scaleY = height / LOGICAL_HEIGHT;
      const localStroke = scalePath(stroke, scaleX, scaleY);
      
      canvasRef.current.exportPaths().then(currentPaths => {
        canvasRef.current?.loadPaths([...currentPaths, localStroke]);
        lastPathsLengthRef.current = currentPaths.length + 1;
      }).catch(err => {
        console.error('パスの結合に失敗しました:', err);
      });
    }
  }, []);

  const handleStrokeDeleted = useCallback(() => {
    logicalPathsRef.current.pop();
    if (canvasRef.current) {
      canvasRef.current.undo();
      lastPathsLengthRef.current = Math.max(0, lastPathsLengthRef.current - 1);
    }
  }, []);

  const { insertStroke } = useCanvasSync({
    roomId,
    myUserId,
    onInitialStrokesLoaded: handleInitialStrokesLoaded,
    onNewStrokeReceived: handleNewStrokeReceived,
    onStrokeDeleted: handleStrokeDeleted,
  });

  // リサイズ時に既存のパスを再スケールして描画し直す
  useEffect(() => {
    if (canvasSize.width > 0 && canvasRef.current && logicalPathsRef.current.length > 0) {
      const scaleX = canvasSize.width / LOGICAL_WIDTH;
      const scaleY = canvasSize.height / LOGICAL_HEIGHT;
      const localStrokes = scalePaths(logicalPathsRef.current, scaleX, scaleY);
      
      canvasRef.current.clearCanvas();
      canvasRef.current.loadPaths(localStrokes);
      lastPathsLengthRef.current = localStrokes.length;
    }
  }, [canvasSize.width, canvasSize.height]);

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
        setSubmittedTurnKey(activeTurnKey);
        lastPathsLengthRef.current = allPaths.length;

        if (allPaths.length > 0) {
          const latestLocalStroke = allPaths[allPaths.length - 1];
          const { width, height } = canvasSizeRef.current;
          
          if (width > 0 && height > 0) {
            // 物理座標系から論理座標系へ逆スケール
            const scaleX = LOGICAL_WIDTH / width;
            const scaleY = LOGICAL_HEIGHT / height;
            
            const logicalStroke = scalePath(latestLocalStroke, scaleX, scaleY);
            
            // 自分の論理パス履歴にも追加して、DBへ保存
            logicalPathsRef.current.push(logicalStroke);
            insertStroke(myUserId, logicalStroke);
          }
        }
      } catch (err) {
        console.error('ストロークの保存に失敗しました:', err);
      }
    }

    if (onTurnEnd) {
      onTurnEnd();
    }
  };

  // デバイスの画面幅に合わせて線の太さも自動スケーリングする
  const currentStrokeWidth = canvasSize.width > 0 
    ? LOGICAL_STROKE_WIDTH * (canvasSize.width / LOGICAL_WIDTH) 
    : LOGICAL_STROKE_WIDTH;

  return (
    <div className="w-full flex flex-col items-center">
      <div className={`w-full aspect-[3/4] bg-white rounded-xl shadow-inner relative overflow-hidden border-2 transition-colors duration-300 ${isMyTurn ? 'border-indigo-400 ring-4 ring-indigo-400/20' : 'border-slate-300'}`}>

        {/* 自分のターンでない時や送信中は pointer-events-none で操作を無効化 */}
        {/* touch-none はブラウザがスクロールと勘違いして線を切断するバグを防止します */}
        <div
          ref={containerRef}
          className={`w-full h-full touch-none ${isMyTurn && !isSubmitting ? '' : 'pointer-events-none'}`}
          onPointerUp={() => setTimeout(handleStroke, 100)}
        >
          {canvasSize.width > 0 && (
            <ReactSketchCanvas
              ref={canvasRef}
              strokeWidth={currentStrokeWidth}
              strokeColor={turnPlayer?.color || "#334155"}
              canvasColor="transparent"
              className="!border-none"
            />
          )}
        </div>

        <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-md text-sm font-bold shadow pointer-events-none transition-colors ${isMyTurn ? 'bg-indigo-500 text-white' : 'bg-slate-100/90 text-slate-600'}`}>
          {isReadOnly ? (
            '🎨 完成した絵'
          ) : isMyTurn ? (
            '✨ あなたのターンです！描いてください'
          ) : (
            <span className="flex items-center gap-2">
              {turnPlayer && (
                <Avatar
                  avatarUrl={turnPlayer.avatarUrl}
                  name={turnPlayer.name}
                  color={turnPlayer.color}
                  size="xs"
                  decorative
                />
              )}
              <span style={{ color: turnPlayer?.color }}>{turnPlayerName}</span>
              <span>のターン</span>
            </span>
          )}
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
