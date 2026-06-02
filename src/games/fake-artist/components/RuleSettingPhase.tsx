'use client';

import { useState } from 'react';
import type { Player } from '@/games/core/types';
import type { RuleSettings } from '@/games/fake-artist/types';

interface RuleSettingPhaseProps {
  players: Player[];
  initialRuleSettings: RuleSettings;
  onSaveRules: (rules: RuleSettings) => void;
}

export function RuleSettingPhase({ players, initialRuleSettings, onSaveRules }: RuleSettingPhaseProps) {
  const [ruleSettings, setRuleSettings] = useState<RuleSettings>(initialRuleSettings);

  const handleRoundLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRuleSettings({ ...ruleSettings, roundLimit: Number(e.target.value) });
  };

  const handleAutoThemeSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRuleSettings({ ...ruleSettings, autoThemeSelection: e.target.checked });
  };

  const handleShowFakeThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRuleSettings({ ...ruleSettings, showFakeTheme: e.target.checked });
  };

  const handleSaveRules = () => {
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
              className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 w-24"
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
              className="form-checkbox h-5 w-5 text-blue-600 bg-slate-800 border-slate-600 rounded"
            />
            <span className="text-slate-300">自動お題選択</span>
          </label>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ruleSettings.showFakeTheme}
              onChange={handleShowFakeThemeChange}
              className="form-checkbox h-5 w-5 text-blue-600 bg-slate-800 border-slate-600 rounded"
            />
            <span className="text-slate-300">エセ芸術家には偽のお題を表示する</span>
          </label>
        </div>
      </div>

      <button
        onClick={handleSaveRules}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        ルールを確定してゲーム開始
      </button>
    </div>

  );
}
