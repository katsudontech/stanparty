'use client';

type DeadProps = {
    hp: number;
};

export function Dead({ hp }: DeadProps) {
    return (
        <div className="mx-auto w-full max-w-md select-none">
            <div className="paper-card p-6 text-center">
                <p className="mb-2 text-xs font-black tracking-[.14em] text-[var(--orange)]">GAME OVER</p>
                <h1 className="mb-3 text-3xl font-black tracking-[-.05em] text-[var(--ink)]">脱落しました</h1>
                <p className="font-bold text-[var(--muted)]">残りライフ: {hp}</p>
            </div>
        </div>
    );
}
