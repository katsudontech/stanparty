'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';

function NavigationStatus() {
  const { pending } = useLinkStatus();
  return <span data-link-pending={pending} className="navigation-status" role="status">
    {pending ? '移動中…' : null}
  </span>;
}

/** Retains Next prefetching and native new-tab behavior. */
export function PendingLink({ children, onClick, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (event.detail > 1 || event.currentTarget.querySelector('[data-link-pending="true"]')) {
      event.preventDefault();
    }
  }}>
    {children}
    <NavigationStatus />
  </Link>;
}
