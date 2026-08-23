'use client';

import { useState } from "react";
import type { Player } from "@/games/core/types";
import { Avatar } from "@/components/shared/Avatar";

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
        <div className="mx-auto mt-4 w-full max-w-md select-none">
            <p className="text-center text-xs font-black tracking-[.14em] text-[#a96f0d]">COYOTE · GAME SETTING</p>
            <h1 className="mb-6 mt-2 text-center text-3xl font-black tracking-[-.05em]">ルール設定</h1>
            
            <div className="paper-card p-6">
                <h2 className="mb-4 border-b-2 border-[var(--line)] pb-2 text-lg font-black">
                    参加プレイヤー ({players.length}人)
                </h2>
                <ul className="space-y-3 text-left mb-8">
                    {players.map((p) => (
                        <li key={p.userId} className="flex items-center justify-between border-b border-[#c8c6b9] p-3 last:border-0">
                            <div className="flex items-center gap-3">
                                <Avatar avatarUrl={p.avatarUrl} name={p.name} color={p.color} size="sm" decorative />
                                <span className="font-black">{p.name}</span>
                            </div>
                            {p.isHost && (
                                <span className="border border-[var(--line)] bg-[var(--yellow)] px-2 py-1 text-[10px] font-black">
                                    ホスト
                                </span>
                            )}
                        </li>
                    ))}
                </ul>

                <h2 className="mb-4 border-b-2 border-[var(--line)] pb-2 text-lg font-black">ゲーム設定</h2>
                
                <div className="mb-6 flex items-center justify-between gap-3 border-2 border-[var(--line)] bg-[var(--paper-deep)] p-4">
                    <label htmlFor="max-hp" className="font-black">
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
                        className="w-24 border-2 border-[var(--line)] bg-white px-3 py-2 text-center font-black outline-none focus:ring-2 focus:ring-[var(--yellow)] disabled:opacity-50"
                        disabled={!isHost}
                    />
                </div>

                {isHost ? (
                    <div className="space-y-3">
                        <button
                            onClick={() => onStartGame(maxHp)}
                            className="button-primary w-full"
                        >
                            設定を完了して開始
                        </button>
                        <button
                            type="button"
                            onClick={() => void onBackToLobby()}
                            className="button-secondary w-full"
                        >
                            ロビーへ戻る
                        </button>
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-[#b9b5a8] bg-[var(--paper-deep)] p-4 text-center font-bold text-[var(--muted)]">
                        ホストがルールを設定しています...
                    </div>
                )}
            </div>
        </div>
    );
}
