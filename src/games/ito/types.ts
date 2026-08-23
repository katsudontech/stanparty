export type ItoPhase =
  | 'rule_setting'
  | 'theme_selection'
  | 'arranging'
  | 'showdown'
  | 'result';

export interface ItoRuleSettings {
  cardsPerPlayer: number;
}

export interface ItoCard {
  id: string;
  ownerId: string;
  ownerCardNumber: number;
  value: number;
  hint: string;
}

export interface ItoGameState {
  game: 'ito';
  version: 1;
  phase: ItoPhase;
  ruleSettings: ItoRuleSettings;
  themeCandidate: string | null;
  selectedTheme: string | null;
  roundPlayerIds: string[];
  cards: ItoCard[];
  cardOrder: string[];
  readyPlayerIds: string[];
  revealedCardCount: number;
  result: 'success' | 'failure' | null;
}

export function createDefaultItoState(): ItoGameState {
  return {
    game: 'ito',
    version: 1,
    phase: 'rule_setting',
    ruleSettings: { cardsPerPlayer: 1 },
    themeCandidate: null,
    selectedTheme: null,
    roundPlayerIds: [],
    cards: [],
    cardOrder: [],
    readyPlayerIds: [],
    revealedCardCount: 0,
    result: null,
  };
}

export function isItoGameState(value: unknown): value is ItoGameState {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<ItoGameState>;
  return candidate.game === 'ito' && candidate.version === 1;
}
