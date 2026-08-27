'use client';

import { useState, useEffect } from 'react';
import type { FakeArtistGameState } from '../types';

interface ThemeSelectionPhaseProps {
  gameState: FakeArtistGameState;
  myUserId: string | null;
  isHost: boolean;
  onThemeSubmit: (themeGenre: string, theme: string) => Promise<void>;
  updateGameState?: (updates: Partial<FakeArtistGameState>) => Promise<void>;
}

export function ThemeSelectionPhase({ gameState, myUserId, isHost, onThemeSubmit, updateGameState }: ThemeSelectionPhaseProps) {
  const { ruleSettings, playerStates } = gameState;
  const myRole = playerStates[myUserId || '']?.role;
  const isQuestioner = myRole === 'questioner';
  const isFakeArtist = myRole === 'fake_artist';

  const [inputGenre, setInputGenre] = useState('');
  const [inputTheme, setInputTheme] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isThemeDecided = Boolean(gameState.themeGenre && gameState.theme);

  // タイマー進行のみ
  useEffect(() => {
    // 進行権限：自動ならホスト、手動なら出題者
    const hasPermission = ruleSettings.autoThemeSelection ? isHost : isQuestioner;

    if (isThemeDecided && hasPermission) {
      const timer = setTimeout(() => {
        void onThemeSubmit(gameState.themeGenre!, gameState.theme!).catch((error: unknown) => {
          setSubmitError(error instanceof Error ? error.message : '描画フェーズへ進めませんでした');
        });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [ruleSettings.autoThemeSelection, isHost, isQuestioner, isThemeDecided, onThemeSubmit, gameState.themeGenre, gameState.theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputGenre.trim() || !inputTheme.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (updateGameState) {
        await updateGameState({ themeGenre: inputGenre.trim(), theme: inputTheme.trim() });
      } else {
        await onThemeSubmit(inputGenre.trim(), inputTheme.trim());
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'お題を保存できませんでした');
    } finally {
      setIsSubmitting(false);
    }
  };

  // お題が決定済みの場合は全員にお題表示（5秒間）
  if (isThemeDecided) {
    return (
      <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600 flex flex-col items-center">
        <h3 className="text-2xl font-bold mb-6 text-indigo-400">
          {ruleSettings.autoThemeSelection ? 'お題決定（自動）' : 'お題決定'}
        </h3>
        <div className="text-center animate-fade-in w-full">
          <p className="text-xl text-slate-300 mb-6 font-bold">あなたのお題は...</p>
          <div className="bg-slate-800 p-8 rounded-lg border border-slate-600 shadow-inner w-full max-w-md mx-auto">
            <div className="mb-6">
              <span className="text-sm text-slate-400 block mb-2">ジャンル</span>
              <span className="text-3xl font-bold text-white">{gameState.themeGenre}</span>
            </div>
            <div className="bg-slate-900 py-6 px-4 rounded-xl border border-slate-700">
              <span className="text-sm text-slate-400 block mb-2">お題</span>
              <span className={`text-4xl font-black tracking-wider ${isFakeArtist ? 'text-rose-500' : 'text-emerald-400'}`}>
                {isFakeArtist ? '？？？' : gameState.theme}
              </span>
            </div>
          </div>
          {isFakeArtist ? (
            <p className="mt-6 text-rose-400 font-medium animate-pulse">※あなたはエセ芸術家です！周りに合わせましょう</p>
          ) : (
            <p className="mt-6 text-emerald-400 font-medium">※エセ芸術家にバレないように描き進めましょう</p>
          )}
          <p className="mt-8 text-sm text-slate-500 flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            まもなくゲームを開始します...
          </p>
          {submitError && <p className="mt-4 text-sm font-bold text-rose-300" role="alert">{submitError}</p>}
        </div>
      </div>
    );
  }

  // お題が未決定の場合の表示（自動モードならローディング、手動モードなら入力フォームorローディング）
  if (ruleSettings.autoThemeSelection) {
    return (
      <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600 flex flex-col items-center">
        <h3 className="text-2xl font-bold mb-6 text-indigo-400">お題決定（自動）</h3>
        <div className="text-center py-12">
          <p className="text-xl text-slate-300 mb-4">お題を準備中です...</p>
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-6 text-indigo-400">お題決定</h3>
      
      {isQuestioner ? (
        <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
          <p className="text-slate-300">あなたは出題者です。今回の「ジャンル」と「お題」を決めてください。</p>
          
          <div className="flex flex-col text-left">
            <label className="text-sm font-medium text-slate-400 mb-2">ジャンル（全員に公開されます）</label>
            <input
              type="text"
              value={inputGenre}
              onChange={(e) => setInputGenre(e.target.value)}
              placeholder="例: 動物"
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>
          
          <div className="flex flex-col text-left">
            <label className="text-sm font-medium text-slate-400 mb-2">お題（エセ芸術家には秘密になります）</label>
            <input
              type="text"
              value={inputTheme}
              onChange={(e) => setInputTheme(e.target.value)}
              placeholder="例: ライオン"
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={!inputGenre.trim() || !inputTheme.trim() || isSubmitting}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
          >
            {isSubmitting ? '決定中...' : 'お題を決定する'}
          </button>
          {submitError && <p className="text-sm font-bold text-rose-300" role="alert">{submitError}</p>}
        </form>
      ) : (
        <div className="text-center py-8">
          <p className="text-xl text-slate-300 mb-4">出題者がお題を考え中です...</p>
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
