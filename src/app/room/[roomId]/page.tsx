'use client';

import { use, useRef, useState, type ReactNode } from 'react';
import { useRoomSubscription } from '@/hooks/useRoomSubscription';
import { useGuestAuth } from '@/hooks/useGuestAuth';
import { useHostAutoKick } from '@/hooks/useHostAutoKick';
import { useRoomControls } from '@/hooks/useRoomControls';
import { JoinRoomScreen } from '@/components/shared/JoinRoomScreen';
import { WaitingRoom } from '@/components/shared/WaitingRoom';
import { GameWrapper } from '@/games/core/GameWrapper';
import { FakeArtistGame } from '@/games/fake-artist';
import { CoyoteGame } from '@/games/coyote';
import { OneNightWerewolfGame } from '@/games/one-night-werewolf';
import { ItoGame } from '@/games/ito';
import { AiBarenaiGame } from '@/games/ai-barenai';
import { AiBarenaiDrawingGame } from '@/games/ai-barenai-drawing';
import { PinchHintGame } from '@/games/pinch-hint';
import { RoomReactionHeaderActions, RoomReactionsProvider } from '../../../components/shared/RoomReactions';

function EndGameButton({ onEnd }: { onEnd: () => Promise<void> }) {
    const [ending, setEnding] = useState(false);
    const inFlight = useRef(false);

    const handleEnd = async () => {
        if (inFlight.current || !window.confirm('ゲームを終了して、全員を待機ルームへ戻しますか？\n参加者はそのまま残り、進行中のゲームはリセットされます。')) return;
        inFlight.current = true;
        setEnding(true);
        try {
            await onEnd();
        } catch {
            window.alert('ゲームを終了できませんでした。通信状況を確認して、もう一度お試しください。');
        } finally {
            inFlight.current = false;
            setEnding(false);
        }
    };

    return (
        <button type="button" aria-label="ゲームを終了して待機ルームへ戻る" title="ゲームを終了して待機ルームへ戻る" className="button-secondary min-h-11 shrink-0 text-sm" disabled={ending} onClick={() => void handleEnd()}>
            {ending ? '終了中…' : 'ゲームを終了'}
        </button>
    );
}

function RoomHeaderActions({ isHost, onEnd }: { isHost: boolean; onEnd?: () => Promise<void> }) {
    return <div className="room-header-actions ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {isHost && onEnd && <EndGameButton onEnd={onEnd} />}
        <RoomReactionHeaderActions />
    </div>;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const { profile, error: authError } = useGuestAuth();
    const myUserId = profile?.id ?? null;

    const {
        roomState,
        players,
        onlineUserIds,
        isPresenceSynced,
        loading,
        error,
        refreshRoom
    } = useRoomSubscription(roomId, myUserId);

    const { handleChangeGame, handleStartGame, handleBackToLobby } = useRoomControls(roomId);

    const myPlayer = roomState?.players.find((player) => player.userId === myUserId);
    const isJoined = Boolean(
        roomState && myUserId && (roomState.host_id === myUserId || myPlayer)
    );
    const isHost = Boolean(roomState && myUserId && roomState.host_id === myUserId);

    useHostAutoKick(
        roomId,
        isHost,
        roomState,
        players,
        onlineUserIds,
        isPresenceSynced,
        myUserId
    );

    if (authError) {
        return (
            <div className="site-shell mobile-page flex min-h-dvh items-center justify-center p-4">
                <div className="paper-card max-w-lg p-6" role="alert">
                    <h1 className="text-2xl font-black">接続できませんでした</h1>
                    <p className="mt-3 text-sm text-[var(--muted)]">通信状況を確認して、もう一度お試しください。</p>
                    <button type="button" className="button-primary mt-5" onClick={() => window.location.reload()}>
                        再試行する
                    </button>
                </div>
            </div>
        );
    }

    if (!myUserId || loading) {
        return <div className="site-shell mobile-page flex min-h-dvh flex-col items-center justify-center gap-4 px-4"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--paper-deep)] border-t-[var(--orange)]" /><p className="text-center font-black text-[var(--muted)]">ルームを読み込んでいます…</p></div>;
    }

    if (error) {
        return <div className="site-shell mobile-page flex min-h-dvh items-center justify-center p-4 sm:p-5"><div className="paper-card min-w-0 max-w-lg p-5 sm:p-8"><p className="section-kicker">Error</p><h1 className="mt-3 text-2xl font-black">ルームを読み込めませんでした</h1><p className="mt-3 break-words text-sm text-[var(--muted)]">{error.message}</p></div></div>;
    }

    if (!roomState || !isJoined) {
        return <JoinRoomScreen roomId={roomId} onJoined={refreshRoom} />;
    }

    const reactionUserId = myUserId;
    const withReactions = (content: ReactNode) => (
        <RoomReactionsProvider key={`${roomId}:${reactionUserId}`} roomId={roomId} myUserId={reactionUserId} players={players}>
            {content}
        </RoomReactionsProvider>
    );

    if (roomState.status === 'waiting') {
        return withReactions(
            <WaitingRoom
                roomState={roomState}
                players={players}
                onlineUserIds={onlineUserIds}
                isHost={isHost}
                onStartGame={handleStartGame}
                onChangeGame={handleChangeGame}
                headerActions={<RoomHeaderActions isHost={false} />}
            />
        );
    }

    if (roomState.status === 'playing') {
        const headerActions = <RoomHeaderActions isHost={isHost} onEnd={handleBackToLobby} />;
        if (roomState.game_type === 'fake-artist') {
            return withReactions(
                <GameWrapper headerActions={headerActions} players={players} myUserId={myUserId} showPlayerBar={false}>
                    <FakeArtistGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'coyote') {
            return withReactions(
                <GameWrapper headerActions={headerActions} players={players} myUserId={myUserId}>
                    <CoyoteGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'one-night-werewolf') {
            return withReactions(
                <GameWrapper headerActions={headerActions} players={players} myUserId={myUserId}>
                    <OneNightWerewolfGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'ito') {
            return withReactions(
                <GameWrapper headerActions={headerActions} players={players} myUserId={myUserId}>
                    <ItoGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'ai-barenai') {
            return withReactions(
                <GameWrapper headerActions={headerActions} players={players} myUserId={myUserId} showPlayerBar={false} gameClassName="ai-barenai-wrapper">
                    <AiBarenaiGame roomState={roomState} myUserId={myUserId} onBackToLobby={handleBackToLobby} />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'ai-barenai-drawing') {
            return withReactions(
                <GameWrapper headerActions={headerActions} players={players} myUserId={myUserId} showPlayerBar={false} gameClassName="ai-barenai-drawing-wrapper">
                    <AiBarenaiDrawingGame roomState={roomState} myUserId={myUserId} onBackToLobby={handleBackToLobby} />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'pinch-hint') {
            return withReactions(
                <PinchHintGame headerActions={headerActions} roomState={roomState} myUserId={myUserId} onBackToLobby={handleBackToLobby} onRefreshRoom={refreshRoom} />
            );
        }
    }

    return withReactions(
        <GameWrapper headerActions={<RoomHeaderActions isHost={isHost} onEnd={handleBackToLobby} />} players={players} myUserId={reactionUserId}>
            <div className="flex min-h-[60vh] items-center justify-center px-4"><p className="text-center text-xl font-black">ゲームは終了しました。</p></div>
        </GameWrapper>
    );
}
