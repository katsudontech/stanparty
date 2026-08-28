'use client';

import Link from 'next/link';
import { Avatar } from '@/components/shared/Avatar';
import { GameArtwork } from '@/components/site/GameArtwork';
import { GameCard } from '@/components/site/GameCard';
import { SiteHeader } from '@/components/site/SiteHeader';
import { GAME_CATALOG } from '@/games/catalog';
import { useGuestAuth } from '@/hooks/useGuestAuth';

export default function Home() {
  const { profile, loading } = useGuestAuth();

  return (
    <div className="site-shell">
      <SiteHeader />

      <main>
        <section className="site-container grid min-h-[650px] items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
          <div>
            <p className="section-kicker">Party games in your pocket</p>
            <h1 className="mt-5 max-w-3xl text-[clamp(2.7rem,11vw,4.3rem)] font-black leading-[.98] tracking-[-.07em]">
              待ってる時間が、<br />いちばん盛り上がる。
            </h1>
            <p className="mt-7 max-w-xl text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
              道具もアカウント登録もいりません。誰かが部屋をつくってURLを送れば、みんなのスマホですぐ遊べます。
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/create_room" className="button-primary">
                部屋をつくる <span aria-hidden="true">＋</span>
              </Link>
              <Link href="/join_room" className="button-secondary">
                開いている部屋を探す <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-3 border-t border-[var(--line)] pt-5 sm:max-w-md">
              {loading ? (
                <span className="h-10 w-10 animate-pulse rounded-full bg-[var(--paper-deep)]" />
              ) : (
                <Avatar avatarUrl={profile?.avatar} name={profile?.name ?? 'ゲスト'} size="md" />
              )}
              <div>
                <p className="text-[.68rem] font-black tracking-[.12em] text-[var(--muted)]">この端末のプレイヤー</p>
                <p className="font-black">{loading ? '読み込み中…' : profile?.name || 'ゲスト'}</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[500px] lg:block" aria-hidden="true">
            <div className="paper-card relative ml-auto w-[82%] rotate-[2deg] overflow-hidden bg-[#c8e1e7] p-5">
              <div className="flex items-center justify-between border-b-2 border-[var(--line)] pb-3 text-xs font-black">
                <span>GAME 03</span><span>協力</span>
              </div>
              <GameArtwork gameId="ito" className="h-56 w-full" />
              <p className="text-3xl font-black tracking-[-.05em]">ito</p>
            </div>
            <div className="paper-card absolute -left-4 top-16 w-[68%] -rotate-[5deg] overflow-hidden bg-[#f2dfa8] p-5">
              <div className="flex items-center justify-between border-b-2 border-[var(--line)] pb-3 text-xs font-black">
                <span>GAME 02</span><span>駆け引き</span>
              </div>
              <GameArtwork gameId="coyote" className="h-48 w-full" />
              <p className="text-3xl font-black tracking-[-.05em]">Coyote</p>
            </div>
            <div className="absolute -bottom-8 right-0 rotate-[4deg] border-2 border-[var(--line)] bg-[var(--orange)] px-6 py-4 text-lg font-black text-white shadow-[4px_4px_0_var(--line)]">
              3 GAMES<br /><span className="text-xs">いま遊べます</span>
            </div>
          </div>
        </section>

        <section id="games" className="border-y-2 border-[var(--line)] bg-[var(--paper-deep)] py-20 sm:py-24">
          <div className="site-container">
            <div className="mb-12 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="section-kicker">Games</p>
                <h2 className="section-heading">今日は、なにして遊ぶ？</h2>
              </div>
              <Link href="/games" className="text-link">ゲーム一覧を開く →</Link>
            </div>
            <div className="game-grid">
              {GAME_CATALOG.map((game, index) => <GameCard key={game.id} game={game} index={index + 1} />)}
            </div>
          </div>
        </section>

        <section className="site-container py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
            <div>
              <p className="section-kicker">How to start</p>
              <h2 className="section-heading">集合したら、<br />3ステップ。</h2>
              <p className="mt-6 max-w-sm leading-7 text-[var(--muted)]">面倒な登録やアプリのインストールはありません。ブラウザだけで始められます。</p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {[
                ['01', '部屋をつくる', '名前と部屋名を決めます。ゲームはあとから選べます。'],
                ['02', 'URLを送る', '待機画面の招待ボタンから、友達へURLを共有します。'],
                ['03', 'ゲーム開始', '全員そろったら、遊びたいゲームを選んでスタート。'],
              ].map(([number, title, body]) => (
                <li key={number} className="border-l-2 border-[var(--line)] py-2 pl-5">
                  <span className="text-4xl font-black text-[var(--orange)]">{number}</span>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t-2 border-[var(--line)] bg-[var(--yellow)] py-14">
          <div className="site-container flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black">準備はできましたか？</p>
              <h2 className="mt-1 text-3xl font-black tracking-[-.05em] sm:text-4xl">待ち時間を、遊ぶ時間に。</h2>
            </div>
            <Link href="/create_room" className="button-secondary bg-white">無料で部屋をつくる →</Link>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-[var(--line)] bg-[var(--ink)] py-8 text-[var(--surface)]">
        <div className="site-container flex items-center justify-between gap-4 text-xs font-bold">
          <span>StanParty</span>
          <div className="flex items-center gap-5">
            <Link href="/credits" className="underline underline-offset-4">権利表記</Link>
            <span>スマホひとつで、みんなと遊ぼう。</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
