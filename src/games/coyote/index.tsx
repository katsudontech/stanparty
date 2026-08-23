'use client';

import { useEffect, useState } from "react";
import type { RoomState } from '@/games/core/types';
import { type CoyoteGameState, DEFAULT_COYOTE_STATE } from './types';
import { useCoyoteGame } from './hooks/useCoyoteGame';
import { Dead } from './components/Dead';
import { End } from './components/End';
import { RuleSettingPhase } from './components/RuleSettingPhase';

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
            <div className="mx-auto w-full max-w-2xl select-none mt-4">
                <h1 className="text-4xl font-black text-red-500 mb-6 text-center animate-bounce">コヨーテ！</h1>

                <div className="bg-slate-900/80 p-6 rounded-2xl shadow-xl w-full border border-slate-700 backdrop-blur">
                    <div className="flex flex-row justify-center gap-12 mb-8">
                        <div>
                            <h2 className="text-sm font-bold text-slate-400 mb-2 text-center">全員の合計</h2>
                            <div className="text-7xl font-black text-center text-white drop-shadow-md">
                                {gameState.coyoteTotalValue !== undefined ? gameState.coyoteTotalValue : "-"}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-400 mb-2 text-center">自分のカード</h2>
                            <div className="text-7xl font-black text-center text-white drop-shadow-md">
                                {formatCardForCoyoteResult(myCard, gameState.questionRevealedCard)}
                            </div>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-700 pb-2">生存プレイヤー一覧</h3>
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
                                        (isCoyoteCaller && isAlive ? "cursor-pointer hover:bg-slate-800 " : "cursor-default ") +
                                        (selectedLoser === p.userId
                                            ? "bg-red-500/20 border-red-500/50"
                                            : "bg-slate-800/50 border-slate-700")
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
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-slate-200 truncate flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{ backgroundColor: p.color }}>
                                                    {p.name.charAt(0)}
                                                </div>
                                                {p.name}
                                                {p.userId === myUserId && <span className="text-xs text-emerald-400 font-bold">(あなた)</span>}
                                                {p.userId === gameState.coyoteCallerId && <span className="text-xs text-red-400 font-bold">(宣言者)</span>}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-300 font-bold text-xs bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-700">
                                                HP: {hp}
                                            </span>
                                            <span className="text-slate-300 font-bold text-xs bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-700">
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
                                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]"
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed")
                            }
                        >
                            敗者を決定する
                        </button>
                    ) : (
                        <div className="text-center text-slate-400 font-bold mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                            コヨーテ宣言者が敗者を決定しています...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div 
            className="p-4 flex flex-col items-center justify-center min-h-[70vh] select-none"
            onDoubleClick={handleDoubleClick}
        >
            <h1 className="text-2xl font-black text-white mb-2">コヨーテ</h1>
            
            {/* カウントダウン表示 */}
            {countdown !== null && countdown > 0 && (
                <div className="text-center animate-[fadeIn_0.5s_ease-out]">
                    <p className="text-lg font-bold text-indigo-300 mt-8 mb-8">他の人に見えるように、おでこにスマホを掲げて！</p>
                    <p className="text-[12rem] font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">{countdown}</p>
                </div>
            )}

            {/* 5秒経過後にドーンと数字を表示 */}
            {showCard && (
                <div className="text-center animate-[popIn_0.3s_ease-out]">
                    <p className="text-sm font-bold text-slate-400 mt-4 mb-4 uppercase tracking-widest">あなたのおでこの数字</p>
                    <div className="bg-slate-900 border-[12px] border-indigo-500/30 rounded-[3rem] w-72 h-96 flex items-center justify-center shadow-[0_0_50px_-10px_rgba(79,70,229,0.5)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 pointer-events-none"></div>
                        <span className="text-[10rem] font-black text-white drop-shadow-lg relative z-10">
                            {formatCardForCoyoteResult(myCard)}
                        </span>
                    </div>
                    <div className="mt-8 px-6 py-3 bg-indigo-500/20 border border-indigo-500/30 rounded-full inline-block backdrop-blur-md">
                        <p className="text-indigo-200 font-bold text-sm flex items-center gap-2">
                            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            画面をダブルタップでコヨーテ宣言！
                        </p>
                    </div>
                </div>
            )}

            {!showCard && countdown === null && (
                <div className="mt-16 flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold">カードの配布を待っています...</p>
                </div>
            )}
        </div>
    );
}
