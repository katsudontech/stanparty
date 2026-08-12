'use client';

import { useState } from "react";
import type { OneNightRuleSettings } from "../types";



interface RuleSettingPhaseProps {
    ruleSettings: OneNightRuleSettings;
    onSaveRules: (rules: OneNightRuleSettings) => void;
    onChangeRules: (rules: OneNightRuleSettings) => void;
    isHost: boolean;
}

export function RuleSettingPhase({ ruleSettings: propRuleSettings, onSaveRules, onChangeRules, isHost }: RuleSettingPhaseProps) {

    const [hostRuleSettings, setRuleSettings] = useState<OneNightRuleSettings>(propRuleSettings);
    const ruleSettings = isHost ? hostRuleSettings : propRuleSettings;

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isHost) return;
        const newSettings = { ...ruleSettings, timeLimit: Number(e.target.value) };
        setRuleSettings(newSettings);
        onChangeRules(newSettings);
    };

    return (
        <div className="max-w-3xl mx-auto w-full">
            <div className="text-white mt-8 bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-600 shadow-xl">
                <div className="border-b border-slate-600 pb-4 mb-6">
                    <h3 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        ゲーム設定
                    </h3>
                    <p className="text-slate-400 mt-2">
                        ホストがゲームのルールを設定します。設定が完了したらゲームを開始してください。
                    </p>
                </div>

                <div className="space-y-8">
                    {/* 議論時間設定 */}
                    <div className="bg-slate-700/30 p-6 rounded-xl border border-slate-600/50">
                        <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="text-blue-400">⏱</span> 議論時間
                        </h4>
                        <div className="flex items-center gap-4">
                            <input 
                                type="number" 
                                disabled={!isHost}
                                value={ruleSettings.timeLimit} 
                                onChange={handleTimeChange}
                                className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-xl w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                min={30}
                                step={30}
                            />
                            <span className="text-slate-300 font-medium">秒</span>
                        </div>
                    </div>

                    {/* 役職設定（仮） */}
                    <div className="bg-slate-700/30 p-6 rounded-xl border border-slate-600/50">
                        <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="text-purple-400">🎭</span> 役職設定（開発中）
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {['人狼', '占い師', '怪盗', '市民', '市民'].map((roleName, i) => (
                                <div key={i} className="bg-slate-800 border border-slate-600 p-4 rounded-xl flex flex-col items-center justify-center opacity-60 cursor-not-allowed hover:bg-slate-700 transition-colors">
                                    <div className="w-12 h-12 bg-slate-700 rounded-full mb-3 flex items-center justify-center text-xl shadow-inner">
                                        {roleName === '人狼' ? '🐺' : roleName === '占い師' ? '🔮' : roleName === '怪盗' ? '🦹' : '🧑'}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-200">{roleName}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-slate-400 mt-4 text-center">※役職の変更機能は現在準備中です。このままの構成でプレイできます。</p>
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="mt-10 flex justify-center">
                    <button 
                        onClick={() => onSaveRules(ruleSettings)}
                        disabled={!isHost}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-12 rounded-full transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:shadow-none disabled:transform-none text-lg"
                    >
                        {isHost ? 'ゲームを開始する' : 'ホストの設定待ち...'}
                    </button>
                </div>
            </div>
        </div>
    );
}