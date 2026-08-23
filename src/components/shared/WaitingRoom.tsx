'use client';

import { useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';

import type { RoomState, Player } from '@/games/core/types';

interface WaitingRoomProps {
  roomState: RoomState;
  players: Player[];
  isHost: boolean;
  onStartGame: () => void;
  onChangeGame: (gameId: string) => void;
}

const AVAILABLE_GAMES = [
  { id: 'fake-artist', name: '🎨 エセ芸術家 ニューヨークへ行く' },
  { id: 'coyote', name: '🐺 Coyote Online Forehead' },
  { id: 'ito', name: '🧵 ito' },
  //{ id: 'word-wolf', name: '🦊 ワードウルフ (予定)' },
  //{ id: 'blocks', name: '🟩 BLOCKS' }
];

export function WaitingRoom({ roomState, players, isHost, onStartGame, onChangeGame }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">待機所</h1>

        <div className="mb-6">
          <button
            onClick={handleCopyUrl}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors border border-gray-200"
          >
            {copied ? (
              <>
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="text-green-600">コピーしました！</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                URLをコピーして友達を招待
              </>
            )}
          </button>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-semibold text-gray-700">参加者</h2>
            <span className="text-sm font-medium text-gray-500">{players.length}人が入室中</span>
          </div>

          <ul className="space-y-3">
            {players.map((player, index) => (
              <li key={player.userId || index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Avatar
                  avatarUrl={player.avatarUrl}
                  name={player.name || '名無し'}
                  color={player.color || '#3B82F6'}
                  size="lg"
                  decorative
                />
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{player.name || '名無し'}</span>
                    {player.isHost && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-md font-bold">
                        ホスト
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {player.isOnline ? '🟢 オンライン' : '🔴 オフライン'}
                  </span>
                </div>
              </li>
            ))}

            {players.length === 0 && (
              <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                誰もいません
              </div>
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-center">
            <p className="text-sm mb-2 text-blue-600 font-bold">プレイするゲーム</p>
            {isHost ? (
              <select
                className="w-full bg-white border border-blue-200 text-blue-900 font-bold text-lg rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-center"
                value={roomState.game_type}
                onChange={(e) => onChangeGame(e.target.value)}
              >
                {AVAILABLE_GAMES.map(game => (
                  <option key={game.id} value={game.id}>{game.name}</option>
                ))}
              </select>
            ) : (
              <p className="font-bold text-lg bg-white rounded-lg p-2 border border-blue-100">
                {AVAILABLE_GAMES.find(g => g.id === roomState.game_type)?.name || roomState.game_type}
              </p>
            )}
          </div>

          {isHost ? (
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 px-4 rounded-xl shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
              onClick={onStartGame}
            >
              ゲーム開始！
            </button>
          ) : (
            <div className="w-full bg-gray-200 text-gray-500 font-bold py-4 px-4 rounded-xl text-center shadow-inner border border-gray-300">
              ホストの開始を待機中...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
