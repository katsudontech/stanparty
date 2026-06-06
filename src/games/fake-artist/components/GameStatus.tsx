'use client';

import type { Player } from '@/games/core/types';
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
    <div className="w-full flex flex-col space-y-3">
      <div className="bg-slate-700/50 p-3 rounded-xl border border-slate-600 w-full shadow-lg">
        <div className="mb-2">
          <p className="text-slate-400 font-medium text-[10px]">現在のフェーズ</p>
          <p className="text-blue-400 font-bold text-sm">{PHASE_LABELS[currentPhase] || currentPhase}</p>
        </div>
        <p className="text-slate-400 font-medium text-[10px] mb-2 border-t border-slate-600/50 pt-2">参加プレイヤー ({players.length}人)</p>
        <div className="flex flex-col gap-1.5">
          {players.map(p => {
            const pState = gameState.playerStates[p.userId];
            const isQuestioner = pState?.role === 'questioner';
            const isMe = p.userId === myUserId;
            // 未割り当ての場合はデフォルトのプレイヤーカラーを使用
            const color = pState?.color || p.color;

            return (
              <div 
                key={p.userId} 
                className={`flex items-center space-x-2 bg-slate-800 px-2 py-1.5 rounded-lg border ${isMe ? 'border-indigo-500 shadow-indigo-500/20' : 'border-slate-600'} shadow-sm transition-all`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-inner shrink-0" 
                  style={{ backgroundColor: color }} 
                />
                <span className={`font-bold text-xs truncate ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                  {p.name}
                </span>
                <div className="flex gap-1 ml-auto shrink-0">
                  {isQuestioner && (
                    <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded">
                      出題
                    </span>
                  )}
                  {isMe && (
                    <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded">
                      あなた
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
