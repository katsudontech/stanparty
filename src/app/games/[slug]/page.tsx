import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GameArtwork } from '@/components/site/GameArtwork';
import { SiteHeader } from '@/components/site/SiteHeader';
import { GAME_CATALOG, getGameById } from '@/games/catalog';

export function generateStaticParams() {
  return GAME_CATALOG.map((game) => ({ slug: game.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameById(slug);
  if (!game) return {};
  return {
    title: game.shortName,
    description: game.summary,
    openGraph: {
      title: game.shortName,
      description: game.summary,
      images: [],
    },
    twitter: {
      title: game.shortName,
      description: game.summary,
      images: [],
    },
  };
}

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGameById(slug);
  if (!game) notFound();

  return (
    <div className="site-shell" style={{ '--game-accent': game.accent, '--game-soft': game.softColor } as CSSProperties}>
      <SiteHeader compact />
      <main>
        <section className="site-container grid items-center gap-10 py-14 md:grid-cols-[1.08fr_.92fr] md:py-20">
          <div>
            <Link href="/games" className="text-link">← ゲーム一覧に戻る</Link>
            <p className="mt-12 text-xs font-black tracking-[.16em] text-[var(--game-accent)]">{game.mood}</p>
            <h1 className="mt-3 text-[clamp(3rem,8vw,6.2rem)] font-black leading-[.92] tracking-[-.07em]">{game.shortName}</h1>
            <p className="mt-6 max-w-2xl text-xl font-black leading-8 sm:text-2xl">{game.catchphrase}</p>
          </div>
          <div className="paper-card rotate-[1.5deg] overflow-hidden bg-[var(--game-soft)] p-6">
            <div className="flex justify-between border-b-2 border-[var(--line)] pb-3 text-xs font-black">
              <span>STANPARTY GAME GUIDE</span><span>{game.duration}</span>
            </div>
            <GameArtwork gameId={game.id} className="h-64 w-full" />
          </div>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--surface)]">
          <dl className="site-container grid grid-cols-2 md:grid-cols-4">
            {[
              ['人数', game.players], ['時間', game.duration], ['難しさ', game.difficulty], ['タイプ', game.mood],
            ].map(([term, value], index) => (
              <div key={term} className={`py-6 ${index % 2 ? 'border-l-2' : ''} px-5 md:border-l-2 md:first:border-l-0`}>
                <dt className="text-xs font-black text-[var(--muted)]">{term}</dt>
                <dd className="mt-1 text-lg font-black">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="site-container grid gap-12 py-20 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
          <div>
            <p className="section-kicker">What kind of game?</p>
            <h2 className="section-heading">どんなゲーム？</h2>
            <div className="mt-7 space-y-5 text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
              {game.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
          <aside className="paper-card self-start p-6 sm:p-8">
            <p className="text-xs font-black tracking-[.14em] text-[var(--game-accent)]">このゲームの面白さ</p>
            <ul className="mt-5 space-y-5">
              {game.funPoints.map((point, index) => (
                <li key={point} className="flex gap-4 border-b border-[#c8c6b9] pb-5 last:border-0 last:pb-0">
                  <span className="font-black text-[var(--game-accent)]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="font-black leading-6">{point}</span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--game-soft)] py-20">
          <div className="site-container">
            <p className="section-kicker">Rules</p>
            <h2 className="section-heading">遊び方</h2>
            <ol className="mt-12 grid gap-x-10 gap-y-9 md:grid-cols-2">
              {game.steps.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[58px_1fr] gap-4 border-t-2 border-[var(--line)] pt-5">
                  <span className="text-4xl font-black text-[var(--game-accent)]">{index + 1}</span>
                  <div><h3 className="text-lg font-black">{step.title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{step.body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="site-container grid gap-8 py-20 md:grid-cols-2">
          <div className="border-t-2 border-[var(--line)] pt-6">
            <h2 className="text-2xl font-black tracking-[-.04em]">こんなときにおすすめ</h2>
            <ul className="mt-5 space-y-3">
              {game.goodFor.map((item) => <li key={item} className="font-bold"><span className="mr-3 text-[var(--game-accent)]">●</span>{item}</li>)}
            </ul>
          </div>
          <div className="border-t-2 border-[var(--line)] pt-6">
            <h2 className="text-2xl font-black tracking-[-.04em]">盛り上がるコツ</h2>
            <ul className="mt-5 space-y-3">
              {game.tips.map((item) => <li key={item} className="font-bold"><span className="mr-3 text-[var(--game-accent)]">→</span>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-t-2 border-[var(--line)] bg-[var(--yellow)] py-14">
          <div className="site-container flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
            <div><p className="text-sm font-black">遊びたくなったら</p><h2 className="mt-1 text-3xl font-black tracking-[-.05em]">みんなを部屋に呼ぼう。</h2></div>
            <div className="flex w-full flex-col items-start gap-4 sm:w-auto sm:items-end">
              <Link href="/create_room" className="button-secondary bg-white">遊ぶ部屋をつくる →</Link>
              {game.officialProductUrl && game.officialPublisher ? <a href={game.officialProductUrl} target="_blank" rel="noreferrer" className="text-link">
                {game.officialPublisher}の公式商品ページ ↗
              </a> : <span className="text-sm font-bold text-[var(--muted)]">StanPartyオリジナルゲーム</span>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
