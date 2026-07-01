export type CoyotePhase = 'rule_setting' | 'playing' | 'coyote_called' | 'result';

export interface CoyotePlayerState {
    hp: number;
    currentCard: string;
}

export interface CoyoteGameState {
    phase?: CoyotePhase;
    ruleSettings?: { maxHp: number };
    coyotePlayers: { [userId: string]: CoyotePlayerState };
    currentDeck: string[];
    coyoteCallerId?: string;
    coyoteTotalValue?: number;
    questionRevealedCard?: string | null;
    winnerId?: string;
}

export const DEFAULT_COYOTE_STATE: Partial<CoyoteGameState> = {
    phase: 'rule_setting',
    ruleSettings: { maxHp: 3 },
    coyotePlayers: {},
    currentDeck: []
};
