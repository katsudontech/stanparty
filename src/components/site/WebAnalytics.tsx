'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

export function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    if (!event.url.trim()) {
      return null;
    }

    const pathname = new URL(event.url, 'http://localhost').pathname;

    if (pathname.startsWith('/room/')) {
      return null;
    }
  } catch {
    // Do not send an event when its URL cannot be parsed safely.
    return null;
  }

  return event;
}

export function WebAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
