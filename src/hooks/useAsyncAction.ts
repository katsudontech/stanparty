'use client';

import { useState } from 'react';
import { useActionLock } from './useActionLock';

/** One shared lock for mutually exclusive actions in a screen. */
export function useAsyncAction() {
  const { pending, acquire, release } = useActionLock();
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => void | Promise<unknown>) => {
    if (!acquire()) return false;
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作に失敗しました。もう一度お試しください。');
      return false;
    } finally {
      release();
    }
  };
  return { pending, error, run };
}
