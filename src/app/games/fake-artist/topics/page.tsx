import type { Metadata } from 'next';
import { PendingLink as Link } from '@/components/shared/PendingLink';
import { SiteHeader } from '@/components/site/SiteHeader';
import { FAKE_ARTIST_TOPIC_CATEGORIES } from '@/games/fake-artist/topics';
import { SITE_URL } from '@/lib/site';

const canonical = new URL('/games/fake-artist/topics', SITE_URL).toString();

export const metadata: Metadata = {
  title: 'エセ芸術家のお題の例｜遊びやすいテーマの選び方',
  description: 'エセ芸術家を遊ぶときに使えるお題の例を、動物・食べ物・場所などのジャンル別に紹介。描きやすさと難しさに合わせたテーマの選び方も解説します。',
  alternates: { canonical },
  openGraph: {
    title: 'エセ芸術家のお題の例｜遊びやすいテーマの選び方',
    description: 'エセ芸術家を遊ぶときに使えるお題の例をジャンル別に紹介。グループに合うテーマの選び方も解説します。',
    url: canonical,
    siteName: 'StanParty',
    locale: 'ja_JP',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'エセ芸術家のお題の例｜遊びやすいテーマの選び方',
    description: 'エセ芸術家のお題を決めるときに役立つ、ジャンル別の具体例と選び方。',
  },
};

const topicTips = [
  {
    title: '最初は形にできるものを選ぶ',
    body: '動物、食べ物、乗り物のように輪郭や特徴が思い浮かぶテーマは、初めてでも一筆のヒントを出しやすくなります。',
  },
  {
    title: '全員が知っている範囲にする',
    body: '特定の作品や身内だけの思い出は、知識の差が大きくなります。誰でも見たことがあるものから始めると推理が公平です。',
  },
  {
    title: '簡単すぎるときは場面を足す',
    body: '「傘」だけで簡単なら「風で飛びそうな傘」のように状態や場所を加えると、描く人の工夫と観察が生まれます。',
  },
  {
    title: '一筆で伝わりすぎないものを選ぶ',
    body: '最初の線だけで答えが決まるテーマは、エセ芸術家がお題を推測しやすくなります。特徴が2つ以上あるものを選ぶと、どこまで描くかの駆け引きを楽しめます。',
  },
] as const;

export default function FakeArtistTopicsPage() {
  return (
    <div className="site-shell mobile-page">
      <SiteHeader compact />
      <main>
        <section className="site-container py-14 sm:py-20">
          <Link href="/games/fake-artist" className="text-link">← エセ芸術家の遊び方に戻る</Link>
          <p className="section-kicker mt-12">Topic guide</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,8vw,5rem)] font-black leading-[1.02] tracking-[-.07em]">
            エセ芸術家の<br />お題の例
          </h1>
          <p className="mt-7 max-w-2xl text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
            お題は、本物の芸術家だけが知った状態で絵を描くための大事な材料です。ここでは、ホストが手動でお題を決めるときに使える、ジャンル別の具体例を紹介します。
          </p>
          <div className="mt-8 border-l-4 border-[var(--orange)] pl-5 text-sm font-bold leading-7 text-[var(--muted)] sm:text-base">
            自動お題選択では、ゲームに用意されたジャンルとお題からランダムに決まります。下の例は、手動設定でそのまま入力したり、遊ぶメンバーに合わせてアレンジしたりできます。
          </div>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--paper-deep)] py-16 sm:py-20" aria-labelledby="topic-examples-heading">
          <div className="site-container">
            <p className="section-kicker">Examples</p>
            <h2 id="topic-examples-heading" className="section-heading mt-3">ジャンル別のお題候補</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FAKE_ARTIST_TOPIC_CATEGORIES.map((category) => (
                <article key={category.name} className="paper-card p-5 sm:p-6">
                  <h3 className="border-b-2 border-[var(--line)] pb-3 text-xl font-black tracking-[-.04em]">{category.name}</h3>
                  <p className="mt-4 text-xs font-black text-[var(--orange)]">まずは一言で</p>
                  <ul className="mt-2 space-y-2 text-sm font-bold leading-6 text-[var(--muted)]">
                    {category.starterExamples.map((example) => <li key={example} className="flex gap-2"><span className="text-[var(--orange)]" aria-hidden="true">●</span><span>{example}</span></li>)}
                  </ul>
                  <p className="mt-4 text-xs font-black text-[var(--orange)]">慣れたら場面を足す</p>
                  <ul className="mt-2 space-y-2 text-sm font-bold leading-6 text-[var(--muted)]">
                    {category.challengeExamples.map((example) => <li key={example} className="flex gap-2"><span className="text-[var(--orange)]" aria-hidden="true">●</span><span>{example}</span></li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-container py-16 sm:py-20" aria-labelledby="topic-tips-heading">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="section-kicker">How to choose</p>
              <h2 id="topic-tips-heading" className="section-heading mt-3">遊ぶメンバーに<br />合うお題の選び方</h2>
              <p className="mt-6 leading-7 text-[var(--muted)]">お題を知っている人が描きすぎても、知らない人が何も描けなくても、推理の面白さは小さくなります。次の基準で、グループにちょうどいい難しさを探してみてください。</p>
            </div>
            <ol className="grid gap-5 sm:grid-cols-2">
              {topicTips.map((tip, index) => (
                <li key={tip.title} className="border-t-2 border-[var(--line)] pt-5">
                  <span className="text-3xl font-black text-[var(--orange)]">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 text-lg font-black">{tip.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{tip.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--yellow)] py-14" aria-labelledby="topic-play-heading">
          <div className="site-container flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black">お題が決まったら</p>
              <h2 id="topic-play-heading" className="mt-1 text-3xl font-black tracking-[-.05em]">エセ芸術家をWebで遊ぶ</h2>
              <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-[var(--muted)]">ルームを作ってURLを共有すれば、スマホのブラウザから一緒に参加できます。</p>
            </div>
            <div className="flex w-full flex-col items-start gap-4 sm:w-auto sm:items-end">
              <Link href="/create_room" className="button-secondary bg-white">無料でルームをつくる →</Link>
              <Link href="/games/fake-artist" className="text-link">ルールと遊び方を見る →</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
