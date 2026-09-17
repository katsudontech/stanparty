'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import { createClient } from '../../lib/supabase/client';
import { authenticateRealtime } from '../../lib/supabase/realtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player } from '../../games/core/types';
import { REACTION_PRESETS, ReactionInbox, ReactionToastQueue, type ReactionEmoji, type ReactionPayload } from '../../lib/roomReactionsProtocol';
export { REACTION_PRESETS } from '../../lib/roomReactionsProtocol';
export type { ReactionEmoji } from '../../lib/roomReactionsProtocol';
export type ReceivedReaction = ReactionPayload;

const SENDER_INTERVAL_MS = 1_000;
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify); };
};
export { parseReactionPayload } from '../../lib/roomReactionsProtocol';

/** Stateless-per-connection inbox: broadcasts are ephemeral and never replayed from storage. */
export { ReactionInbox } from '../../lib/roomReactionsProtocol';
export { ReactionToastQueue } from '../../lib/roomReactionsProtocol';

interface ReactionsContextValue {
  received: ReceivedReaction[];
  sendReaction: (emoji: ReactionEmoji) => Promise<void>;
  canSend: boolean;
  sending: boolean;
  online: boolean;
  connected: boolean;
  error: string | null;
}

const ReactionsContext = createContext<ReactionsContextValue | null>(null);

interface ProviderProps {
  roomId: string;
  myUserId: string;
  players: Player[];
  children?: ReactNode;
}

export async function openRoomReactionSubscription(
  supabase: SupabaseClient,
  roomId: string,
  myUserId: string,
  onPayload: (payload: unknown) => void,
  onStatus: (status: string) => void,
  authenticate: (client: SupabaseClient, userId: string) => Promise<void> = authenticateRealtime,
  isActive: () => boolean = () => true,
): Promise<{ channel: ReturnType<SupabaseClient['channel']> | null; unsubscribe: () => void }> {
  await authenticate(supabase, myUserId);
  if (!isActive()) return { channel: null, unsubscribe: () => {} };
  const channel = supabase
    .channel(`room-reactions:${roomId}:${myUserId}`, { config: { private: true } })
    .on('broadcast', { event: 'reaction' }, ({ payload }) => onPayload(payload))
    .subscribe(onStatus);
  return { channel, unsubscribe: () => { void supabase.removeChannel(channel); } };
}

export function getReactionMenuIndex(current: number, length: number, key: string): number | null {
  if (length < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (current + 1 + length) % length;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (current - 1 + length) % length;
  return null;
}

export function RoomReactionsProvider({ roomId, myUserId, players, children }: ProviderProps) {
  const [received, setReceived] = useState<ReceivedReaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
  const [cooldown, setCooldown] = useState(false);
  const [sending, setSending] = useState(false);
  const playersRef = useRef(players);
  const inboxRef = useRef(new ReactionInbox());
  const lastSentAtRef = useRef(-Infinity);
  const cooldownTimerRef = useRef<number | null>(null);
  const toastQueueRef = useRef<ReactionToastQueue | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestTimeoutRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const connectedRef = useRef(false);
  const connectionStartedAtRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  if (toastQueueRef.current == null) toastQueueRef.current = new ReactionToastQueue(setReceived);

  useEffect(() => { playersRef.current = players; }, [players]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let observedHeader: HTMLElement | null = null;
    const updateOverlayPosition = () => {
      const header = root.querySelector<HTMLElement>('[data-room-header]') ?? root.querySelector<HTMLElement>('header');
      if (header) root.style.setProperty('--room-reaction-overlay-top', `${Math.ceil(header.getBoundingClientRect().bottom + 8)}px`);
    };
    updateOverlayPosition();
    let resizeObserver: ResizeObserver | null = null;
    const refreshPosition = () => {
      const header = root.querySelector<HTMLElement>('[data-room-header]') ?? root.querySelector<HTMLElement>('header');
      if (header !== observedHeader) {
        if (observedHeader) resizeObserver?.unobserve(observedHeader);
        observedHeader = header;
        if (header) resizeObserver?.observe(header);
      }
      updateOverlayPosition();
    };
    resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshPosition);
    const observer = new MutationObserver(refreshPosition);
    observer.observe(root, { childList: true, subtree: true });
    refreshPosition();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', refreshPosition);
    window.addEventListener('scroll', refreshPosition, true);
    window.addEventListener('resize', refreshPosition);
    return () => { observer.disconnect(); resizeObserver?.disconnect(); viewport?.removeEventListener('resize', refreshPosition); window.removeEventListener('scroll', refreshPosition, true); window.removeEventListener('resize', refreshPosition); };
  }, []);

  useEffect(() => {
    inboxRef.current.reset();
    let mounted = true;
    mountedRef.current = true;
    let unsubscribe: (() => void) | null = null;
    const supabase = createClient();

    const connect = async () => {
      const subscription = await openRoomReactionSubscription(supabase, roomId, myUserId,
        (payload) => {
          if (!mounted || !connectedRef.current || !isOnline()) return;
          const reaction = inboxRef.current.accept(payload, playersRef.current);
          if (!reaction || reaction.sentAt < connectionStartedAtRef.current) return;
          toastQueueRef.current?.add(reaction);
        }, (status) => {
          if (!mounted) return;
          if (status === 'SUBSCRIBED') {
            connectionStartedAtRef.current = Date.now();
            inboxRef.current.reset();
            toastQueueRef.current?.clear();
            connectedRef.current = true;
            setConnected(true);
            setError(null);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            connectedRef.current = false;
            setConnected(false);
            setError('リアクションを受信できません。通信状況を確認してください。');
          }
        }, authenticateRealtime, () => mounted);
      if (!mounted) { subscription.unsubscribe(); return; }
      unsubscribe = subscription.unsubscribe;
    };
    void connect().catch(() => { if (mounted) setError('リアクションを受信できません。通信状況を確認してください。'); });

    return () => {
      mounted = false;
      mountedRef.current = false;
      connectedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      if (requestTimeoutRef.current !== null) window.clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
      sendInFlightRef.current = false;
      if (cooldownTimerRef.current !== null) window.clearTimeout(cooldownTimerRef.current);
      toastQueueRef.current?.clear(false);
      unsubscribe?.();
    };
  }, [myUserId, roomId]);

  const sendReaction = useCallback(async (emoji: ReactionEmoji) => {
    const now = Date.now();
    if (!isOnline()) {
      if (mountedRef.current) setError('リアクションを送信できません。オフラインです。');
      return;
    }
    if (!connectedRef.current || sendInFlightRef.current || now - lastSentAtRef.current < SENDER_INTERVAL_MS) {
      if (!connectedRef.current && mountedRef.current) setError('リアクションを受信できません。通信状況を確認してください。');
      return;
    }
    lastSentAtRef.current = now;
    setCooldown(true);
    if (cooldownTimerRef.current !== null) window.clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = window.setTimeout(() => { if (mountedRef.current) setCooldown(false); }, SENDER_INTERVAL_MS);
    const controller = new AbortController();
    sendInFlightRef.current = true;
    setSending(true);
    requestRef.current = controller;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!mountedRef.current || controller.signal.aborted) return;
      if (!session?.access_token) throw new Error('session');
      requestTimeoutRef.current = window.setTimeout(() => controller.abort(), 5_000);
      const response = await fetch('/api/room-reactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ roomId, emoji }),
        signal: controller.signal,
      }).finally(() => {
        if (requestTimeoutRef.current !== null) window.clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      if (!response.ok) throw new Error('request');
      setError(null);
    } catch {
      if (mountedRef.current) setError('リアクションを送信できませんでした。通信状況を確認してください。');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      sendInFlightRef.current = false;
      if (mountedRef.current) setSending(false);
    }
  }, [roomId]);

  const canSend = connected && online && !cooldown && !sending;
  const value = useMemo(() => ({ received, sendReaction, canSend, sending, online, connected, error }), [sending, canSend, connected, error, online, received, sendReaction]);
  return <ReactionsContext.Provider value={value}><div ref={rootRef} className="room-reactions-root">{children}<ReactionOverlay reactions={received} /></div></ReactionsContext.Provider>;
}

export function useRoomReactions() {
  const context = useContext(ReactionsContext);
  if (!context) throw new Error('useRoomReactions must be used within RoomReactionsProvider');
  return context;
}

export function RoomReactionHeaderActions() {
  const { sendReaction, canSend, sending, online: onlineStatus, connected: connectedStatus, error } = useRoomReactions();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current && restoreFocusRef.current) buttonRef.current?.focus();
      wasOpenRef.current = false;
      restoreFocusRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const closeOnOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        restoreFocusRef.current = !(event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [tabindex], [contenteditable]'));
        setOpen(false);
      }
    };
    const closeOnFocusLeave = (event: FocusEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { restoreFocusRef.current = true; setOpen(false); } };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('focusin', closeOnFocusLeave);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); document.removeEventListener('focusin', closeOnFocusLeave); };
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (!buttons.length) return;
    const next = getReactionMenuIndex(current, buttons.length, event.key);
    if (next !== null) { event.preventDefault(); buttons[next]?.focus(); }
  };

  const statusMessage = sending ? '送信中…' : !onlineStatus ? 'オフライン' : !connectedStatus ? '接続中…' : null;
  return <div className="room-reaction-control relative shrink-0">
    <button ref={buttonRef} type="button" className="button-secondary min-h-11 min-w-11 px-3 text-xl" aria-label="リアクションを送る" aria-expanded={open} onClick={() => setOpen((value) => !value)}>😊</button>
    {open && <div ref={menuRef} onKeyDown={handleMenuKeyDown} className="room-reaction-menu absolute right-0 top-[calc(100%+8px)] z-50 grid w-56 grid-cols-2 gap-2 border-2 border-[var(--line)] bg-[var(--surface)] p-2 shadow-[4px_4px_0_var(--line)]" role="group" aria-label="リアクション一覧">
      {REACTION_PRESETS.map((reaction) => <button key={reaction.emoji} type="button" disabled={!canSend} className="min-h-11 border-2 border-[var(--line)] bg-white px-2 py-2 text-left text-sm font-black disabled:cursor-wait disabled:opacity-50" onClick={() => { restoreFocusRef.current = true; setOpen(false); void sendReaction(reaction.emoji); }}><span className="mr-1 text-xl" aria-hidden="true">{reaction.emoji}</span>{reaction.label}</button>)}
    </div>}
    {statusMessage && <span className="room-reaction-status mt-1 block text-right text-[10px] font-black text-[var(--muted)]" role="status">{statusMessage}</span>}
    {error && <span className="room-reaction-error absolute right-0 top-[calc(100%+8px)] z-40 mt-14 w-56 border-2 border-[var(--orange)] bg-[#fff0e6] p-2 text-xs font-black text-[#9f3d26]" role="alert">{error}</span>}
  </div>;
}

function ReactionOverlay({ reactions }: { reactions: ReceivedReaction[] }) {
  return <div className="room-reaction-overlay" aria-live="polite" aria-atomic="false">{reactions.map((reaction) => <div key={reaction.id} className="room-reaction-toast" role="status"><span className="text-2xl" aria-hidden="true">{reaction.emoji}</span><span><strong>{reaction.senderName}</strong><small>{reaction.label}</small></span></div>)}</div>;
}
