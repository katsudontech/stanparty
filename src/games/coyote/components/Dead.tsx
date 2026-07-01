'use client';

type DeadProps = {
    hp: number;
};

export function Dead({ hp }: DeadProps) {
    return (
        <div className="mx-auto w-full max-w-md select-none">
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur text-center">
                <h1 className="text-3xl font-black text-red-600 mb-3">あなたは死にました！</h1>
                <p className="text-zinc-600 font-bold">ライフ: {hp}</p>
            </div>
        </div>
    );
}
