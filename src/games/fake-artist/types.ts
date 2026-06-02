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

export interface FakeArtistGameState {
  phase: FakeArtistPhase;
  playerStates: Record<string, FakeArtistPlayerState>;
  themeGenre: string | null;
  theme: string | null;
  currentTurnPlayerId: string | null;
  turnOrder: string[];
  currentLap: number;
  votes: Record<string, string>;
  fakeArtistGuess: string | null;
  winner: 'artists' | 'fake_artist' | null;
}

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

