'use client';

import { useEffect, useState } from "react";
import type { RoomState } from '@/games/core/types';
import { type CoyoteGameState, DEFAULT_COYOTE_STATE } from './types';
import { useCoyoteGame } from './hooks/useCoyoteGame';
import { Dead } from './components/Dead';
import { End } from './components/End';
import { RuleSettingPhase } from './components/RuleSettingPhase';
import { Avatar } from '@/components/shared/Avatar';

interface CoyoteGameProps {
    roomState: RoomState;
    myUserId: string | null;
    onBackToLobby: () => Promise<void>;
}

const formatCardForCoyoteResult = (card: string | null, questionRevealedCard?: string | null): string => {
    if (!card) return "-";
    if (card === "double") return "×2";
    if (card === "question") {
        return questionRevealedCard ? `？→${formatCardForCoyoteResult(questionRevealedCard)}` : "？";
    }
    return card;
};

export function CoyoteGame({ roomState, myUserId, onBackToLobby }: CoyoteGameProps) {
    const rawState = roomState.game_state as Partial<CoyoteGameState> | null;
    const gameState: CoyoteGameState = {
        ...DEFAULT_COYOTE_STATE,
        ...(rawState || {})
    } as CoyoteGameState;

    const { startGame, handleCoyote, handleNextGame } = useCoyoteGame(roomState);

    const players = roomState.players;
    const isHost = Boolean(myUserId && roomState.host_id === myUserId);

    const myCoyoteState = myUserId ? gameState.coyotePlayers[myUserId] : undefined;
    const isDead = myCoyoteState ? myCoyoteState.hp <= 0 : false;
    const myCard = myCoyoteState?.currentCard || "";

    const [countdown, setCountdown] = useState<number | null>(null);
    const [showCard, setShowCard] = useState(false);
    const [isSubmittedCoyote, setIsSubmittedCoyote] = useState(false);
    const [isSubmittedNextGame, setIsSubmittedNextGame] = useState(false);
    const [selectedLoser, setSelectedLoser] = useState<string>("");

    // WakeLock
    useEffect(() => {
        const shouldWakeLock = !isDead && (gameState.phase === "playing" || gameState.phase === "coyote_called");
        type WakeLockSentinelLike = { release?: () => Promise<void> | void };
        type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };
        const nav = navigator as Navigator & { wakeLock?: WakeLockLike };

        if (!shouldWakeLock || !nav.wakeLock) return;

        let sentinel: WakeLockSentinelLike | null = null;
        const request = async () => {
            try { sentinel = await nav.wakeLock!.request("screen"); } catch {}
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") request();
        };

        request();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            try { void sentinel?.release?.(); } catch {}
        };
    }, [isDead, gameState.phase]);

    // Card change detection for countdown
    useEffect(() => {
        if (isDead || !myCard) return;
        const timer = setTimeout(() => {
            setShowCard(false);
            setCountdown(5);
        }, 0);
        return () => clearTimeout(timer);
    }, [myCard, isDead]);

    // Countdown timer
    useEffect(() => {
        if (isDead || countdown === null) return;
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => {
                setShowCard(true);
                setCountdown(null);
                setIsSubmittedCoyote(false); // Reset submit state for new turn
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [countdown, isDead]);

    const handleDoubleClick = async () => {
        if (isDead || isSubmittedCoyote || !showCard || gameState.phase === 'coyote_called' || !myUserId) return;
        setIsSubmittedCoyote(true);
        try {
            await handleCoyote(myUserId);
        } catch (error) {
            console.error(error);
            setIsSubmittedCoyote(false);
        }
    };

    const onSelectLoser = async () => {
        if (isDead || !selectedLoser || isSubmittedNextGame) return;
        setIsSubmittedNextGame(true);
        try {
            await handleNextGame(selectedLoser);
            setSelectedLoser("");
            setIsSubmittedNextGame(false);
        } catch (error) {
            console.error(error);
            setIsSubmittedNextGame(false);
        }
    };

    // Render logic
    if (gameState.phase === 'rule_setting') {
        return (
            <RuleSettingPhase
                players={players}
                isHost={isHost}
                onStartGame={(maxHp: number) => { startGame(maxHp); }}
                initialMaxHp={gameState.ruleSettings?.maxHp || 3}
                onBackToLobby={onBackToLobby}
            />
        );
    }

    if (gameState.phase === 'result') {
        return (
            <End
                playerId={myUserId || ""}
                isHost={isHost}
                winnerId={gameState.winnerId}
                players={players}
                onBackToLobby={onBackToLobby}
            />
        );
    }

    if (isDead) {
        return <Dead hp={myCoyoteState?.hp ?? 0} />;
    }

    if (gameState.phase === 'coyote_called') {
        const isCoyoteCaller = myUserId === gameState.coyoteCallerId;
        const canDecideLoser = Boolean(selectedLoser) && !isSubmittedNextGame;

        const activePlayers = players.filter(p => (gameState.coyotePlayers[p.userId]?.hp ?? 0) > 0 || gameState.coyoteCallerId === p.userId);

        return (
            <div className="mx-auto mt-4 w-full max-w-2xl select-none">
                <p className="text-center text-xs font-black tracking-[.16em] text-[var(--orange)]">CALL!</p>
                <h1 className="mb-6 mt-2 text-center text-5xl font-black tracking-[-.06em] text-[var(--ink)]">コヨーテ！</h1>

                <div className="paper-card w-full p-5 sm:p-6">
                    <div className="flex flex-row justify-center gap-12 mb-8">
                        <div>
                            <h2 className="mb-2 text-center text-sm font-bold text-[var(--muted)]">全員の合計</h2>
                            <div className="text-center text-7xl font-black">
                                {gameState.coyoteTotalValue !== undefined ? gameState.coyoteTotalValue : "-"}
                            </div>
                        </div>
                        <div>
                            <h2 className="mb-2 text-center text-sm font-bold text-[var(--muted)]">自分のカード</h2>
                            <div className="text-center text-7xl font-black">
                                {formatCardForCoyoteResult(myCard, gameState.questionRevealedCard)}
                            </div>
                        </div>
                    </div>

                    <h3 className="mb-4 border-b-2 border-[var(--line)] pb-2 text-lg font-black">生存プレイヤー一覧</h3>
                    <div className="flex flex-col gap-3 mb-6">
                        {activePlayers.map(p => {
                            const pState = gameState.coyotePlayers[p.userId];
                            const hp = pState?.hp ?? 0;
                            const isAlive = hp > 0;
                            return (
                                <label
                                    key={p.userId}
                                    className={
                                        "flex items-center p-4 rounded-xl border transition " +
                                        (isCoyoteCaller && isAlive ? "cursor-pointer hover:bg-[var(--paper-deep)] " : "cursor-default ") +
                                        (selectedLoser === p.userId
                                            ? "bg-[#f6d7c8] border-[var(--orange)]"
                                            : "bg-white border-[#b9b5a8]")
                                    }
                                >
                                    <input
                                        type="radio"
                                        name="loser"
                                        value={p.userId}
                                        checked={selectedLoser === p.userId}
                                        onChange={(e) => isCoyoteCaller && isAlive && setSelectedLoser(e.target.value)}
                                        disabled={!isCoyoteCaller || !isAlive}
                                        className="hidden"
                                    />
                                    <div className="flex-1 flex justify-between items-center">
                                        <div className="flex min-w-0 items-center gap-2 font-black">
                                                <Avatar avatarUrl={p.avatarUrl} name={p.name} color={p.color} size="sm" decorative />
                                                <span className="truncate">{p.name}</span>
                                                {p.userId === myUserId && <span className="text-xs font-bold text-[var(--green)]">(あなた)</span>}
                                                {p.userId === gameState.coyoteCallerId && <span className="text-xs font-bold text-[var(--orange)]">(宣言者)</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="border border-[var(--line)] bg-[var(--paper-deep)] px-3 py-1.5 text-xs font-bold">
                                                HP: {hp}
                                            </span>
                                            <span className="border border-[var(--line)] bg-[var(--paper-deep)] px-3 py-1.5 text-xs font-bold">
                                                {formatCardForCoyoteResult(pState?.currentCard, gameState.questionRevealedCard)}
                                            </span>
                                        </div>
                                    </div>
                                </label>
                            )
                        })}
                    </div>

                    {isCoyoteCaller ? (
                        <button
                            onClick={onSelectLoser}
                            disabled={!canDecideLoser}
                            className={
                                "w-full py-4 rounded-xl font-bold text-lg transition focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
                                (canDecideLoser
                                    ? "bg-[var(--orange)] hover:bg-[#d94f33] text-white border-2 border-[var(--line)] shadow-[4px_4px_0_var(--line)]"
                                    : "bg-[var(--paper-deep)] text-[var(--muted)] cursor-not-allowed border-2 border-[#b9b5a8]")
                            }
                        >
                            敗者を決定する
                        </button>
                    ) : (
                        <div className="mt-4 border-2 border-dashed border-[#b9b5a8] bg-[var(--paper-deep)] p-4 text-center font-bold text-[var(--muted)]">
                            コヨーテ宣言者が敗者を決定しています...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div 
            className="coyote-playfield flex min-h-[72vh] flex-col items-center justify-center border-2 border-[var(--line)] bg-[var(--ink)] p-4 text-white shadow-[5px_5px_0_#d79a24] select-none"
            onDoubleClick={handleDoubleClick}
        >
            <h1 className="mb-2 text-2xl font-black tracking-[-.04em] text-white">Coyote</h1>
            
            {/* カウントダウン表示 */}
            {countdown !== null && countdown > 0 && (
                <div className="text-center animate-[fadeIn_0.5s_ease-out]">
                    <p className="mb-8 mt-8 text-lg font-bold text-[#f2dfa8]">他の人に見えるように、おでこにスマホを掲げて！</p>
                    <p className="text-[12rem] font-black text-white">{countdown}</p>
                </div>
            )}

            {/* 5秒経過後にドーンと数字を表示 */}
            {showCard && (
                <div className="text-center animate-[popIn_0.3s_ease-out]">
                    <p className="mb-4 mt-4 text-sm font-bold uppercase tracking-widest text-[#d7d0c0]">あなたのおでこの数字</p>
                    <div className="relative flex h-96 w-72 items-center justify-center overflow-hidden border-[12px] border-[#d79a24] bg-[#fffaf0] shadow-[8px_8px_0_#d79a24]">
                        <span className="relative z-10 text-[10rem] font-black text-[var(--ink)]">
                            {formatCardForCoyoteResult(myCard)}
                        </span>
                    </div>
                    <div className="mt-8 inline-block border-2 border-[#d79a24] bg-[#f2dfa8] px-6 py-3 text-[var(--ink)]">
                        <p className="flex items-center gap-2 text-sm font-black">
                            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            画面をダブルタップでコヨーテ宣言！
                        </p>
                    </div>
                </div>
            )}

            {!showCard && countdown === null && (
                <div className="mt-16 flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d79a24] border-t-transparent" />
                    <p className="font-bold text-[#d7d0c0]">カードの配布を待っています…</p>
                </div>
            )}
        </div>
    );
}
