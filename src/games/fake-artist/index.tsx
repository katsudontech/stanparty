'use client';

import type { RoomState } from '@/games/core/types';
import type { FakeArtistGameState, FakeArtistPhase } from './types';
import { GameHeader } from './components/GameHeader';
import { GameStatus } from './components/GameStatus';
import { Canvas } from './components/Canvas';
import { RuleSettingPhase } from './components/RuleSettingPhase';
import { RoleAssignmentPhase } from './components/RoleAssignmentPhase';
import { ThemeSelectionPhase } from './components/ThemeSelectionPhase';
import { VotingPhase } from './components/VotingPhase';
import { GuessingPhase } from './components/GuessingPhase';
import { ResultPhase } from './components/ResultPhase';

interface FakeArtistGameProps {
  roomState: RoomState;
}

export function FakeArtistGame({ roomState }: FakeArtistGameProps) {
  // DBから受け取ったJSON(game_state)をエセ芸術家用の型として扱う
  const gameState = roomState.game_state as FakeArtistGameState | null;
  // 何も設定されていなければ最初のフェーズとする
  const currentPhase: FakeArtistPhase = gameState?.phase || 'rule_setting';

  // ==========================================
  // ① 常に表示するヘッダー部分
  // ==========================================
  const renderHeader = () => (
    <>
      <GameHeader roomId={roomState.id} />
      <GameStatus
        players={roomState.players}
        currentPhase={currentPhase}
      />
    </>
  );

  // ==========================================
  // ② フェーズに応じて中身を切り替える部分
  // ==========================================
  const renderMainContent = () => {
    switch (currentPhase) {
      case 'rule_setting':
        return <RuleSettingPhase players={roomState.players} />;

      case 'role_assignment':
        return <RoleAssignmentPhase players={roomState.players} myUserId={null} />;

      case 'theme_selection':
        return <ThemeSelectionPhase players={roomState.players} />;

      case 'drawing':
        return (
          <div className="mt-8">
            <Canvas
              players={roomState.players}
              currentTurnPlayerId={gameState?.currentTurnPlayerId || roomState.players[0]?.userId || null}
            />
          </div>
        );

      case 'voting':
        return <VotingPhase players={roomState.players} />;

      case 'guessing':
        return <GuessingPhase players={roomState.players} />;

      case 'result':
        return <ResultPhase players={roomState.players} />;

      default:
        return <div className="text-white mt-8">準備中...</div>;
    }
  };

  // ==========================================
  // ③ 実際の画面レイアウト（ここで①と②を合体させる）
  // ==========================================
  return (
    <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center border border-slate-700 w-full">
      {/* 上部に常にヘッダーを表示 */}
      {renderHeader()}

      {/* 下部にフェーズに応じたコンテンツを表示 */}
      <div className="w-full max-w-2xl">
        {renderMainContent()}
      </div>
    </div>
  );
}
