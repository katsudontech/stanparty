export const CRIMINAL_DANCES_GAME = 'criminal-dances' as const;

export type CriminalDancesCardType =
  | 'first_discoverer'
  | 'culprit'
  | 'detective'
  | 'alibi'
  | 'conspiracy'
  | 'boy'
  | 'dog'
  | 'witness'
  | 'trade'
  | 'information_control'
  | 'rumor'
  | 'civilian';

export interface CriminalDancesCard {
  id: string;
  type: CriminalDancesCardType;
}

export interface CriminalDancesPlayerState {
  id: string;
  hand: CriminalDancesCard[];
  played: CriminalDancesCardType[];
  conspirator: boolean;
}

export type CriminalDancesOutcomeReason = 'culprit_escaped' | 'detective_caught' | 'dog_caught' | 'aborted';

export interface CriminalDancesOutcome {
  reason: CriminalDancesOutcomeReason;
  culpritPlayerId: string | null;
  captorPlayerId: string | null;
  winners: string[];
  conspirators: string[];
}

export type CriminalDancesPending =
  | { kind: 'detective_target'; actorId: string; eligibleTargetIds: string[] }
  | { kind: 'dog_target'; actorId: string; eligibleTargetIds: string[] }
  | { kind: 'dog_card'; actorId: string; targetId: string; cardCount: number; cardOrder: number[] }
  | { kind: 'witness_target'; actorId: string; eligibleTargetIds: string[] }
  | { kind: 'witness_reveal'; actorId: string; targetId: string; cards: CriminalDancesCard[] }
  | { kind: 'boy_reveal'; actorId: string; culpritPlayerId: string | null }
  | { kind: 'trade'; actorId: string; targetId: string; eligibleTargetIds: string[]; actorCardId: string | null; targetCardId: string | null }
  | { kind: 'information_control'; baseHands: Record<string, CriminalDancesCard[]>; choices: Record<string, string> }
  | { kind: 'rumor'; baseHands: Record<string, CriminalDancesCard[]>; choices: Record<string, string>; cardOrders: Record<string, number[]> };

export interface CriminalDancesState {
  game: typeof CRIMINAL_DANCES_GAME;
  version: 1;
  matchId: string;
  revision: number;
  phase: 'playing' | 'finished';
  turnOrder: string[];
  currentPlayerIndex: number;
  round: number;
  firstDiscovererPlayerId: string;
  firstDiscovererPlayed: boolean;
  players: Record<string, CriminalDancesPlayerState>;
  lastAction: { actorId: string; cardType?: CriminalDancesCardType; text: string } | null;
  /** Publicly safe metadata for the most recently discarded card. */
  lastPlayedCard?: { actorId: string; cardType: CriminalDancesCardType } | null;
  pending: CriminalDancesPending | null;
  outcome: CriminalDancesOutcome | null;
  processedActionIds: string[];
  incidentText: string | null;
  revealedCardType: CriminalDancesCardType | null;
}

export interface CriminalDancesPublicPlayer {
  id: string;
  handCount: number;
  played: CriminalDancesCardType[];
  conspirator: boolean;
}

export interface CriminalDancesPublicState {
  game: typeof CRIMINAL_DANCES_GAME;
  version: 1;
  matchId: string;
  revision: number;
  phase: CriminalDancesState['phase'];
  turnOrder: string[];
  currentPlayerIndex: number;
  round: number;
  firstDiscovererPlayerId: string;
  firstDiscovererPlayed: boolean;
  players: Record<string, CriminalDancesPublicPlayer>;
  lastAction: CriminalDancesState['lastAction'];
  lastPlayedCard?: CriminalDancesState['lastPlayedCard'];
  pending: { kind: CriminalDancesPending['kind']; actorId?: string; targetId?: string; eligibleTargetIds?: string[]; cardCount?: number; submittedPlayerIds?: string[] } | null;
  outcome: CriminalDancesOutcome | null;
  incidentText: string | null;
  revealedCardType: CriminalDancesCardType | null;
}

export interface CriminalDancesPrivateState extends CriminalDancesPublicState {
  myPlayerId: string;
  myHand: CriminalDancesCard[];
  privateReveal: { kind: 'boy' | 'witness'; culpritPlayerId?: string | null; targetId?: string; cards?: CriminalDancesCard[] } | null;
}
