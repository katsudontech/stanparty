'use client';

import { use, useState, useEffect } from 'react';
import { useRoomSubscription } from '@/hooks/useRoomSubscription';
import { WaitingRoom } from '@/components/shared/WaitingRoom';
import { GameWrapper } from '@/games/core/GameWrapper';
import { FakeArtistGame } from '@/games/fake-artist';
import { createClient } from '@/lib/supabase/client';
import type { Player } from '@/games/core/types';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);

    // テスト用の簡易的なユーザーID管理（本来はSupabase AuthのユーザーIDを使う想定）
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [joinName, setJoinName] = useState('');

    useEffect(() => {
        // ブラウザに一時的なIDを保存して自分を識別する
        // TODO: ここは、本来はSupabase AuthのユーザーIDを使う想定
        let id = localStorage.getItem('mock_user_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('mock_user_id', id);
        }
        setMyUserId(id);
    }, []);

    // 1. データベースから現在のルームの状態とPresenceをリアルタイム取得
    const { roomState, players, onlineUserIds } = useRoomSubscription(roomId, myUserId);

    // 自分がすでに参加しているかどうかの判定とホスト権限の確認
    const myPlayer = roomState?.players.find((p: Player) => p.userId === myUserId);
    const isJoined = !!myPlayer;
    const isHost = myPlayer?.isHost ?? false;

    // ホストによる切断者の監視と自動キック処理（waiting状態の時のみ）
    useEffect(() => {
        // 自分がホストでない、データが未ロード、waitingでない場合は何もしない
        // ※ onlineUserIdsが空の時（ホスト自身のPresence接続が完了していない時）もスキップ
        if (!isHost || !roomState || roomState.status !== 'waiting' || onlineUserIds.length === 0) return;

        // DB上のプレイヤーのうち、Presenceのオンライン一覧（+ 念のため自分のID）にいない人を探す
        const disconnectedUsers = players.filter((p: Player) =>
            p.userId !== myUserId && !onlineUserIds.includes(p.userId)
        );

        if (disconnectedUsers.length > 0) {
            console.log('通信切断の可能性があるユーザーを検知（5秒後に退出させます）:', disconnectedUsers);
            
            // すぐにキックせず、5秒待つ（初回のラグや、一時的なリロードを救済するため）
            const timer = setTimeout(async () => {
                console.log('5秒経過したため、自動退出させます:', disconnectedUsers);
                const supabase = createClient();
                
                // 競合を防ぐため、キック直前に最新のDBデータを取得して更新する
                const { data } = await supabase.from('rooms').select('players').eq('id', roomId).single();
                
                if (data) {
                    const currentPlayers: Player[] = data.players || [];
                    const remainingPlayers = currentPlayers.filter((p: Player) => 
                        p.userId === myUserId || onlineUserIds.includes(p.userId)
                    );
                    await supabase.from('rooms').update({ players: remainingPlayers }).eq('id', roomId);
                }
            }, 5000);

            // 5秒以内にそのユーザーが復帰（onlineUserIdsが更新）したら、タイマーをキャンセルしてキックを無効化！
            return () => clearTimeout(timer);
        }
    }, [isHost, roomState?.status, players, onlineUserIds, myUserId, roomId]);

    // 参加ボタンを押した時の処理
    const handleJoin = async () => {
        if (!joinName.trim() || !myUserId || !roomState) return;

        const supabase = createClient();

        const newPlayer = {
            userId: myUserId,
            name: joinName,
            avatarUrl: '',
            isHost: players.length === 0, // 最初の1人なら自動的にホストにする
            color: '#' + Math.floor(Math.random() * 16777215).toString(16), // ランダムな色(変更予定)
            isOnline: true
        };

        const { error } = await supabase
            .from('rooms')
            .update({ players: [...players, newPlayer] })
            .eq('id', roomId);

        if (error) {
            console.error('参加に失敗しました:', error);
            alert('参加エラー');
        }
    };

    // ゲーム変更処理（WaitingRoomに渡す）
    const handleChangeGame = async (gameId: string) => {
        const supabase = createClient();
        const { error } = await supabase
            .from('rooms')
            .update({ game_type: gameId })
            .eq('id', roomId);
            
        if (error) {
            console.error('ゲームの変更に失敗しました:', error);
        }
    };

    // ゲーム開始処理（WaitingRoomに渡す）
    const handleStartGame = async () => {
        const supabase = createClient();
        const { error } = await supabase
            .from('rooms')
            .update({ status: 'playing' })
            .eq('id', roomId);

        if (error) {
            console.error('ゲーム開始に失敗しました:', error);
            alert('ゲームの開始に失敗しました');
        }
    };

    if (!roomState) return <div>読み込み中...</div>;

    // まだ参加していない場合は、名前入力画面を表示
    if (!isJoined) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">ルームに参加</h2>
                    <input
                        type="text"
                        placeholder="あなたの名前"
                        className="w-full border border-gray-300 p-3 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                    <button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                        onClick={handleJoin}
                        disabled={!joinName.trim()}
                    >
                        入室する
                    </button>
                </div>
            </div>
        );
    }

    // 2. 状態が 'waiting'（待機中）なら、待機所コンポーネントを表示
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

    // 3. 状態が 'playing'（プレイ中）なら、選ばれたゲームのコンポーネントを表示
    if (roomState.status === 'playing') {
        // どのゲームが選ばれているかで出し分ける（将来別のゲームが増えてもここに追加するだけ）
        if (roomState.game_type === 'fake-artist') {
            return (
                <GameWrapper>
                    <FakeArtistGame roomId={roomId} players={players} />
                </GameWrapper>
            );
        }

        // 他のゲームの場合...
    }

    return <div>ゲームが終了しました</div>;
}
