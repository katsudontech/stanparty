import type { RoomState } from "@/games/core/types";
import type { OneNightPhase, OneNightGameState } from "./types";
import { DEFAULT_ONE_NIGHT_STATE } from "./types";
import { RuleSettingPhase } from "./components/RuleSettingPhase";
import { NightPhase } from "./components/NightPhase";
import { DayPhase } from "./components/DayPhase";
import { VotePhase } from "./components/VotePhase";
import { ResultPhase } from "./components/ResultPhase";
import { useOneNightGame } from "./hooks/useOneNightPhase";

interface OneNightWerewolfGameProps {
    roomState: RoomState;
    myUserId: string | null;
    onBackToLobby: () => Promise<void>;
}

export function OneNightWerewolfGame({ roomState, myUserId, onBackToLobby }: OneNightWerewolfGameProps) {

    const rawState = roomState.game_state as Partial<OneNightGameState> | null;
    const gameState: OneNightGameState = {
        ...DEFAULT_ONE_NIGHT_STATE,
        ...(rawState || {})
    };

    // ホストかどうかの判定（タイマー処理の権限用）
    const isHost = Boolean(myUserId && roomState.host_id === myUserId);

    const { handleSaveRule } = useOneNightGame(roomState);
    const renderPhaseHeader = (phase: OneNightPhase) => {
        switch (phase) {
            case "rule_setting":
                return "ルール設定";
            case "night_phase":
                return "夜のターン";
            case "day_phase":
                return "昼のターン";
            case "vote_phase":
                return "投票";
            case "result":
                return "結果";
        }
    };

    const renderCurrentPhase = () => {
        switch (gameState.phase) {
            case "rule_setting":
                return (
                    <RuleSettingPhase
                        ruleSettings={gameState.ruleSettings}
                        onSaveRules={handleSaveRule}
                        isHost={isHost}
                        onChangeRules={(rules) => handleSaveRule(rules)}
                        onBackToLobby={onBackToLobby}
                    />
                );
            case "night_phase":
                return (
                    <NightPhase />
                );
            case "day_phase":
                return (
                    <DayPhase />
                );
            case "vote_phase":
                return (
                    <VotePhase />
                );
            case "result":
                return (
                    <ResultPhase />
                );
        }
    };

    // 合体
    return (
        <div className="min-w-0">
            <h1 className="break-words text-2xl font-black sm:text-3xl">{renderPhaseHeader(gameState.phase)}</h1>
            {renderCurrentPhase()}
        </div>
    );
}
