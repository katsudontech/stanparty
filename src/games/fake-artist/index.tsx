'use client';

import type { RoomState } from '@/games/core/types';
import { type FakeArtistGameState, type FakeArtistPhase, DEFAULT_FAKE_ARTIST_STATE } from './types';
import { GameHeader } from './components/GameHeader';
import { GameStatus } from './components/GameStatus';
import { RuleSettingPhase } from './components/RuleSettingPhase';
import { RoleAssignmentPhase } from './components/RoleAssignmentPhase';
import { ThemeSelectionPhase } from './components/ThemeSelectionPhase';
import { DrawingPhase } from './components/DrawingPhase';
import { VotingPhase } from './components/VotingPhase';
import { GuessingPhase } from './components/GuessingPhase';
import { ResultPhase } from './components/ResultPhase';
import { useFakeArtistGame } from './hooks/useFakeArtistGame';

interface FakeArtistGameProps {
  roomState: RoomState;
  myUserId: string | null;
  onBackToLobby: () => Promise<void>;
}

export function FakeArtistGame({ roomState, myUserId, onBackToLobby }: FakeArtistGameProps) {
  // DBからのデータが空（null）の場合でも、デフォルト値とマージして完全な状態を担保する
  const rawState = roomState.game_state as Partial<FakeArtistGameState> | null;
  const gameState: FakeArtistGameState = {
    ...DEFAULT_FAKE_ARTIST_STATE,
    ...(rawState || {})
  };

  const currentPhase: FakeArtistPhase = gameState.phase;

  // ホストかどうかの判定（タイマー処理の権限用）
  const isHost = Boolean(myUserId && roomState.host_id === myUserId);

  // カスタムフックからゲーム進行ロジック（関数）を取得
  const { handleSaveRules, proceedToThemeSelection, handleThemeSubmit, handleTurnEnd, handleUndoStroke, handleVote, handleAllVoted, handleFakeArtistGuess, handleGuessJudge, handleResetGame, updateGameState } = useFakeArtistGame(roomState);

  // ==========================================
  // ① 常に表示するヘッダー部分
  // ==========================================
  const renderHeader = () => (
    <>
      <GameHeader roomId={roomState.id} />
      <GameStatus
        players={roomState.players}
        currentPhase={currentPhase}
        gameState={gameState}
        myUserId={myUserId}
      />
    </>
  );

  // ==========================================
  // ② フェーズに応じて中身を切り替える部分
  // ==========================================
  const renderMainContent = () => {
    switch (currentPhase) {
      case 'rule_setting':
        return (
          <RuleSettingPhase
            ruleSettings={gameState.ruleSettings}
            onSaveRules={handleSaveRules}
            onChangeRules={(newRules) => updateGameState({ ruleSettings: newRules })}
            isHost={isHost}
            onBackToLobby={onBackToLobby}
          />
        );

      case 'role_assignment':
        return (
          <RoleAssignmentPhase
            playerStates={gameState?.playerStates || {}}
            myUserId={myUserId}
            isHost={isHost}
            onTimeout={proceedToThemeSelection}
            turnOrder={gameState.turnOrder || []}
          />
        );

      case 'theme_selection':
        return (
          <ThemeSelectionPhase
            gameState={gameState}
            myUserId={myUserId}
            isHost={isHost}
            onThemeSubmit={handleThemeSubmit}
            updateGameState={updateGameState}
          />
        );

      case 'drawing':
        return (
          <DrawingPhase
            roomId={roomState.id}
            players={roomState.players}
            gameState={gameState}
            myUserId={myUserId}
            onTurnEnd={handleTurnEnd}
            onUndoStroke={handleUndoStroke}
          />
        );

      case 'voting':
        return (
          <VotingPhase 
            roomId={roomState.id}
            players={roomState.players}
            myUserId={myUserId}
            onVote={handleVote}
            isHost={isHost}
            onAllVoted={handleAllVoted}
          />
        );

      case 'guessing':
        return (
          <GuessingPhase 
            roomId={roomState.id}
            players={roomState.players} 
            gameState={gameState} 
            myUserId={myUserId} 
            hostId={roomState.host_id}
            onGuessSubmit={handleFakeArtistGuess}
            onJudgeSubmit={handleGuessJudge}
          />
        );

      case 'result':
        return <ResultPhase roomId={roomState.id} myUserId={myUserId} players={roomState.players} gameState={gameState} isHost={isHost} onResetGame={handleResetGame} />;

      default:
        return <div className="text-white mt-8">準備中...</div>;
    }
  };

  // ==========================================
  // ③ 実際の画面レイアウト（ここで①と②を合体させる）
  // ==========================================
  return (
    <div className="bg-slate-800 p-2 sm:p-4 rounded-2xl shadow-2xl flex flex-col items-center text-center border border-slate-700 w-full">
      {/* 上部に常にヘッダーを表示 */}
      <div className="w-full max-w-2xl mx-auto">
        {renderHeader()}
      </div>

      {/* 下部にフェーズに応じたコンテンツを表示 */}
      <div className={`w-full ${['drawing', 'voting', 'guessing'].includes(currentPhase) ? '' : 'max-w-2xl mx-auto'}`}>
        {renderMainContent()}
      </div>
    </div>
  );
}
