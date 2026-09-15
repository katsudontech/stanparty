export const REACTION_PRESETS = [
  { emoji: '👏', label: '拍手' },
  { emoji: '😂', label: '笑った' },
  { emoji: '👍', label: 'ナイス' },
  { emoji: '😮', label: 'びっくり' },
  { emoji: '🤔', label: '考え中' },
  { emoji: '🎉', label: 'おめでとう' },
] as const;

export const REACTION_EMOJIS = REACTION_PRESETS.map(({ emoji }) => emoji) as [string, ...string[]];
export type ReactionEmoji = (typeof REACTION_PRESETS)[number]['emoji'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateReactionBody(value: unknown): { roomId: string; emoji: ReactionEmoji } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (typeof body.roomId !== 'string' || !UUID_RE.test(body.roomId)) return null;
  if (typeof body.emoji !== 'string' || !REACTION_EMOJIS.includes(body.emoji)) return null;
  return { roomId: body.roomId, emoji: body.emoji as ReactionEmoji };
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const FRESHNESS_MS = 15_000;
const SENDER_INTERVAL_MS = 1_000;
const MAX_RECEIVED = 128;
export interface ReactionPayload {
  id: string;
  emoji: ReactionEmoji;
  label: string;
  senderId: string;
  senderName: string;
  sentAt: number;
}

export function parseReactionPayload(value: unknown, now = Date.now()): ReactionPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const preset = REACTION_PRESETS.find((reaction) => reaction.emoji === payload.emoji);
  if (typeof payload.id !== 'string' || payload.id.length < 8 || payload.id.length > 80 || !preset
    || typeof payload.senderId !== 'string' || payload.senderId.length < 1 || payload.senderId.length > 128
    || typeof payload.senderName !== 'string' || payload.senderName.length < 1 || payload.senderName.length > 80
    || typeof payload.sentAt !== 'number' || !Number.isSafeInteger(payload.sentAt) || Math.abs(now - payload.sentAt) > FRESHNESS_MS) return null;
  return { id: payload.id, emoji: preset.emoji, label: preset.label, senderId: payload.senderId, senderName: payload.senderName, sentAt: payload.sentAt };
}

export class ReactionInbox {
  private readonly seenIds: string[] = [];
  private readonly senderTimes = new Map<string, number[]>();

  reset() { this.seenIds.length = 0; this.senderTimes.clear(); }

  accept(value: unknown, players: Array<{ userId: string; name: string }>, now = Date.now()): ReactionPayload | null {
    const reaction = parseReactionPayload(value, now);
    if (!reaction || this.seenIds.includes(reaction.id)) return null;
    const player = players.find((entry) => entry.userId === reaction.senderId);
    if (!player || player.name !== reaction.senderName) return null;
    const times = (this.senderTimes.get(reaction.senderId) ?? []).filter((time) => reaction.sentAt - time < 60_000);
    if (times.some((time) => reaction.sentAt - time < SENDER_INTERVAL_MS)) return null;
    times.push(reaction.sentAt);
    times.splice(0, Math.max(0, times.length - 32));
    this.senderTimes.set(reaction.senderId, times);
    if (this.senderTimes.size > 64) {
      const oldest = [...this.senderTimes.entries()].sort((a, b) => a[1][0] - b[1][0])[0]?.[0];
      if (oldest) this.senderTimes.delete(oldest);
    }
    this.seenIds.push(reaction.id);
    if (this.seenIds.length > MAX_RECEIVED) this.seenIds.shift();
    return reaction;
  }
}

export class ReactionToastQueue {
  private items: ReactionPayload[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly notify: (items: ReactionPayload[]) => void) {}

  add(reaction: ReactionPayload) {
    const next = [...this.items, reaction].slice(-3);
    for (const item of this.items) {
      if (!next.some((entry) => entry.id === item.id)) this.cancel(item.id);
    }
    this.items = next;
    this.notify([...this.items]);
    this.timers.set(reaction.id, setTimeout(() => {
      this.timers.delete(reaction.id);
      this.items = this.items.filter((item) => item.id !== reaction.id);
      this.notify([...this.items]);
    }, 3_000));
  }

  clear(notify = true) {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.items = [];
    if (notify) this.notify([]);
  }

  private cancel(id: string) {
    const timer = this.timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(id);
  }
}
