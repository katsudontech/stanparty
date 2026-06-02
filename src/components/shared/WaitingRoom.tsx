'use client';

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
  { id: 'werewolf', name: '🐺 人狼 (予定)' },
  { id: 'word-wolf', name: '🦊 ワードウルフ (予定)' },
  { id: 'ito', name: '🧵 ito (予定)' },
];

export function WaitingRoom({ roomState, players, isHost, onStartGame, onChangeGame }: WaitingRoomProps) {

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">待機所</h1>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-semibold text-gray-700">参加者</h2>
            <span className="text-sm font-medium text-gray-500">{players.length}人が入室中</span>
          </div>

          <ul className="space-y-3">
            {players.map((player, index) => (
              <li key={player.userId || index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm"
                  style={{ backgroundColor: player.color || '#3B82F6' }}
                >
                  {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                </div>
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
