export function getPinchDraftKey(roomId: string, matchId: string, turnIndex: number, playerId: string): string {
  return `pinch-hint:${roomId}:${matchId}:${turnIndex}:${playerId}`;
}

export function parsePinchDraft(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

