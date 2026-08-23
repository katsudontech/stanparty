'use client';

import { useState } from 'react';

import { getMaxCardsPerPlayer, isValidItoPlayerCount } from '../rules';

interface RuleSettingPhaseProps {
  playerCount: number;
  initialCardsPerPlayer: number;
  isHost: boolean;
  onStart: (cardsPerPlayer: number) => Promise<void>;
  onBackToLobby: () => Promise<void>;
}

export function RuleSettingPhase({
  playerCount,
  initialCardsPerPlayer,
  isHost,
  onStart,
  onBackToLobby,
}: RuleSettingPhaseProps) {
  const maxCardsPerPlayer = getMaxCardsPerPlayer(playerCount);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(initialCardsPerPlayer);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canStart = isValidItoPlayerCount(playerCount);
  const normalizedCardsPerPlayer = Math.min(
    Math.max(cardsPerPlayer, 1),
    Math.max(maxCardsPerPlayer, 1),
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onStart(normalizedCardsPerPlayer);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ゲームを準備できませんでした');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToLobby = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onBackToLobby();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ロビーに戻れませんでした');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 text-left">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">How to play</p>
        <h2 className="mt-2 text-3xl font-black text-white">ito クモノイト2.0</h2>
        <ol className="mt-5 space-y-3 text-sm leading-relaxed text-slate-200 sm:text-base">
          <li>1. 自分の数字を、お題に沿った言葉でたとえます。</li>
          <li>2. 数字を見せずに、全員のカードを1から100の順に並べます。</li>
          <li>3. 完成したらカードをめくり、すべて昇順なら成功です。</li>
        </ol>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-400">参加人数</p>
            <p className="text-2xl font-black text-white">{playerCount}人</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${canStart ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
            {canStart ? 'プレイ可能' : '2〜14人必要'}
          </span>
        </div>

        {isHost ? (
          <div className="space-y-5">
            <label className="block text-left">
              <span className="mb-2 block text-sm font-bold text-slate-300">1人あたりのカード枚数</span>
              <input
                type="number"
                min={1}
                max={Math.max(maxCardsPerPlayer, 1)}
                value={normalizedCardsPerPlayer}
                onChange={(event) => setCardsPerPlayer(Number(event.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-center text-2xl font-black text-white outline-none focus:border-cyan-400"
              />
              <span className="mt-2 block text-xs text-slate-500">
                デフォルトは1枚・現在の人数では最大{maxCardsPerPlayer || '-'}枚
              </span>
            </label>

            {errorMessage && (
              <p className="rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{errorMessage}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canStart || submitting}
              className="w-full rounded-2xl bg-cyan-500 px-5 py-4 text-lg font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? '準備中...' : 'お題選択へ'}
            </button>
            <button
              type="button"
              onClick={handleBackToLobby}
              disabled={submitting}
              className="w-full rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              ロビーへ戻る
            </button>
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-950/70 p-4 font-bold text-slate-400">
            ホストがカード枚数を設定しています...
          </p>
        )}
      </div>
    </section>
  );
}
