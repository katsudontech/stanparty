import type { Metadata } from 'next';
import Link from 'next/link';
import { GameCard } from '@/components/site/GameCard';
import { SiteHeader } from '@/components/site/SiteHeader';
import { GAME_CATALOG } from '@/games/catalog';

export const metadata: Metadata = {
  title: 'ゲーム一覧',
  description: 'StanPartyで遊べるゲームの人数、時間、ルール、面白さを紹介します。',
};

export default function GamesPage() {
  return (
    <div className="site-shell mobile-page">
      <SiteHeader compact />
      <main>
        <section className="site-container py-16 sm:py-20">
          <p className="section-kicker">Game guide</p>
          <div className="mt-4 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <h1 className="max-w-3xl text-[clamp(2.5rem,8vw,6rem)] font-black leading-[.95] tracking-[-.07em]">
              遊べるゲームを<br />じっくり選ぶ。
            </h1>
            <p className="max-w-md border-l-2 border-[var(--line)] pl-5 leading-7 text-[var(--muted)]">
              人数や気分に合うゲームを探して、ルールと楽しみ方を確認できます。今後も少しずつ追加予定です。
            </p>
          </div>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--paper-deep)] py-16 sm:py-20">
          <div className="site-container game-grid">
            {GAME_CATALOG.map((game, index) => <GameCard key={game.id} game={game} index={index + 1} />)}
          </div>
        </section>

        <section className="site-container flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-center">
          <div>
            <p className="font-black">遊ぶゲームは部屋の中で変更できます。</p>
            <p className="mt-1 text-sm text-[var(--muted)]">まず部屋をつくって、集まってから相談しても大丈夫です。</p>
          </div>
          <Link href="/create_room" className="button-primary">部屋をつくる →</Link>
        </section>
      </main>
    </div>
  );
}
