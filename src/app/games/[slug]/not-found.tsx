import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';

export default function GameNotFound() {
  return (
    <div className="site-shell">
      <SiteHeader compact />
      <main className="site-container flex min-h-[70vh] flex-col items-start justify-center">
        <p className="section-kicker">404</p>
        <h1 className="section-heading">そのゲームは、まだ準備中です。</h1>
        <p className="mt-5 text-[var(--muted)]">現在遊べるゲームから選んでください。</p>
        <Link href="/games" className="button-primary mt-8">ゲーム一覧へ戻る</Link>
      </main>
    </div>
  );
}
