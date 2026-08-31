'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactSketchCanvas,
  type CanvasPath,
  type ReactSketchCanvasRef,
} from 'react-sketch-canvas';

import type { Player } from '@/games/core/types';

import { useDrawingCanvasSync } from '../hooks/useDrawingCanvasSync';

interface Props {
  roomId: string;
  players: Player[];
  drawerId: string | null;
  myUserId: string;
  canDraw: boolean;
  onJudge?: (snapshot: string) => Promise<void>;
}

const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 800;
const LOGICAL_STROKE_WIDTH = 6;

function scalePath(path: CanvasPath, scaleX: number, scaleY: number): CanvasPath {
  return {
    ...path,
    strokeWidth: path.strokeWidth * scaleX,
    paths: path.paths.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    })),
  };
}

export function Canvas({ roomId, players, drawerId, myUserId, canDraw, onJudge }: Props) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const logicalPathsRef = useRef<CanvasPath[]>([]);
  const actionInFlightRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pathCount, setPathCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const redrawLogicalPaths = useCallback(() => {
    const { width, height } = canvasSizeRef.current;
    if (!canvasRef.current || width <= 0 || height <= 0) return;

    canvasRef.current.clearCanvas();
    if (logicalPathsRef.current.length > 0) {
      canvasRef.current.loadPaths(
        logicalPathsRef.current.map((path) => (
          scalePath(path, width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT)
        )),
      );
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const size = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      canvasSizeRef.current = size;
      setCanvasSize(size);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) redrawLogicalPaths();
  }, [canvasSize, redrawLogicalPaths]);

  const handleInitialPaths = useCallback((paths: CanvasPath[]) => {
    logicalPathsRef.current = [...paths];
    setPathCount(paths.length);
    redrawLogicalPaths();
  }, [redrawLogicalPaths]);

  const handleRemoteStroke = useCallback((stroke: CanvasPath) => {
    const { width, height } = canvasSizeRef.current;
    logicalPathsRef.current.push(stroke);
    setPathCount(logicalPathsRef.current.length);

    if (canvasRef.current && width > 0 && height > 0) {
      canvasRef.current.loadPaths([
        scalePath(stroke, width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT),
      ]);
    }
  }, []);

  const handleReset = useCallback(() => {
    logicalPathsRef.current = [];
    setPathCount(0);
    canvasRef.current?.clearCanvas();
  }, []);

  const sync = useDrawingCanvasSync(
    roomId,
    myUserId,
    handleInitialPaths,
    handleRemoteStroke,
    handleReset,
  );

  const drawer = players.find((player) => player.userId === drawerId);
  const syncAllowsActions = sync.ready && !sync.error;
  const drawingEnabled = canDraw && syncAllowsActions && !busy;

  const submitPendingStrokes = useCallback(async () => {
    if (!drawingEnabled || actionInFlightRef.current || !canvasRef.current) return;

    actionInFlightRef.current = true;
    setBusy(true);
    setActionError(null);

    try {
      const physicalPaths = await canvasRef.current.exportPaths();
      const persistedCount = logicalPathsRef.current.length;
      const pendingPaths = physicalPaths.slice(persistedCount);
      const { width, height } = canvasSizeRef.current;

      if (pendingPaths.length === 0 || width <= 0 || height <= 0) return;

      for (const physicalPath of pendingPaths) {
        const logicalPath = scalePath(
          physicalPath,
          LOGICAL_WIDTH / width,
          LOGICAL_HEIGHT / height,
        );
        await sync.submitStroke(logicalPath);
        logicalPathsRef.current.push(logicalPath);
        setPathCount(logicalPathsRef.current.length);
      }
    } catch (error) {
      redrawLogicalPaths();
      setActionError(error instanceof Error ? error.message : '線を保存できませんでした');
    } finally {
      actionInFlightRef.current = false;
      setBusy(false);
    }
  }, [drawingEnabled, redrawLogicalPaths, sync]);

  useEffect(() => {
    const finishStroke = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;

      activePointerIdRef.current = null;

      // react-sketch-canvas commits the completed path during its pointerup
      // handler. Read it on the next task so the whole stroke, rather than its
      // initial point, is persisted and broadcast.
      window.setTimeout(() => void submitPendingStrokes(), 0);
    };

    document.addEventListener('pointerup', finishStroke);
    document.addEventListener('pointercancel', finishStroke);
    return () => {
      document.removeEventListener('pointerup', finishStroke);
      document.removeEventListener('pointercancel', finishStroke);
    };
  }, [submitPendingStrokes]);

  const resetCanvas = async () => {
    if (
      !drawingEnabled
      || actionInFlightRef.current
      || !window.confirm('いまの絵をすべて消しますか？')
    ) return;

    actionInFlightRef.current = true;
    setBusy(true);
    setActionError(null);

    try {
      await sync.reset();
      handleReset();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '絵をリセットできませんでした');
    } finally {
      actionInFlightRef.current = false;
      setBusy(false);
    }
  };

  const judgeCanvas = async () => {
    if (
      !drawingEnabled
      || actionInFlightRef.current
      || !onJudge
      || !canvasRef.current
    ) return;

    actionInFlightRef.current = true;
    setBusy(true);
    setActionError(null);

    try {
      await onJudge(await canvasRef.current.exportImage('png'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '判定を開始できませんでした');
    } finally {
      actionInFlightRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {(sync.error || actionError) && (
        <p role="alert" className="mb-2 rounded border border-rose-500 bg-rose-950 p-3 text-sm font-bold text-rose-200">
          {actionError || sync.error}
        </p>
      )}

      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-slate-300 bg-white">
        <div
          ref={containerRef}
          className="h-full w-full"
          onPointerDown={(event) => {
            if (
              drawingEnabled
              && activePointerIdRef.current === null
              && (event.pointerType !== 'mouse' || event.button === 0)
            ) {
              activePointerIdRef.current = event.pointerId;
            }
          }}
        >
          {canvasSize.width > 0 && (
            <ReactSketchCanvas
              ref={canvasRef}
              strokeWidth={LOGICAL_STROKE_WIDTH * canvasSize.width / LOGICAL_WIDTH}
              strokeColor={drawer?.color || '#334155'}
              canvasColor="white"
              style={{
                pointerEvents: drawingEnabled ? 'auto' : 'none',
                touchAction: drawingEnabled ? 'none' : 'pan-y',
              }}
            />
          )}
        </div>

        {!sync.ready && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 p-5 text-sm font-bold text-slate-500">
            描画履歴を同期中です…
          </p>
        )}
      </div>

      {canDraw && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="button-secondary"
            disabled={busy || !syncAllowsActions}
            onClick={() => void resetCanvas()}
          >
            絵をリセット
          </button>
          {onJudge && (
            <button
              type="button"
              className="button-primary"
              disabled={busy || !syncAllowsActions || pathCount === 0}
              onClick={() => void judgeCanvas()}
            >
              この絵で判定する
            </button>
          )}
          <span className="self-center text-xs font-bold text-[var(--muted)]">
            リセットは現在の絵だけを消します
          </span>
        </div>
      )}

      {drawer && (
        <p className="mt-2 text-sm font-bold text-[var(--muted)]">
          描く人：{drawer.name}{drawerId === myUserId ? '（あなた）' : ''}
        </p>
      )}
    </div>
  );
}
