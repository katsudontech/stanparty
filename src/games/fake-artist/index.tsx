'use client';

import type { RoomState } from '@/games/core/types';
import { type FakeArtistGameState, type FakeArtistPhase, DEFAULT_FAKE_ARTIST_STATE } from './types';
import { GameHeader } from './components/GameHeader';
import { GameStatus } from './components/GameStatus';
import { Canvas } from './components/Canvas';
import { RuleSettingPhase } from './components/RuleSettingPhase';
import { RoleAssignmentPhase } from './components/RoleAssignmentPhase';
import { ThemeSelectionPhase } from './components/ThemeSelectionPhase';
import { DrawingPhase } from './components/DrawingPhase';
import { VotingPhase } from './components/VotingPhase';
import { GuessingPhase } from './components/GuessingPhase';
import { ResultPhase } from './components/ResultPhase';
import { DrawingPhaseSidebarInfo } from './components/DrawingPhaseSidebarInfo';
import { useFakeArtistGame } from './hooks/useFakeArtistGame';

interface FakeArtistGameProps {
  roomState: RoomState;
  myUserId: string | null;
}

export function FakeArtistGame({ roomState, myUserId }: FakeArtistGameProps) {
  // DBからのデータが空（null）の場合でも、デフォルト値とマージして完全な状態を担保する
  const rawState = roomState.game_state as Partial<FakeArtistGameState> | null;
  const gameState: FakeArtistGameState = {
    ...DEFAULT_FAKE_ARTIST_STATE,
    ...(rawState || {})
  };

  const currentPhase: FakeArtistPhase = gameState.phase;

  // ホストかどうかの判定（タイマー処理の権限用）
  const myPlayer = roomState.players.find(p => p.userId === myUserId);
  const isHost = myPlayer?.isHost ?? false;

  // カスタムフックからゲーム進行ロジック（関数）を取得
  const { handleSaveRules, proceedToThemeSelection, handleThemeSubmit, handleTurnEnd, handleVote, handleAllVoted, handleFakeArtistGuess, handleGuessJudge, handleResetGame, updateGameState } = useFakeArtistGame(roomState);

  // ==========================================
  // ① 常に表示するヘッダー部分
  // ==========================================
  const renderSidebar = () => (
    <div className="flex flex-col h-full p-4 overflow-y-auto w-64 bg-slate-800 border-r border-slate-700 shrink-0 shadow-xl z-10">
      <GameHeader roomId={roomState.id} />
      <GameStatus
        players={roomState.players}
        currentPhase={currentPhase}
        gameState={gameState}
        myUserId={myUserId}
      />
      {currentPhase === 'drawing' && (
        <DrawingPhaseSidebarInfo 
          players={roomState.players}
          gameState={gameState}
          myUserId={myUserId}
        />
      )}
    </div>
  );

  // ==========================================
  // ② フェーズに応じて中身を切り替える部分
  // ==========================================
  const renderMainContent = () => {
    switch (currentPhase) {
      case 'rule_setting':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <RuleSettingPhase
              players={roomState.players}
              ruleSettings={gameState.ruleSettings}
              onSaveRules={handleSaveRules}
              onChangeRules={(newRules) => updateGameState({ ruleSettings: newRules })}
              isHost={isHost}
            />
          </div>
        );

      case 'role_assignment':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <RoleAssignmentPhase
              players={roomState.players}
              playerStates={gameState?.playerStates || {}}
              myUserId={myUserId}
              isHost={isHost}
              onTimeout={proceedToThemeSelection}
              turnOrder={gameState.turnOrder || []}
            />
          </div>
        );

      case 'theme_selection':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <ThemeSelectionPhase
              players={roomState.players}
              gameState={gameState}
              myUserId={myUserId}
              isHost={isHost}
              onThemeSubmit={handleThemeSubmit}
              updateGameState={updateGameState}
            />
          </div>
        );

      case 'drawing':
        return (
          <div className="w-full h-full p-2">
            <DrawingPhase
              roomId={roomState.id}
              players={roomState.players}
              gameState={gameState}
              myUserId={myUserId}
              onTurnEnd={handleTurnEnd}
            />
          </div>
        );

      case 'voting':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <VotingPhase 
              roomId={roomState.id}
              players={roomState.players}
              myUserId={myUserId}
              onVote={handleVote}
              isHost={isHost}
              onAllVoted={handleAllVoted}
            />
          </div>
        );

      case 'guessing':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <GuessingPhase 
              roomId={roomState.id}
              players={roomState.players} 
              gameState={gameState} 
              myUserId={myUserId} 
              isHost={isHost}
              onGuessSubmit={handleFakeArtistGuess}
              onJudgeSubmit={handleGuessJudge}
            />
          </div>
        );

      case 'result':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <ResultPhase players={roomState.players} gameState={gameState} isHost={isHost} onResetGame={handleResetGame} />
          </div>
        );

      default:
        return <div className="text-white mt-8 mx-auto">準備中...</div>;
    }
  };

  // ==========================================
  // ③ 実際の画面レイアウト（ここで①と②を合体させる）
  // ==========================================
  return (
    <>
      {/* スマホ縦画面時の警告オーバーレイ */}
      <div className="fixed inset-0 bg-slate-900 z-[100] flex-col items-center justify-center text-white p-6 text-center hidden portrait:flex">
        <svg className="w-20 h-20 mb-6 animate-pulse text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8 8 8 0 018 8" strokeDasharray="4 4" className="origin-center rotate-90" />
        </svg>
        <h2 className="text-2xl font-bold mb-4 tracking-wider">スマホを横向きにしてください</h2>
        <p className="text-slate-300 leading-relaxed max-w-sm">
          キャンバスを広く使ってお絵描きをするため、<br/>
          画面を横に傾けて（横画面で）お楽しみください🎨
        </p>
      </div>

      <div className="flex h-[100dvh] w-full bg-slate-900 text-slate-100 overflow-hidden portrait:hidden">
        {renderSidebar()}

        <div className="flex-1 h-full relative overflow-y-auto overflow-x-hidden flex flex-col justify-center bg-slate-800/50">
          {renderMainContent()}
        </div>
      </div>
    </>
  );
}
