export const KANA_ROWS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わゐ ゑを', 'んー   '].map(row => Array.from(row));
export const KANA = KANA_ROWS.flat().filter(c => c !== ' ');
export const THEMES = ['動物', '果物', 'コンビニにあるもの', '食べ物', '乗り物', '家にあるもの', '学校にあるもの', 'スポーツ', '植物', '飲み物'];
export type Phase = 'theme' | 'words' | 'playing' | 'finished';
export type PublicPlayer = { cells: (string | null)[]; ready: boolean; eliminated: boolean };
export type PublicState = { game: 'aiue-battle'; matchId: string; revision: number; phase: Phase; turnOrder: string[]; players: Record<string, PublicPlayer>; candidate: string; theme: string; currentPlayerIndex: number; attackNumber: number; usedKana: string[]; lastAttack: { id: string; actorId: string; kana: string; hit: boolean; bonus: boolean; revealed: Record<string, number[]> } | null; winnerId: string | null };
export type State = PublicState & { secrets: Record<string, string[]>; processedActionIds: string[] };
export type PrivateState = PublicState & { myCells: string[] | null };
export function normalizeWord(input: string): string {
  const large: Record<string, string> = { 'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','ゃ':'や','ゅ':'ゆ','ょ':'よ','っ':'つ','ゎ':'わ','ゕ':'か','ゖ':'け' };
  const word = Array.from(input.normalize('NFKC').normalize('NFD').replace(/[\u3099\u309a]/g, '')).map(c => { const n = c.charCodeAt(0); return n >= 0x30a1 && n <= 0x30f6 ? String.fromCharCode(n - 0x60) : c; }).join('').normalize('NFD').replace(/[\u3099\u309a]/g, '');
  const normalized = Array.from(word).map(c => large[c] ?? c).join('');
  if (normalized.length < 2 || normalized.length > 7 || Array.from(normalized).some(c => !KANA.includes(c))) throw new Error('ひらがな・カタカナ・ーで2〜7文字を入力してください');
  return normalized;
}
export function previewWord(input: string) { return Array.from(normalizeWord(input)).concat(Array(7 - normalizeWord(input).length).fill('×')); }
export function randomTheme(previous: string, random = Math.random) { const pool = THEMES.filter(t => t !== previous); return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]; }
export function createGameState(ids: string[], random = Math.random, matchId = crypto.randomUUID()): State {
  if (ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length) throw new Error('あいうえバトルは2〜8人で遊べます');
  return { game: 'aiue-battle', matchId, revision: 0, phase: 'theme', turnOrder: ids, players: Object.fromEntries(ids.map(id => [id, { cells: Array(7).fill(null), ready: false, eliminated: false }])), candidate: randomTheme('', random), theme: '', currentPlayerIndex: 0, attackNumber: 1, usedKana: [], lastAttack: null, winnerId: null, secrets: {}, processedActionIds: [] };
}
export function toPublicState(state: State): PublicState { const { secrets, processedActionIds, ...visible } = state; void secrets; void processedActionIds; return structuredClone(visible); }
export function toPrivateState(state: State, id: string): PrivateState { if (!state.turnOrder.includes(id)) throw new Error('Room membership is required'); return { ...toPublicState(state), myCells: state.secrets[id] ? [...state.secrets[id]] : null }; }
export function applyAction(state: State, actor: string, host: string, action: string, value: unknown, id: string): State {
  if (!state.turnOrder.includes(actor)) throw new Error('Room membership is required');
  const next = structuredClone(state);
  if (action === 'reroll' || action === 'theme') {
    if (actor !== host || state.phase !== 'theme') throw new Error('ホストがお題を選択してください');
    if (action === 'reroll') next.candidate = randomTheme(state.candidate);
    else { const theme = typeof value === 'string' ? value.trim() : ''; if (!theme || theme.length > 80) throw new Error('お題を1〜80文字で入力してください'); next.theme = theme; next.phase = 'words'; }
  } else if (action === 'word') {
    if (state.phase !== 'words' || state.players[actor].ready || typeof value !== 'string') throw new Error('言葉を登録できません');
    next.secrets[actor] = previewWord(value); next.players[actor].ready = true;
    if (next.turnOrder.every(p => next.players[p].ready)) next.phase = 'playing';
  } else if (action === 'attack') {
    if (state.phase !== 'playing' || state.turnOrder[state.currentPlayerIndex] !== actor || state.players[actor].eliminated) throw new Error('あなたの手番ではありません');
    if (typeof value !== 'string' || !KANA.includes(value) || state.usedKana.includes(value)) throw new Error('未使用の文字を選んでください');
    next.usedKana.push(value);
    const revealed: Record<string, number[]> = {};
    for (const player of state.turnOrder) {
      revealed[player] = [];
      next.secrets[player].forEach((c, i) => { if (c === value && next.players[player].cells[i] === null) { next.players[player].cells[i] = c; revealed[player].push(i); } });
      next.players[player].eliminated = next.secrets[player].every((c, i) => c === '×' || next.players[player].cells[i] !== null);
    }
    const alive = next.turnOrder.filter(p => !next.players[p].eliminated);
    const hit = Object.values(revealed).some(cells => cells.length > 0);
    const bonus = alive.length > 1 && hit && state.attackNumber === 1 && !next.players[actor].eliminated;
    next.lastAttack = { id, actorId: actor, kana: value, hit, bonus, revealed };
    if (alive.length <= 1) { next.phase = 'finished'; next.winnerId = alive[0] ?? null; }
    else if (bonus) next.attackNumber = 2;
    else { next.attackNumber = 1; do { next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.turnOrder.length; } while (next.players[next.turnOrder[next.currentPlayerIndex]].eliminated); }
  } else throw new Error('Unsupported action');
  next.revision++; next.processedActionIds.push(id); return next;
}
