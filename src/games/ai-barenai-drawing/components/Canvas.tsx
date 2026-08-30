'use client';
import { useCallback, useRef, useState } from 'react';
import { useEffect } from 'react';
import { ReactSketchCanvas, type CanvasPath, type ReactSketchCanvasRef } from 'react-sketch-canvas';
import type { Player } from '@/games/core/types';
import { useDrawingCanvasSync } from '../hooks/useDrawingCanvasSync';

interface Props { roomId: string; players: Player[]; drawerId: string|null; myUserId: string; canDraw: boolean; onJudge?: (snapshot: string) => Promise<void>; }
export function Canvas({roomId, players, drawerId, myUserId, canDraw, onJudge}: Props) {
  const ref = useRef<ReactSketchCanvasRef>(null);
  const paths = useRef<CanvasPath[]>([]);
  const [actionError, setActionError] = useState<string|null>(null);
  const [pathCount, setPathCount] = useState(0);
  const [requiresDrawConfirmation, setRequiresDrawConfirmation] = useState(false);
  const [drawArmed, setDrawArmed] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const busyRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const logicalPaths = useRef<CanvasPath[]>([]);
  const scale = useCallback((path: CanvasPath, x: number, y: number): CanvasPath => ({ ...path, strokeWidth: path.strokeWidth * x, paths: path.paths.map((point) => ({ x: point.x * x, y: point.y * y })) }), []);
  const redraw = useCallback(() => {
    const size = canvasSizeRef.current;
    ref.current?.clearCanvas();
    if (logicalPaths.current.length && size.width > 0) ref.current?.loadPaths(logicalPaths.current.map((path) => scale(path, size.width / 600, size.height / 800)));
  }, [scale]);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = { width: entry.contentRect.width, height: entry.contentRect.height };
      canvasSizeRef.current = size;
      setCanvasSize(size);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setRequiresDrawConfirmation(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (canvasSize.width > 0) redraw();
  }, [canvasSize, redraw]);
  const onInitial = useCallback((next: CanvasPath[]) => { logicalPaths.current = [...next]; paths.current = [...next]; setPathCount(next.length); redraw(); }, [redraw]);
  const onStroke = useCallback((stroke: CanvasPath) => {
    const size = canvasSizeRef.current;
    logicalPaths.current.push(stroke); paths.current.push(stroke); setPathCount(paths.current.length);
    if (size.width > 0) ref.current?.loadPaths([scale(stroke, size.width / 600, size.height / 800)]);
  }, [scale]);
  const onReset = useCallback(() => { paths.current = []; logicalPaths.current = []; setPathCount(0); ref.current?.clearCanvas(); }, []);
  const sync = useDrawingCanvasSync(roomId, myUserId, onInitial, onStroke, onReset);
  const [busy, setBusy] = useState(false);
  const drawer = players.find((p) => p.userId === drawerId);
  const syncAllowsActions = sync.ready && !sync.error;
  const drawEnabled = canDraw && syncAllowsActions && !busy && (!requiresDrawConfirmation || drawArmed);
  const submit = async () => {
    if (!canDraw || !syncAllowsActions || busy || busyRef.current || !ref.current) return;
    busyRef.current = true;
    setBusy(true); setActionError(null);
    try {
      const current = await ref.current.exportPaths();
      if (current.length <= paths.current.length) return;
      const stroke = current[current.length - 1];
      const size = canvasSizeRef.current;
      const logicalStroke = size.width > 0 ? scale(stroke, 600 / size.width, 800 / size.height) : stroke;
      paths.current.push(logicalStroke); logicalPaths.current.push(logicalStroke); setPathCount(paths.current.length);
      await sync.submitStroke(logicalStroke);
    } catch (e) { paths.current.pop(); logicalPaths.current.pop(); redraw(); setActionError(e instanceof Error ? e.message : '線を保存できませんでした'); }
    finally { busyRef.current = false; setBusy(false); if (requiresDrawConfirmation) setDrawArmed(false); }
  };
  const reset = async () => {
    if (!canDraw || !syncAllowsActions || busy || busyRef.current || !window.confirm('いまの絵をすべて消しますか？')) return;
    busyRef.current = true; setBusy(true); setActionError(null);
    try { await sync.reset(); paths.current = []; logicalPaths.current = []; setPathCount(0); ref.current?.clearCanvas(); } catch (e) { setActionError(e instanceof Error ? e.message : '絵をリセットできませんでした'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const judge = async () => {
    if (!canDraw || !syncAllowsActions || busy || busyRef.current || !onJudge || !ref.current) return;
    busyRef.current = true; setBusy(true); setActionError(null);
    try { await onJudge(await ref.current.exportImage('png')); }
    catch (e) { setActionError(e instanceof Error ? e.message : '判定を開始できませんでした'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <div className="w-full">
    {(sync.error || actionError) && <p role="alert" className="mb-2 rounded border border-rose-500 bg-rose-950 p-3 text-sm font-bold text-rose-200">{actionError || sync.error}</p>}
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-slate-300 bg-white">
      <div ref={containerRef} className="h-full w-full">
        {canvasSize.width > 0 && <ReactSketchCanvas ref={ref} strokeWidth={6 * canvasSize.width / 600} strokeColor={drawer?.color || '#334155'} canvasColor="white" style={{pointerEvents: drawEnabled ? 'auto':'none', touchAction: drawEnabled ? 'none':'pan-y'}} onStroke={submit} />}
        {canDraw && syncAllowsActions && requiresDrawConfirmation && !drawArmed && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5"><button type="button" className="pointer-events-auto rounded-xl border-2 border-indigo-700 bg-indigo-600 px-5 py-3 font-black text-white shadow-lg" onClick={() => setDrawArmed(true)}>一筆を描く</button></div>}
      </div>
      {!sync.ready && <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 p-5 text-sm font-bold text-slate-500">描画履歴を同期中です…</p>}
    </div>
    {canDraw && <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button-secondary" disabled={busy || !syncAllowsActions} onClick={() => void reset()}>絵をリセット</button>{onJudge && <button type="button" className="button-primary" disabled={busy || !syncAllowsActions || pathCount === 0} onClick={() => void judge()}>この絵で判定する</button>}<span className="self-center text-xs font-bold text-[var(--muted)]">リセットは現在の絵だけを消します</span></div>}
    {drawer && <p className="mt-2 text-sm font-bold text-[var(--muted)]">描く人：{drawer.name}{drawerId === myUserId ? '（あなた）' : ''}</p>}
  </div>;
}
