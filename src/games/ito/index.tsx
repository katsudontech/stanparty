'use client';

import type { RoomState } from '@/games/core/types';

import { ArrangingPhase } from './components/ArrangingPhase';
import { ResultPhase } from './components/ResultPhase';
import { RuleSettingPhase } from './components/RuleSettingPhase';
import { ShowdownPhase } from './components/ShowdownPhase';
import { ThemeSelectionPhase } from './components/ThemeSelectionPhase';
import { useItoGame } from './hooks/useItoGame';

interface ItoGameProps {
  roomState: RoomState;
  myUserId: string;
}

const PHASE_LABELS = {
  rule_setting: 'ルール設定',
  theme_selection: 'お題選択',
  arranging: '並べ替え',
  showdown: 'ショーダウン',
  result: '結果発表',
} as const;

export function ItoGame({ roomState, myUserId }: ItoGameProps) {
  const isHost = roomState.host_id === myUserId;
  const {
    gameState,
    handleSaveRules,
    handleDrawTheme,
    handleSelectTheme,
    handleSetHint,
    handleMoveCard,
    handleSetReady,
    handleStartShowdown,
    handleRevealNextCard,
    handleResetGame,
    handleBackToLobby,
  } = useItoGame(roomState);

  const renderPhase = () => {
    switch (gameState.phase) {
      case 'rule_setting':
        return (
          <RuleSettingPhase
            playerCount={roomState.players.length}
            initialCardsPerPlayer={gameState.ruleSettings.cardsPerPlayer}
            isHost={isHost}
            onStart={handleSaveRules}
            onBackToLobby={handleBackToLobby}
          />
        );

      case 'theme_selection':
        return (
          <ThemeSelectionPhase
            themeCandidate={gameState.themeCandidate}
            isHost={isHost}
            onDrawTheme={handleDrawTheme}
            onSelectTheme={handleSelectTheme}
            onBackToRules={handleResetGame}
          />
        );

      case 'arranging':
        return (
          <ArrangingPhase
            gameState={gameState}
            players={roomState.players}
            myUserId={myUserId}
            isHost={isHost}
            onSetHint={handleSetHint}
            onMoveCard={handleMoveCard}
            onSetReady={handleSetReady}
            onStartShowdown={handleStartShowdown}
          />
        );

      case 'showdown':
        return (
          <ShowdownPhase
            gameState={gameState}
            players={roomState.players}
            isHost={isHost}
            onRevealNext={handleRevealNextCard}
          />
        );

      case 'result':
        return (
          <ResultPhase
            gameState={gameState}
            players={roomState.players}
            isHost={isHost}
            onResetGame={handleResetGame}
            onBackToLobby={handleBackToLobby}
          />
        );
    }
  };

  return (
    <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-800/70 p-3 shadow-2xl sm:p-6">
      <header className="mb-7 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="text-left">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">StanParty</p>
          <h1 className="mt-1 text-2xl font-black text-white">🧵 ito</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-500">現在のフェーズ</p>
          <p className="font-black text-slate-200">{PHASE_LABELS[gameState.phase]}</p>
        </div>
      </header>

      <main className="text-center">{renderPhase()}</main>
    </div>
  );
}
