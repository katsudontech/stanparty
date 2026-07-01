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
import type { Player } from '@/games/core/types';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const myUserId = useUserId();

    // 1. データベースから現在のルームの状態とPresenceをリアルタイム取得
    const { roomState, players, onlineUserIds } = useRoomSubscription(roomId, myUserId);

    // 2. ホスト用コントロール操作のフック
    const { handleChangeGame, handleStartGame } = useRoomControls(roomId);

    // 自分のプレイヤー情報の取得とホスト権限の確認
    const myPlayer = roomState?.players.find((p: Player) => p.userId === myUserId);
    const isJoined = !!myPlayer;
    const isHost = myPlayer?.isHost ?? false;

    // 3. ホスト用の切断者監視・自動キック処理（内部で権限判定しているため常に呼び出してOK）
    useHostAutoKick(roomId, isHost, roomState, players, onlineUserIds, myUserId);

    // データロード中
    if (!roomState || !myUserId) return <div>読み込み中...</div>;

    // 画面1: 未参加なら参加画面を表示
    if (!isJoined) {
        return <JoinRoomScreen roomId={roomId} myUserId={myUserId} roomState={roomState} players={players} />;
    }

    // 画面2: 状態が 'waiting'（待機中）なら、待機所コンポーネントを表示
    if (roomState.status === 'waiting') {
        return (
            <WaitingRoom
                roomState={roomState}
                players={players}
                isHost={isHost}
                onStartGame={handleStartGame}
                onChangeGame={handleChangeGame}
            />
        );
    }

    // 画面3: 状態が 'playing'（プレイ中）なら、選ばれたゲームのコンポーネントを表示
    if (roomState.status === 'playing') {
        if (roomState.game_type === 'fake-artist') {
            return (
                <GameWrapper>
                    <FakeArtistGame roomState={roomState} myUserId={myUserId} />
                </GameWrapper>
            );
        }

        if (roomState.game_type === 'coyote') {
            return (
                <GameWrapper>
                    <CoyoteGame roomState={roomState} myUserId={myUserId} />
                </GameWrapper>
            );
        }

        // TODO: 他のゲームの場合（人狼など）
    }

    return <div>ゲームが終了しました</div>;
}
