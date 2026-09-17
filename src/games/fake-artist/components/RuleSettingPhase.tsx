'use client';

import { PendingButton } from '@/components/shared/PendingButton';
import { useActionLock } from '@/hooks/useActionLock';

import { useState } from 'react';
import type { RuleSettings } from '@/games/fake-artist/types';

interface RuleSettingPhaseProps {
  ruleSettings: RuleSettings;
  onSaveRules: (rules: RuleSettings) => Promise<void>;
  onChangeRules: (rules: RuleSettings) => Promise<void>;
  isHost: boolean;
  onBackToLobby: () => Promise<void>;
}

export function RuleSettingPhase({ ruleSettings: propRuleSettings, onSaveRules, onChangeRules, isHost, onBackToLobby }: RuleSettingPhaseProps) {
  const [hostRuleSettings, setRuleSettings] = useState<RuleSettings>(propRuleSettings);
  const { pending: isSaving, acquire: acquireIsSaving, release: releaseIsSaving } = useActionLock();
  const [saveError, setSaveError] = useState<string | null>(null);
  const ruleSettings = isHost ? hostRuleSettings : propRuleSettings;

  const persistRuleSettings = async (newSettings: RuleSettings) => {
    if (!acquireIsSaving()) return;
    setRuleSettings(newSettings);
    setSaveError(null);
    try { await onChangeRules(newSettings); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'ルールを保存できませんでした'); }
    finally { releaseIsSaving(); }
  };

  const handleRoundLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || isSaving) return;
    const newSettings = { ...ruleSettings, roundLimit: Number(e.target.value) };
    void persistRuleSettings(newSettings);
  };

  const handleAutoThemeSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || isSaving) return;
    const newSettings = { ...ruleSettings, autoThemeSelection: e.target.checked };
    void persistRuleSettings(newSettings);
  };

  const handleQuestionerDrawsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || isSaving) return;
    const newSettings = { ...ruleSettings, questionerDraws: e.target.checked };
    void persistRuleSettings(newSettings);
  };

  const handleSaveRules = async (action = () => onSaveRules(ruleSettings)) => {
    if (!isHost || isSaving) return;

    if (!acquireIsSaving()) return;
    setSaveError(null);
    try {
      await action();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'ゲームを開始できませんでした');
    } finally {
      releaseIsSaving();
    }
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
              disabled={!isHost || isSaving}
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
              disabled={!isHost || isSaving}
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
                disabled={!isHost || isSaving}
                className={`form-checkbox h-5 w-5 text-blue-600 bg-slate-800 border-slate-600 rounded ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <span className="text-slate-300">出題者も絵を描く</span>
            </label>
          </div>
        )}
      </div>

      {saveError && <p className="mt-4 rounded-lg border border-rose-500 bg-rose-950/60 p-3 text-sm font-bold text-rose-200" role="alert">{saveError}</p>}

      {isHost ? (
        <div className="mt-6 space-y-3">
          <PendingButton busy={isSaving}
            onClick={() => void handleSaveRules()}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full"
          >
            ルールを確定してゲーム開始
          </PendingButton>
          <PendingButton busy={isSaving}
            type="button"
            onClick={() => void handleSaveRules(onBackToLobby)}
            disabled={isSaving}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-6 py-2 font-bold text-slate-200 transition-colors hover:bg-slate-700"
          >
            ロビーへ戻る
          </PendingButton>
        </div>
      ) : (
        <div className="mt-6 text-slate-300 bg-slate-800 p-4 rounded-lg text-center">
          ホストがルールを設定中です...
        </div>
      )}
    </div>

  );
}
