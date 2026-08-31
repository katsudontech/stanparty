'use client';

import type { Player } from '@/games/core/types';
import { Avatar } from '@/components/shared/Avatar';
import type { FakeArtistPhase, FakeArtistGameState } from '../types';

interface GameStatusProps {
  players: Player[];
  currentPhase: FakeArtistPhase;
  gameState: FakeArtistGameState;
  myUserId: string | null;
}

const PHASE_LABELS: Record<FakeArtistPhase, string> = {
  rule_setting: 'ルール設定',
  role_assignment: '役職確認',
  theme_selection: 'お題決定',
  drawing: 'お絵描き',
  voting: '投票',
  guessing: 'エセ芸術家の予想',
  result: '結果発表'
};

export function GameStatus({ players, currentPhase, gameState, myUserId }: GameStatusProps) {
  return (
    <div className="w-full max-w-2xl mb-8 flex flex-col space-y-4">
      {/* プレイヤー一覧 */}
      <div className="w-full rounded-xl border border-slate-600 bg-slate-700/50 p-4 shadow-lg sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-slate-400 font-medium text-sm">参加プレイヤー ({players.length}人)</p>
          <p className="text-slate-400 font-medium text-sm">現在のフェーズ: <span className="text-blue-400 font-bold ml-1">{PHASE_LABELS[currentPhase] || currentPhase}</span></p>
        </div>
        <div className="flex flex-wrap gap-3">
          {players.map(p => {
            const pState = gameState.playerStates[p.userId];
            const isQuestioner = pState?.role === 'questioner';
            const isMe = p.userId === myUserId;
            // 未割り当ての場合はデフォルトのプレイヤーカラーを使用
            const color = pState?.color || p.color;

            return (
              <div 
                key={p.userId} 
                className={`flex min-w-0 items-center space-x-2 bg-slate-800 px-3 py-2 rounded-lg border ${isMe ? 'border-indigo-500 shadow-indigo-500/20' : 'border-slate-600'} shadow-sm transition-all`}
              >
                <Avatar
                  avatarUrl={p.avatarUrl}
                  name={p.name}
                  color={color}
                  size="sm"
                  decorative
                />
                <div
                  className="h-3 w-3 rounded-full shadow-inner"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="max-w-40 truncate text-sm font-black" style={{ color }}>
                  {p.name}
                </span>
                {isQuestioner && (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                    出題者
                  </span>
                )}
                {isMe && (
                  <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                    あなた
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
