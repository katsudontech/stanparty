import Link from 'next/link';
import type { ReactNode } from 'react';

interface SiteHeaderProps {
  compact?: boolean;
  headerActions?: ReactNode;
}

export function SiteHeader({ compact = false, headerActions }: SiteHeaderProps) {
  return (
    <header data-room-header={headerActions ? true : undefined} className={`site-header ${compact ? 'site-header--compact' : ''} ${headerActions ? 'site-header--room' : ''}`}>
      <Link href="/" className="site-brand" aria-label="StanParty ホーム">
        <span className="site-brand__mark" aria-hidden="true">SP</span>
        <span>StanParty</span>
      </Link>
      <nav className="site-nav" aria-label="メインナビゲーション">
        <Link href="/games">ゲーム一覧</Link>
        <Link href="/join_room">部屋を探す</Link>
        <Link href="/credits">権利表記</Link>
        <Link href="/contact">サポート</Link>
      </nav>
      {headerActions}
    </header>
  );
}
