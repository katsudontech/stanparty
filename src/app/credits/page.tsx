import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import { GAME_CATALOG } from '@/games/catalog';

export const metadata: Metadata = {
  title: '権利表記',
  description: 'StanPartyで紹介・実装しているゲームの権利表記と公式商品情報です。',
};

export default function CreditsPage() {
  return (
    <div className="site-shell">
      <SiteHeader compact />
      <main>
        <section className="site-container py-14 sm:py-20">
          <p className="section-kicker">Credits & rights</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(3rem,8vw,5.6rem)] font-black leading-[.95] tracking-[-.07em]">
            権利表記
          </h1>
          <div className="mt-8 max-w-3xl space-y-4 text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
            <p>
              StanPartyは個人が制作している非公式のWebアプリです。掲載しているゲーム名、商品名、商標、原作に関する権利は、各権利者に帰属します。
            </p>
            <p>
              本サービスは各出版社・作者による承認、提携、協賛を示すものではなく、実物の商品や公式デジタル版を代替するものではありません。
            </p>
          </div>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--paper-deep)] py-14 sm:py-20">
          <div className="site-container grid gap-5">
            {GAME_CATALOG.map((game) => (
              <article key={game.id} className="paper-card grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
                <div>
                  <p className="text-xs font-black tracking-[.12em] text-[var(--orange)]">{game.officialPublisher}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">{game.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    正式な商品情報、クレジット、遊び方は出版社の公式ページをご確認ください。
                  </p>
                </div>
                <a
                  href={game.officialProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button-secondary"
                >
                  公式商品ページ ↗
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="site-container flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-center">
          <div>
            <p className="font-black">StanPartyの遊び方へ戻る</p>
            <p className="mt-1 text-sm text-[var(--muted)]">ゲームの紹介と部屋の作り方を確認できます。</p>
          </div>
          <Link href="/" className="button-primary">ホームへ戻る →</Link>
        </section>
      </main>
    </div>
  );
}
