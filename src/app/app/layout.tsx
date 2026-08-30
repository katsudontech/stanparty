import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プレイホーム',
  description: 'StanPartyで遊ぶゲームと部屋をすぐに選べます。',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-dvh bg-[var(--paper)]">{children}</div>;
}
