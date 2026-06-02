export type FakeArtistPhase =
  | 'rule_setting'
  | 'role_assignment'
  | 'theme_selection'
  | 'drawing'
  | 'voting'
  | 'guessing'
  | 'result';

export interface FakeArtistPlayerState {
  role: 'questioner' | 'artist' | 'fake_artist' | null;
  color: string;
  score: number;
}


export interface RuleSettings {
  roundLimit: number;
  autoThemeSelection: boolean;
  showFakeTheme: boolean;
}

export interface FakeArtistGameState {
  phase: FakeArtistPhase;
  playerStates: Record<string, FakeArtistPlayerState>;
  ruleSettings: RuleSettings;
  themeGenre: string | null;
  theme: string | null;
  currentTurnPlayerId: string | null;
  turnOrder: string[];
  currentLap: number;
  votes: Record<string, string>;
  fakeArtistGuess: string | null;
  winner: 'artists' | 'fake_artist' | null;
}

export const DEFAULT_FAKE_ARTIST_STATE: FakeArtistGameState = {
  phase: 'rule_setting',
  playerStates: {},
  ruleSettings: { roundLimit: 2, autoThemeSelection: false, showFakeTheme: false },
  themeGenre: null,
  theme: null,
  currentTurnPlayerId: null,
  turnOrder: [],
  currentLap: 1,
  votes: {},
  fakeArtistGuess: null,
  winner: null,
};

// event管理


export interface Point {
  x: number;
  y: number;
}

export interface DrawLinePayload {
  playerId: string;
  color: string;
  strokeWidth: number;
  points: Point[];
}

export interface ChatMessagePayload {
  senderId: string;
  message: string;
}

