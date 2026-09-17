'use client';

import { PendingLink as Link } from '@/components/shared/PendingLink';
import { useSyncExternalStore, type ReactNode } from 'react';

const appDisplayMode = '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)';

function subscribeToDisplayMode(onChange: () => void) {
  const query = window.matchMedia(appDisplayMode);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isAppDisplayMode() {
  return window.matchMedia(appDisplayMode).matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
    || document.referrer.startsWith('android-app://');
}

function getServerAppDisplayMode() {
  return false;
}

interface SiteHeaderProps {
  compact?: boolean;
  headerActions?: ReactNode;
}

export function SiteHeader({ compact = false, headerActions }: SiteHeaderProps) {
  const isApp = useSyncExternalStore(subscribeToDisplayMode, isAppDisplayMode, getServerAppDisplayMode);

  return (
    <header data-room-header={headerActions ? true : undefined} className={`site-header ${compact ? 'site-header--compact' : ''} ${headerActions ? 'site-header--room' : ''}`}>
      <Link href={isApp ? '/app' : '/'} className="site-brand" aria-label="StanParty ホーム">
        <span className="site-brand__mark" aria-hidden="true">SP</span>
        <span>StanParty</span>
      </Link>
      {!headerActions && (
        <nav className="site-nav" aria-label="メインナビゲーション">
          <Link href="/games">ゲーム一覧</Link>
          <Link href="/join_room">部屋を探す</Link>
          <Link href="/credits">権利表記</Link>
          <Link href="/contact">サポート</Link>
        </nav>
      )}
      {headerActions}
    </header>
  );
}
