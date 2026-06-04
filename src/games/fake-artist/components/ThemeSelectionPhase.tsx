'use client';

import { useState, useEffect } from 'react';
import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';
import { getRandomTheme } from '../hooks/useFakeArtistGame';

interface ThemeSelectionPhaseProps {
  players: Player[];
  gameState: FakeArtistGameState;
  myUserId: string | null;
  isHost: boolean;
  onThemeSubmit: (themeGenre: string, theme: string) => Promise<void>;
}

export function ThemeSelectionPhase({ players, gameState, myUserId, isHost, onThemeSubmit }: ThemeSelectionPhaseProps) {
  const { ruleSettings, playerStates } = gameState;
  const myRole = playerStates[myUserId || '']?.role;
  const isQuestioner = myRole === 'questioner';
  const isFakeArtist = myRole === 'fake_artist';

  const [inputGenre, setInputGenre] = useState('');
  const [inputTheme, setInputTheme] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [autoSelected, setAutoSelected] = useState<{genre: string, theme: string} | null>(null);

  // 自動テーマ選択ロジック
  useEffect(() => {
    if (ruleSettings.autoThemeSelection && isHost) {
      const picked = getRandomTheme();
      setAutoSelected(picked);
      
      const timer = setTimeout(() => {
        onThemeSubmit(picked.genre, picked.theme);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [ruleSettings.autoThemeSelection, isHost, onThemeSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputGenre.trim() || !inputTheme.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    await onThemeSubmit(inputGenre, inputTheme);
  };

  if (ruleSettings.autoThemeSelection) {
    return (
      <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600 flex flex-col items-center">
        <h3 className="text-2xl font-bold mb-6 text-indigo-400">お題決定（自動）</h3>
        {isHost && autoSelected ? (
          <div className="text-center animate-fade-in">
            <p className="text-lg text-slate-300 mb-4">お題が選ばれました！5秒後にゲームを開始します...</p>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 shadow-inner">
              <div className="mb-4">
                <span className="text-sm text-slate-400 block mb-1">ジャンル</span>
                <span className="text-2xl font-bold text-white">{autoSelected.genre}</span>
              </div>
              <div>
                <span className="text-sm text-slate-400 block mb-1">お題</span>
                <span className={`text-2xl font-bold ${isFakeArtist ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isFakeArtist ? '???' : autoSelected.theme}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xl text-slate-300 mb-4">ホストがお題を自動選択中です...</p>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 手動テーマ選択（出題者）
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
