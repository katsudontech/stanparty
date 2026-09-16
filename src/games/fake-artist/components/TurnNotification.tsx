'use client';

import { useEffect, useRef, useState } from 'react';

// DrawingPhase keys this component by lap/player/revision, only on our turn.
// Realtime rerenders retain the instance; Undo creates a fresh notification.
export function TurnNotification() {
  const [visible, setVisible] = useState(true);
  const didVibrate = useRef(false);

  useEffect(() => {
    if (!didVibrate.current) {
      didVibrate.current = true;
      try {
        navigator.vibrate?.([80, 40, 80]);
      } catch {
        // Browser restrictions must never interrupt the game.
      }
    }
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto max-w-sm rounded-xl border-2 border-indigo-300 bg-indigo-600 px-5 py-3 text-center text-indigo-50 shadow-xl">
      <p className="text-xl font-black">あなたの番です！</p>
      <p className="text-sm font-bold">1本描いてください</p>
    </div>
  );
}
