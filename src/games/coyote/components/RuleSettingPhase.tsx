'use client';

import { useState } from "react";
import type { Player } from "@/games/core/types";

interface RuleSettingPhaseProps {
    players: Player[];
    isHost: boolean;
    onStartGame: (maxHp: number) => void;
    initialMaxHp: number;
    onBackToLobby: () => Promise<void>;
}

export function RuleSettingPhase({ players, isHost, onStartGame, initialMaxHp, onBackToLobby }: RuleSettingPhaseProps) {
    const [maxHp, setMaxHp] = useState(initialMaxHp);

    return (
        <div className="mx-auto w-full max-w-md mt-4 select-none">
            <h1 className="text-3xl font-black tracking-tight text-white mb-6 text-center">ルーム設定</h1>
            
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl backdrop-blur">
                <h2 className="text-lg mb-4 font-bold border-b border-slate-700 pb-2 text-slate-200">
                    参加プレイヤー ({players.length}人)
                </h2>
                <ul className="space-y-3 text-left mb-8">
                    {players.map((p) => (
                        <li key={p.userId} className="p-3 rounded-xl flex justify-between items-center bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: p.color }}>
                                    {p.name.charAt(0)}
                                </div>
                                <span className="font-bold text-slate-200">{p.name}</span>
                            </div>
                            {p.isHost && (
                                <span className="text-[10px] px-2 py-1 rounded-md font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    ホスト
                                </span>
                            )}
                        </li>
                    ))}
                </ul>

                <h2 className="text-lg mb-4 font-bold border-b border-slate-700 pb-2 text-slate-200">ゲーム設定</h2>
                
                <div className="flex items-center justify-between gap-3 mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <label htmlFor="max-hp" className="text-slate-300 font-bold">
                        最大ライフ (HP)
                    </label>
                    <input
                        id="max-hp"
                        type="number"
                        min={1}
                        max={99}
                        value={maxHp}
                        onChange={(e) => {
                            const v = Number(e.target.value);
                            setMaxHp(Number.isFinite(v) && v > 0 ? v : 3);
                        }}
                        className="w-24 text-center rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 font-bold"
                        disabled={!isHost}
                    />
                </div>

                {isHost ? (
                    <div className="space-y-3">
                        <button
                            onClick={() => onStartGame(maxHp)}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 transition text-white py-4 px-4 rounded-xl font-bold shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            設定を完了して開始
                        </button>
                        <button
                            type="button"
                            onClick={() => void onBackToLobby()}
                            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-bold text-slate-200 transition hover:bg-slate-700"
                        >
                            ロビーへ戻る
                        </button>
                    </div>
                ) : (
                    <div className="text-center text-slate-400 font-bold p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        ホストがルールを設定しています...
                    </div>
                )}
            </div>
        </div>
    );
}
