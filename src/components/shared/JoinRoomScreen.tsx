'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Player, RoomState } from '@/games/core/types';

interface JoinRoomScreenProps {
  roomId: string;
  myUserId: string;
  roomState: RoomState;
  players: Player[];
}

export function JoinRoomScreen({ roomId, myUserId, roomState, players }: JoinRoomScreenProps) {
    const [joinName, setJoinName] = useState('');

    const handleJoin = async () => {
        if (!joinName.trim()) return;

        const supabase = createClient();
        const newPlayer: Player = {
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
