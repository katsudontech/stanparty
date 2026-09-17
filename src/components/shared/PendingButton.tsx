'use client';

import type { ComponentProps } from 'react';

type Props = ComponentProps<'button'> & { busy: boolean; pendingLabel?: string };

/** The caller owns the lock so keyboard submission and sibling actions share it. */
export function PendingButton({ busy, pendingLabel = '処理中…', disabled, children, onClick, onKeyDown, type = 'button', ...props }: Props) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy}
    onClick={(event) => {
      // Also suppress the second click when a fast request already completed.
      if (busy || disabled || event.detail > 1) { event.preventDefault(); return; }
      onClick?.(event);
    }}
    onKeyDown={(event) => {
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); return; }
      onKeyDown?.(event);
    }}
  >
    {busy ? <span role="status">{pendingLabel}</span> : children}
  </button>;
}
