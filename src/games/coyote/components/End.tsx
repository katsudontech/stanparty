'use client';

import { useMemo } from "react";
import type { Player } from "@/games/core/types";
import { Avatar } from "@/components/shared/Avatar";

type EndProps = {
    playerId: string;
    isHost: boolean;
    winnerId?: string;
    players: Player[];
    onBackToLobby: () => Promise<void> | void;
};

export function End({ playerId, isHost, winnerId, players, onBackToLobby }: EndProps) {
    const isWinner = playerId === winnerId;
    const winner = players.find(p => p.userId === winnerId);

    const title = useMemo(() => {
        if (isWinner) return "勝利！";
        return "ゲーム終了";
    }, [isWinner]);

    return (
        <div className="mx-auto mt-8 w-full max-w-md select-none">
            <h1 className={"mb-4 text-center text-4xl font-black tracking-[-.05em] " + (isWinner ? "text-[var(--green)]" : "text-[var(--ink)]")}>
                {title}
            </h1>

            <div className="paper-card w-full p-6 text-center">
                <div className="mb-2 flex items-center justify-center gap-3 text-xl font-black">
                    <span>勝者:</span>
                    {winner && <Avatar avatarUrl={winner.avatarUrl} name={winner.name} color={winner.color} size="md" decorative />}
                    <span className="text-[#a96f0d]">{winnerId === playerId ? "あなた" : (winner?.name || winnerId)}</span>
                </div>
                {!isWinner && <p className="mb-6 font-bold text-[var(--muted)]">次は勝てる！</p>}

                {isHost ? (
                    <button
                        onClick={onBackToLobby}
                        className="button-primary w-full text-lg"
                    >
                        ロビーに戻る
                    </button>
                ) : (
                    <div className="mt-2 border-2 border-dashed border-[#b9b5a8] bg-[var(--paper-deep)] p-3 text-center text-[var(--muted)]">
                        ホストがロビーに戻るのを待っています...
                    </div>
                )}
            </div>
        </div>
    );
}
