'use client';

import { useState } from 'react';
import type { RuleSettings } from '@/games/fake-artist/types';

interface RuleSettingPhaseProps {
  ruleSettings: RuleSettings;
  onSaveRules: (rules: RuleSettings) => void;
  onChangeRules: (rules: RuleSettings) => void;
  isHost: boolean;
  onBackToLobby: () => Promise<void>;
}

export function RuleSettingPhase({ ruleSettings: propRuleSettings, onSaveRules, onChangeRules, isHost, onBackToLobby }: RuleSettingPhaseProps) {
  const [hostRuleSettings, setRuleSettings] = useState<RuleSettings>(propRuleSettings);
  const ruleSettings = isHost ? hostRuleSettings : propRuleSettings;

  const handleRoundLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return;
    const newSettings = { ...ruleSettings, roundLimit: Number(e.target.value) };
    setRuleSettings(newSettings);
    onChangeRules(newSettings);
  };

  const handleAutoThemeSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return;
    const newSettings = { ...ruleSettings, autoThemeSelection: e.target.checked };
    setRuleSettings(newSettings);
    onChangeRules(newSettings);
  };

  const handleQuestionerDrawsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return;
    const newSettings = { ...ruleSettings, questionerDraws: e.target.checked };
    setRuleSettings(newSettings);
    onChangeRules(newSettings);
  };

  const handleSaveRules = () => {
    if (!isHost) return;
    onSaveRules(ruleSettings);
  };

  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">ルール設定</h3>
      <p className="text-slate-400">ホストがゲームのルール（お題のジャンルなど）を設定する画面です。</p>

      <div className="mt-6">
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="number"
              min="1"
              max="10"
              value={ruleSettings.roundLimit}
              onChange={handleRoundLimitChange}
              disabled={!isHost}
              className={`bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 w-24 ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <span className="text-slate-300">回答ラウンド数</span>
          </label>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ruleSettings.autoThemeSelection}
              onChange={handleAutoThemeSelectionChange}
              disabled={!isHost}
              className={`form-checkbox h-5 w-5 text-blue-600 bg-slate-800 border-slate-600 rounded ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <span className="text-slate-300">自動お題選択</span>
          </label>
        </div>

        {!ruleSettings.autoThemeSelection && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ruleSettings.questionerDraws}
                onChange={handleQuestionerDrawsChange}
                disabled={!isHost}
                className={`form-checkbox h-5 w-5 text-blue-600 bg-slate-800 border-slate-600 rounded ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <span className="text-slate-300">出題者も絵を描く</span>
            </label>
          </div>
        )}
      </div>

      {isHost ? (
        <div className="mt-6 space-y-3">
          <button
            onClick={handleSaveRules}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full"
          >
            ルールを確定してゲーム開始
          </button>
          <button
            type="button"
            onClick={() => void onBackToLobby()}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-6 py-2 font-bold text-slate-200 transition-colors hover:bg-slate-700"
          >
            ロビーへ戻る
          </button>
        </div>
      ) : (
        <div className="mt-6 text-slate-300 bg-slate-800 p-4 rounded-lg text-center">
          ホストがルールを設定中です...
        </div>
      )}
    </div>

  );
}
