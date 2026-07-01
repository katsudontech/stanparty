'use client';

import { useMemo } from "react";
import type { Player } from "@/games/core/types";

type EndProps = {
    playerId: string;
    isHost: boolean;
    winnerId?: string;
    players: Player[];
    onBackToLobby: () => Promise<void> | void;
};

export function End({ playerId, isHost, winnerId, players, onBackToLobby }: EndProps) {
    const isWinner = playerId === winnerId;
    const winnerName = players.find(p => p.userId === winnerId)?.name;

    const title = useMemo(() => {
        if (isWinner) return "勝利！";
        return "ゲーム終了";
    }, [isWinner]);

    return (
        <div className="mx-auto w-full max-w-md select-none mt-8">
            <h1 className={"text-4xl font-black mb-4 text-center " + (isWinner ? "text-emerald-500" : "text-white")}>
                {title}
            </h1>

            <div className="bg-slate-900/80 p-6 rounded-2xl shadow-xl w-full border border-slate-700 text-center backdrop-blur">
                <p className="text-slate-300 mb-2 font-bold text-xl">
                    勝者: <span className="text-indigo-400">{winnerId === playerId ? "あなた" : (winnerName || winnerId)}</span>
                </p>
                {!isWinner && <p className="text-slate-500 mb-6 font-bold">次は勝てる！</p>}

                {isHost ? (
                    <button
                        onClick={onBackToLobby}
                        className="w-full py-3 rounded-xl font-bold text-lg transition bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]"
                    >
                        ロビーに戻る
                    </button>
                ) : (
                    <div className="text-center text-slate-400 mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        ホストがロビーに戻るのを待っています...
                    </div>
                )}
            </div>
        </div>
    );
}
