'use client';

import { useState } from 'react';

interface ThemeSelectionPhaseProps {
  themeCandidate: string | null;
  isHost: boolean;
  onDrawTheme: () => Promise<void>;
  onSelectTheme: (theme: string) => Promise<void>;
  onBackToRules: () => Promise<void>;
}

export function ThemeSelectionPhase({
  themeCandidate,
  isHost,
  onDrawTheme,
  onSelectTheme,
  onBackToRules,
}: ThemeSelectionPhaseProps) {
  const [customTheme, setCustomTheme] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAction = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'お題を更新できませんでした');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-fuchsia-300">Theme</p>
        <h2 className="mt-2 text-3xl font-black text-white">お題を決めよう</h2>
        <p className="mt-2 text-sm text-slate-400">全員が話しやすいお題を選んでください。</p>
      </div>

      <div className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-6">
        <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">ランダムなお題</p>
        <p className="my-6 min-h-16 text-2xl font-black text-white">
          {themeCandidate ?? 'お題を引いてください'}
        </p>
        {isHost && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => runAction(onDrawTheme)}
              disabled={submitting}
              className="rounded-2xl border border-fuchsia-300/30 bg-slate-950/40 px-4 py-3 font-bold text-fuchsia-100 hover:bg-slate-950/70 disabled:opacity-40"
            >
              別のお題を引く
            </button>
            <button
              type="button"
              onClick={() => themeCandidate && runAction(() => onSelectTheme(themeCandidate))}
              disabled={!themeCandidate || submitting}
              className="rounded-2xl bg-fuchsia-500 px-4 py-3 font-black text-white hover:bg-fuchsia-400 disabled:opacity-40"
            >
              このお題で開始
            </button>
          </div>
        )}
      </div>

      {isHost ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-left">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-200">ホストがお題を入力</span>
            <input
              type="text"
              maxLength={100}
              value={customTheme}
              onChange={(event) => setCustomTheme(event.target.value)}
              placeholder="例：動物の強さ"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
            />
            <span className="mt-2 block text-right text-xs text-slate-500">{customTheme.length}/100</span>
          </label>
          <button
            type="button"
            onClick={() => runAction(() => onSelectTheme(customTheme))}
            disabled={!customTheme.trim() || submitting}
            className="mt-4 w-full rounded-2xl bg-cyan-500 px-4 py-3 font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            入力したお題で開始
          </button>
          <button
            type="button"
            onClick={() => runAction(onBackToRules)}
            disabled={submitting}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            カード枚数の設定へ戻る
          </button>
          {errorMessage && (
            <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{errorMessage}</p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-900/80 p-5 font-bold text-slate-400">
          ホストがお題を選んでいます...
        </p>
      )}
    </section>
  );
}
