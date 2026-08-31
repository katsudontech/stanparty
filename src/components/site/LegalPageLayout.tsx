import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';

interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  lead: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPageLayout({
  eyebrow,
  title,
  lead,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="site-shell mobile-page">
      <SiteHeader compact />
      <main>
        <section className="site-container py-14 sm:py-20">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,8vw,5.6rem)] font-black leading-[.95] tracking-[-.07em]">
            {title}
          </h1>
          <p className="mt-8 max-w-3xl text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
            {lead}
          </p>
          <p className="mt-4 text-xs font-bold text-[var(--muted)]">最終更新日：{lastUpdated}</p>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--paper-deep)] py-14 sm:py-20">
          <article className="site-container legal-document">
            {children}
          </article>
        </section>

        <section className="site-container flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-center">
          <div>
            <p className="font-black">分からないことや不具合がありますか？</p>
            <p className="mt-1 text-sm text-[var(--muted)]">サポートページから報告方法を確認できます。</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/contact" className="button-secondary">問い合わせ先を見る</Link>
            <Link href="/" className="button-primary">ホームへ戻る →</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
