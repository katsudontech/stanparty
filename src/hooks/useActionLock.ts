'use client';

import { useCallback, useRef, useState } from 'react';

/** Acquire synchronously, before React renders disabled controls. Release in finally. */
export function useActionLock() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const acquire = useCallback(() => {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    return true;
  }, []);
  const release = useCallback(() => {
    locked.current = false;
    setPending(false);
  }, []);
  return { pending, acquire, release };
}
