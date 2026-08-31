'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/shared/Avatar';
import { GameArtwork } from '@/components/site/GameArtwork';
import { GAME_CATALOG } from '@/games/catalog';
import { useGuestAuth } from '@/hooks/useGuestAuth';

export default function AppHome() {
  const { profile, loading } = useGuestAuth();

  return (
    <main className="mobile-page app-page mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between gap-4" aria-label="アプリヘッダー">
        <Link href="/app" className="site-brand" aria-label="StanParty プレイホーム">
          <span className="site-brand__mark" aria-hidden="true">SP</span>
          <span>StanParty</span>
        </Link>
        <Link
          href="/games"
          className="rounded-full border-2 border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-black shadow-[2px_2px_0_var(--line)] transition-transform hover:translate-x-px hover:translate-y-px"
        >
          ゲーム一覧
        </Link>
      </header>

      <section className="app-page__profile mt-8 flex min-w-0 items-center gap-3 border-b-2 border-[var(--line)] pb-6" aria-labelledby="player-heading">
        {loading ? (
          <span className="h-14 w-14 animate-pulse rounded-full bg-[var(--paper-deep)]" aria-label="プレイヤーを読み込み中" />
        ) : (
          <Avatar avatarUrl={profile?.avatar} name={profile?.name ?? 'ゲスト'} size="lg" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-black tracking-[.12em] text-[var(--muted)]">WELCOME BACK</p>
          <h1 id="player-heading" className="truncate text-2xl font-black tracking-[-.05em]">
            {loading ? 'プレイヤーを確認中…' : `${profile?.name || 'ゲスト'}さん`}
          </h1>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-[var(--green)] px-3 py-1 text-[.68rem] font-black text-white">登録不要</span>
      </section>

      <section className="app-page__actions mt-6" aria-labelledby="actions-heading">
        <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div>
            <p className="section-kicker">Let&apos;s play</p>
            <h2 id="actions-heading" className="mt-2 text-3xl font-black tracking-[-.06em]">なにして遊ぶ？</h2>
          </div>
          <span className="text-xs font-bold text-[var(--muted)]">すぐ開始できます</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/create_room" className="button-primary min-h-16 justify-between px-5 text-base">
            <span><span className="mb-1 block text-[.65rem] font-bold tracking-[.12em] opacity-80">HOST A ROOM</span>部屋をつくる</span>
            <span aria-hidden="true" className="text-2xl">＋</span>
          </Link>
          <Link href="/join_room" className="button-secondary min-h-16 justify-between px-5 text-base">
            <span><span className="mb-1 block text-[.65rem] font-bold tracking-[.12em] text-[var(--muted)]">JOIN A ROOM</span>部屋を探す</span>
            <span aria-hidden="true" className="text-2xl">→</span>
          </Link>
        </div>
      </section>

      <section className="app-page__games mt-8" aria-labelledby="games-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="section-kicker">Playable now</p>
            <h2 id="games-heading" className="mt-2 text-2xl font-black tracking-[-.05em]">遊べるゲーム</h2>
          </div>
          <Link href="/games" className="text-link shrink-0 text-sm">すべて見る →</Link>
        </div>
        <div className="app-page__game-rail grid grid-cols-2 gap-3">
          {GAME_CATALOG.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className="app-page__game-card group overflow-hidden rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] shadow-[3px_3px_0_var(--line)] transition-transform hover:-translate-y-0.5"
              style={{ '--game-accent': game.accent, '--game-soft': game.softColor } as CSSProperties}
            >
              <div className="flex h-28 items-center justify-center bg-[var(--game-soft)] px-4 text-[var(--game-accent)] sm:h-32">
                <GameArtwork gameId={game.id} className="h-full w-full transition-transform group-hover:scale-105" />
              </div>
              <div className="border-t-2 border-[var(--line)] px-3 py-3">
                <p className="truncate text-[.68rem] font-black text-[var(--muted)]">{game.mood}</p>
                <h3 className="mt-1 truncate font-black">{game.shortName}</h3>
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">{game.players} ・ {game.duration}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <nav className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t-2 border-[var(--line)] pt-6 text-xs font-bold text-[var(--muted)]" aria-label="サポートと規約">
        <Link href="/contact" className="underline underline-offset-4 hover:text-[var(--orange)]">サポート</Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-[var(--orange)]">プライバシー</Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-[var(--orange)]">利用規約</Link>
        <Link href="/credits" className="underline underline-offset-4 hover:text-[var(--orange)]">権利表記</Link>
      </nav>
    </main>
  );
}
