import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import {
  OPERATOR_PROFILE_URL,
  SUPPORT_ISSUE_URL,
  SUPPORT_ISSUES_URL,
} from '@/lib/site';

export const metadata: Metadata = {
  title: '問い合わせ・不具合報告',
  description: 'StanPartyの不具合報告、権利・プライバシーに関する連絡方法です。',
};

export default function ContactPage() {
  return (
    <div className="site-shell mobile-page">
      <SiteHeader compact />
      <main>
        <section className="site-container py-14 sm:py-20">
          <p className="section-kicker">Support</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,8vw,5.6rem)] font-black leading-[.95] tracking-[-.07em]">
            問い合わせ・<br />不具合報告
          </h1>
          <p className="mt-8 max-w-3xl text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
            不具合はGitHub Issuesで受け付けています。報告前に、同じ問題が登録されていないかご確認ください。
          </p>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--paper-deep)] py-14 sm:py-20">
          <div className="site-container grid gap-6 lg:grid-cols-2">
            <article className="paper-card p-6 sm:p-8">
              <p className="text-xs font-black tracking-[.12em] text-[var(--orange)]">BUG REPORT</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-.04em]">不具合を報告する</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                発生した画面、操作手順、期待していた動作、実際の動作、端末とブラウザを記載してください。
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href={SUPPORT_ISSUE_URL} target="_blank" rel="noreferrer" className="button-primary">
                  新しく報告する ↗
                </a>
                <a href={SUPPORT_ISSUES_URL} target="_blank" rel="noreferrer" className="button-secondary">
                  既存の報告を見る ↗
                </a>
              </div>
            </article>

            <article className="paper-card p-6 sm:p-8">
              <p className="text-xs font-black tracking-[.12em] text-[var(--blue)]">OTHER CONTACT</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-.04em]">権利・プライバシーの連絡</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                権利に関する連絡、データの取扱いに関する相談など、公開Issueに適さない内容は運営者のGitHubプロフィールに掲載されている連絡手段をご利用ください。
              </p>
              <a href={OPERATOR_PROFILE_URL} target="_blank" rel="noreferrer" className="button-secondary mt-7">
                運営者プロフィールを見る ↗
              </a>
            </article>
          </div>
        </section>

        <section className="site-container grid gap-8 py-14 lg:grid-cols-[1.1fr_.9fr] sm:py-20">
          <div>
            <p className="section-kicker">Before reporting</p>
            <h2 className="section-heading">報告するときのお願い</h2>
            <ul className="mt-7 space-y-4 font-bold leading-7 text-[var(--muted)]">
              <li>● GitHub Issuesは誰でも閲覧できる公開ページです。</li>
              <li>● 本名、メールアドレス、ルームの招待URL、匿名ID、認証情報は書かないでください。</li>
              <li>● スクリーンショットを添付するときは、表示名やルームIDを隠してください。</li>
              <li>● 権利侵害やセキュリティ問題は、公開Issueではなく個別の連絡手段をご利用ください。</li>
            </ul>
          </div>
          <aside className="paper-card self-start p-6 sm:p-8">
            <h2 className="text-xl font-black">利用前に確認する</h2>
            <nav className="mt-5 grid gap-3" aria-label="ポリシーへのリンク">
              <Link href="/privacy" className="text-link">プライバシーポリシー →</Link>
              <Link href="/terms" className="text-link">利用規約 →</Link>
              <Link href="/credits" className="text-link">権利表記 →</Link>
            </nav>
          </aside>
        </section>
      </main>
    </div>
  );
}
