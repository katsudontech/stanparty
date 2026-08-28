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

export function Canvas({ roomId, players, currentTurnPlayerId, turnKey, myUserId, isReadOnly = false }: CanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPathsLengthRef = useRef(0);
  const [submittedTurnKey, setSubmittedTurnKey] = useState<string | null>(null);
  const [pendingTurnKey, setPendingTurnKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requiresDrawConfirmation, setRequiresDrawConfirmation] = useState(true);
  const [armedTurnKey, setArmedTurnKey] = useState<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const activeTurnKey = turnKey ?? currentTurnPlayerId;
  const isSubmitting = activeTurnKey !== null
    && (submittedTurnKey === activeTurnKey || pendingTurnKey === activeTurnKey);
  
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const logicalPathsRef = useRef<CanvasPath[]>([]);

  // タッチ端末では、スクロールを描画と誤認しないよう一筆ごとに明示的に有効化する。
  useEffect(() => {
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const updatePointerMode = () => setRequiresDrawConfirmation(pointerQuery.matches);

    updatePointerMode();
    pointerQuery.addEventListener('change', updatePointerMode);
    return () => pointerQuery.removeEventListener('change', updatePointerMode);
  }, []);

  const redrawLogicalPaths = useCallback(() => {
    const { width, height } = canvasSizeRef.current;
    if (!canvasRef.current || width <= 0 || height <= 0) return;

    const scaleX = width / LOGICAL_WIDTH;
    const scaleY = height / LOGICAL_HEIGHT;
    const localStrokes = scalePaths(logicalPathsRef.current, scaleX, scaleY);
    canvasRef.current.clearCanvas();
    canvasRef.current.loadPaths(localStrokes);
    lastPathsLengthRef.current = localStrokes.length;
  }, []);

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
    logicalPathsRef.current = [...strokes];
    redrawLogicalPaths();
  }, [redrawLogicalPaths]);

  // リアルタイム受信時
  const handleNewStrokeReceived = useCallback((stroke: CanvasPath) => {
    logicalPathsRef.current.push(stroke);
    const { width, height } = canvasSizeRef.current;
    
    if (canvasRef.current && width > 0) {
      const scaleX = width / LOGICAL_WIDTH;
      const scaleY = height / LOGICAL_HEIGHT;
      const localStroke = scalePath(stroke, scaleX, scaleY);
      
      // react-sketch-canvas の loadPaths は既存パスへ追記するAPI。
      // 新しい1本だけを渡し、既存パスの指数的な重複を防ぐ。
      canvasRef.current.loadPaths([localStroke]);
      lastPathsLengthRef.current += 1;
    }
  }, []);

  const handleStrokeDeleted = useCallback(() => {
    logicalPathsRef.current.pop();
    redrawLogicalPaths();
  }, [redrawLogicalPaths]);

  const { insertStroke, isSyncReady, syncError } = useCanvasSync({
    roomId,
    myUserId,
    onInitialStrokesLoaded: handleInitialStrokesLoaded,
    onNewStrokeReceived: handleNewStrokeReceived,
    onStrokeDeleted: handleStrokeDeleted,
  });

  // リサイズ時に既存のパスを再スケールして描画し直す
  useEffect(() => {
    if (canvasSize.width > 0) redrawLogicalPaths();
  }, [canvasSize.width, canvasSize.height, redrawLogicalPaths]);

  // ターンプレイヤーの名前を検索
  const turnPlayer = players.find(p => p.userId === currentTurnPlayerId);
  const turnPlayerName = turnPlayer?.name || (players.length > 0 ? players[0]?.name : 'だれか');

  // 自分のターンかどうかを判定
  const isMyTurn = !isReadOnly && myUserId !== null && myUserId === currentTurnPlayerId;
  const canDraw = isMyTurn && isSyncReady && !isSubmitting && !syncError;
  const isDrawArmed = activeTurnKey !== null && armedTurnKey === activeTurnKey;
  const isDrawInputEnabled = canDraw && (!requiresDrawConfirmation || isDrawArmed);

  const handleStroke = async () => {
    // 自分のターンじゃない時、または既に送信処理中の発火は無視する
    if (!canDraw || submissionInFlightRef.current) return;

    if (myUserId && canvasRef.current) {
      try {
        const allPaths = await canvasRef.current.exportPaths();
        // パスが増えていない場合はスキップ（単なるクリックなど）
        if (allPaths.length <= lastPathsLengthRef.current) return;

        // パスが増えていれば送信中フラグを立てる（次の描画をブロック）
        submissionInFlightRef.current = true;
        setPendingTurnKey(activeTurnKey);
        setActionError(null);
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
            try {
              await insertStroke(logicalStroke);
              setSubmittedTurnKey(activeTurnKey);
            } catch (error) {
              logicalPathsRef.current.pop();
              redrawLogicalPaths();
              setActionError(error instanceof Error ? error.message : '線を保存できませんでした');
            }
          }
        }
      } catch (err) {
        console.error('ストロークの保存に失敗しました:', err);
        setActionError(err instanceof Error ? err.message : '線を保存できませんでした');
      } finally {
        submissionInFlightRef.current = false;
        setPendingTurnKey(null);
      }
    }
  };

  // デバイスの画面幅に合わせて線の太さも自動スケーリングする
  const currentStrokeWidth = canvasSize.width > 0 
    ? LOGICAL_STROKE_WIDTH * (canvasSize.width / LOGICAL_WIDTH) 
    : LOGICAL_STROKE_WIDTH;

  const handlePointerUp = () => {
    if (!isDrawInputEnabled) return;

    if (requiresDrawConfirmation) setArmedTurnKey(null);
    window.setTimeout(() => void handleStroke(), 100);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {(syncError || actionError) && (
        <p className="mb-3 w-full rounded-lg border border-rose-500 bg-rose-950/70 px-4 py-3 text-sm font-bold text-rose-200" role="alert">
          {actionError || syncError}
        </p>
      )}
      <div className={`fake-artist-canvas-frame aspect-[3/4] bg-white rounded-xl shadow-inner relative overflow-hidden border-2 transition-colors duration-300 ${isMyTurn ? 'border-indigo-400 ring-4 ring-indigo-400/20' : 'border-slate-300'}`}>

        <div
          ref={containerRef}
          className="w-full h-full"
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setArmedTurnKey(null)}
        >
          {canvasSize.width > 0 && (
            <ReactSketchCanvas
              ref={canvasRef}
              strokeWidth={currentStrokeWidth}
              strokeColor={turnPlayer?.color || "#334155"}
              canvasColor="transparent"
              className="!border-none"
              style={{
                pointerEvents: isDrawInputEnabled ? 'auto' : 'none',
                touchAction: isDrawInputEnabled ? 'none' : 'pan-y',
              }}
            />
          )}
        </div>

        {canDraw && requiresDrawConfirmation && !isDrawArmed && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
            <button
              type="button"
              className="pointer-events-auto rounded-xl border-2 border-indigo-700 bg-indigo-600 px-5 py-3 text-white shadow-lg transition-colors active:bg-indigo-700"
              onClick={() => setArmedTurnKey(activeTurnKey)}
            >
              <span className="block text-base font-black">一筆を描く</span>
              <span className="mt-1 block text-[11px] font-bold text-indigo-100">押すまでは絵の上もスクロールできます</span>
            </button>
          </div>
        )}

        <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-md text-sm font-bold shadow pointer-events-none transition-colors ${isMyTurn ? 'bg-indigo-500 text-white' : 'bg-slate-100/90 text-slate-600'}`}>
          {isReadOnly ? (
            '🎨 完成した絵'
          ) : isMyTurn && !isSyncReady ? (
            '描画履歴を同期中です...'
          ) : isMyTurn && requiresDrawConfirmation && isDrawArmed ? (
            '指を離すまでが一筆です'
          ) : isMyTurn ? (
            '✨ あなたのターンです！'
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

      </div>
    </div>
  );
}
