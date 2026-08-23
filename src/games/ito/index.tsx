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
  onBackToLobby: () => Promise<void>;
}

const PHASE_LABELS = {
  rule_setting: 'ルール設定',
  theme_selection: 'お題選択',
  arranging: '並べ替え',
  showdown: 'ショーダウン',
  result: '結果発表',
} as const;

export function ItoGame({ roomState, myUserId, onBackToLobby }: ItoGameProps) {
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
            onBackToLobby={onBackToLobby}
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
          />
        );
    }
  };

  return (
    <div className="paper-game ito-game mx-auto min-h-[calc(100vh-6rem)] w-full max-w-3xl border-2 border-[var(--line)] bg-[var(--surface)] p-3 shadow-[5px_5px_0_var(--line)] sm:p-6">
      <header className="mb-7 flex items-center justify-between gap-4 border-b-2 border-[var(--line)] pb-5">
        <div className="text-left">
          <p className="text-xs font-black tracking-[0.2em] text-[var(--blue)]">COOPERATIVE GAME</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-.05em]">ito</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[var(--muted)]">現在のフェーズ</p>
          <p className="font-black">{PHASE_LABELS[gameState.phase]}</p>
        </div>
      </header>

      <main className="text-center">{renderPhase()}</main>
    </div>
  );
}
