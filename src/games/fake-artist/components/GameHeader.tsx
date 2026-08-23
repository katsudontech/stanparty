'use client';

interface GameHeaderProps {
  roomId: string;
}

export function GameHeader({ roomId }: GameHeaderProps) {
  return (
    <header className="mb-6 border-b-2 border-[var(--line)] py-5 text-left">
      <p className="text-xs font-black tracking-[.14em] text-[var(--orange)]">DRAWING &amp; DEDUCTION · {roomId.slice(0, 6)}</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-.055em] sm:text-4xl">エセ芸術家</h2>
      <p className="mt-2 text-sm font-bold text-[var(--muted)]">一筆ずつ描いて、お題を知らない人を見破ろう。</p>
    </header>
  );
}
