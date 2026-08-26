'use client';

import { use } from 'react';
import { useRoomSubscription } from '@/hooks/useRoomSubscription';
import { useUserId } from '@/hooks/useUserId';
import { useHostAutoKick } from '@/hooks/useHostAutoKick';
import { useRoomControls } from '@/hooks/useRoomControls';
import { JoinRoomScreen } from '@/components/shared/JoinRoomScreen';
import { WaitingRoom } from '@/components/shared/WaitingRoom';
import { GameWrapper } from '@/games/core/GameWrapper';
import { FakeArtistGame } from '@/games/fake-artist';
import { CoyoteGame } from '@/games/coyote';
import { OneNightWerewolfGame } from '@/games/one-night-werewolf';
import { ItoGame } from '@/games/ito';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const myUserId = useUserId();

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

    if (!myUserId || loading) {
        return <div className="site-shell flex min-h-screen flex-col items-center justify-center gap-4"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--paper-deep)] border-t-[var(--orange)]" /><p className="font-black text-[var(--muted)]">ルームを読み込んでいます…</p></div>;
    }

    if (error) {
        return <div className="site-shell flex min-h-screen items-center justify-center p-5"><div className="paper-card max-w-lg p-8"><p className="section-kicker">Error</p><h1 className="mt-3 text-2xl font-black">ルームを読み込めませんでした</h1><p className="mt-3 text-sm text-[var(--muted)]">{error.message}</p></div></div>;
    }

    if (!roomState || !isJoined) {
        return <JoinRoomScreen roomId={roomId} onJoined={refreshRoom} />;
    }

    if (roomState.status === 'waiting') {
        return (
            <WaitingRoom
                roomState={roomState}
                players={players}
                onlineUserIds={onlineUserIds}
                isHost={isHost}
                onStartGame={handleStartGame}
                onChangeGame={handleChangeGame}
            />
        );
    }

    if (roomState.status === 'playing') {
        if (roomState.game_type === 'fake-artist') {
            return (
                <GameWrapper players={players} myUserId={myUserId} showPlayerBar={false}>
                    <FakeArtistGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'coyote') {
            return (
                <GameWrapper players={players} myUserId={myUserId}>
                    <CoyoteGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'one-night-werewolf') {
            return (
                <GameWrapper players={players} myUserId={myUserId}>
                    <OneNightWerewolfGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'ito') {
            return (
                <GameWrapper players={players} myUserId={myUserId}>
                    <ItoGame
                        roomState={roomState}
                        myUserId={myUserId}
                        onBackToLobby={handleBackToLobby}
                    />
                </GameWrapper>
            );
        }
    }

    return <div className="site-shell flex min-h-screen items-center justify-center"><p className="text-xl font-black">ゲームは終了しました。</p></div>;
}
