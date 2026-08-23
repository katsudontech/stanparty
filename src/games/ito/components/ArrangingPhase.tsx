'use client';

import { useMemo, useState } from 'react';

import type { Player } from '@/games/core/types';

import { moveCardInOrder } from '../rules';
import type { ItoCard, ItoGameState } from '../types';

interface SecretCardProps {
  card: ItoCard;
  isPlaced: boolean;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onSaveHint: (hint: string) => Promise<void>;
}

function SecretCard({
  card,
  isPlaced,
  isSelected,
  disabled,
  onSelect,
  onSaveHint,
}: SecretCardProps) {
  const [hint, setHint] = useState(card.hint);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSaveHint = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveHint(hint);
      setMessage('保存しました');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className={`rounded-3xl border p-5 text-left transition ${isSelected ? 'border-cyan-300 bg-cyan-400/15 shadow-[0_0_24px_-10px_rgba(34,211,238,0.9)]' : 'border-white/10 bg-slate-900'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">カード{card.ownerCardNumber}</p>
          <p className="mt-1 text-5xl font-black text-white">{card.value}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${isPlaced ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
          {isPlaced ? '配置済み' : '手元'}
        </span>
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-xs font-bold text-slate-400">たとえ（任意）</span>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={100}
            value={hint}
            onChange={(event) => {
              setHint(event.target.value);
              setMessage(null);
            }}
            placeholder="口頭だけでもOK"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={handleSaveHint}
            disabled={saving || disabled || hint === card.hint}
            className="rounded-xl border border-white/10 bg-slate-800 px-4 text-sm font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </label>

      {message && <p className="mt-2 text-xs font-bold text-slate-400">{message}</p>}

      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={`mt-4 w-full rounded-xl px-4 py-3 font-black transition disabled:opacity-40 ${isSelected ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
      >
        {isSelected ? '選択中：置き場所を選んでください' : isPlaced ? 'このカードを並べ替える' : 'このカードを並べる'}
      </button>
    </article>
  );
}

interface ArrangingPhaseProps {
  gameState: ItoGameState;
  players: Player[];
  myUserId: string;
  isHost: boolean;
  onSetHint: (cardId: string, hint: string) => Promise<void>;
  onMoveCard: (cardId: string, targetIndex: number) => Promise<void>;
  onSetReady: (isReady: boolean) => Promise<void>;
  onStartShowdown: () => Promise<void>;
}

export function ArrangingPhase({
  gameState,
  players,
  myUserId,
  isHost,
  onSetHint,
  onMoveCard,
  onSetReady,
  onStartShowdown,
}: ArrangingPhaseProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cardsById = useMemo(
    () => new Map(gameState.cards.map((card) => [card.id, card])),
    [gameState.cards],
  );
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.userId, player])),
    [players],
  );
  const myCards = gameState.cards
    .filter((card) => card.ownerId === myUserId)
    .sort((left, right) => left.ownerCardNumber - right.ownerCardNumber);
  const allCardsPlaced = gameState.cardOrder.length === gameState.cards.length;
  const isReady = gameState.readyPlayerIds.includes(myUserId);
  const allPlayersReady = gameState.roundPlayerIds.every((playerId) =>
    gameState.readyPlayerIds.includes(playerId),
  );

  const runAction = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await action();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '操作に失敗しました');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveToSlot = async (slotIndex: number) => {
    if (!selectedCardId) return;

    const currentIndex = gameState.cardOrder.indexOf(selectedCardId);
    const targetIndex = currentIndex >= 0 && currentIndex < slotIndex
      ? slotIndex - 1
      : slotIndex;
    const nextOrder = moveCardInOrder(gameState.cardOrder, selectedCardId, targetIndex);

    if (nextOrder.every((cardId, index) => cardId === gameState.cardOrder[index])) {
      setSelectedCardId(null);
      return;
    }

    const succeeded = await runAction(() => onMoveCard(selectedCardId, targetIndex));
    if (succeeded) setSelectedCardId(null);
  };

  return (
    <section className="space-y-8">
      <div className="sticky top-0 z-20 rounded-2xl border border-fuchsia-400/20 bg-slate-950/95 p-4 shadow-xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">お題</p>
        <h2 className="mt-1 text-2xl font-black text-white">{gameState.selectedTheme}</h2>
      </div>

      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Your cards</p>
            <h3 className="mt-1 text-2xl font-black text-white">あなたの数字</h3>
          </div>
          <span className="text-sm font-bold text-slate-400">他の人には内緒</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {myCards.map((card) => (
            <SecretCard
              key={card.id}
              card={card}
              isPlaced={gameState.cardOrder.includes(card.id)}
              isSelected={selectedCardId === card.id}
              disabled={submitting}
              onSelect={() => setSelectedCardId((current) => current === card.id ? null : card.id)}
              onSaveHint={(hint) => onSetHint(card.id, hint)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">Shared board</p>
            <h3 className="mt-1 text-2xl font-black text-white">みんなで並べる</h3>
          </div>
          <span className="text-sm font-black text-slate-400">
            {gameState.cardOrder.length}/{gameState.cards.length}枚
          </span>
        </div>

        {selectedCardId ? (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-cyan-400/10 p-4 text-left text-sm font-bold text-cyan-100">
            <span>「ここに置く」を押して位置を決めてください</span>
            <button
              type="button"
              onClick={() => setSelectedCardId(null)}
              className="shrink-0 rounded-lg bg-slate-950/50 px-3 py-2 text-xs"
            >
              選択解除
            </button>
          </div>
        ) : (
          <p className="mb-5 rounded-2xl bg-slate-950/60 p-4 text-sm font-bold text-slate-400">
            自分の手札か、配置済みカードを選択してください。
          </p>
        )}

        <div className="mx-auto max-w-xl">
          <div className="mb-2 text-center text-xl font-black text-cyan-300">1</div>
          {Array.from({ length: gameState.cardOrder.length + 1 }, (_, slotIndex) => {
            const cardId = gameState.cardOrder[slotIndex];
            const card = cardId ? cardsById.get(cardId) : undefined;
            const owner = card ? playersById.get(card.ownerId) : undefined;

            return (
              <div key={`slot-${slotIndex}`}>
                <button
                  type="button"
                  onClick={() => handleMoveToSlot(slotIndex)}
                  disabled={!selectedCardId || submitting}
                  className="my-2 w-full rounded-xl border border-dashed border-cyan-400/30 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/10 disabled:border-slate-700 disabled:text-slate-700"
                >
                  ＋ ここに置く
                </button>

                {card && (
                  <button
                    type="button"
                    onClick={() => setSelectedCardId((current) => current === card.id ? null : card.id)}
                    disabled={submitting}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedCardId === card.id ? 'border-cyan-300 bg-cyan-400/15' : 'border-white/10 bg-slate-950 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-white"
                        style={{ backgroundColor: owner?.color ?? '#475569' }}
                      >
                        {owner?.name?.charAt(0) ?? '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-white">
                          {owner?.name ?? '退出したプレイヤー'}・カード{card.ownerCardNumber}
                        </p>
                        <p className="truncate text-sm text-slate-400">
                          {card.hint || 'たとえは口頭で共有'}
                        </p>
                      </div>
                      <span className="text-2xl" aria-label="裏向きのカード">🂠</span>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
          <div className="mt-2 text-center text-xl font-black text-fuchsia-300">100</div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-black text-white">完成確認</p>
          <p className="text-sm font-bold text-slate-400">
            {gameState.readyPlayerIds.length}/{gameState.roundPlayerIds.length}人
          </p>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {gameState.roundPlayerIds.map((playerId) => {
            const player = playersById.get(playerId);
            const ready = gameState.readyPlayerIds.includes(playerId);
            return (
              <span
                key={playerId}
                className={`rounded-full px-3 py-1 text-xs font-black ${ready ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}
              >
                {ready ? '✓ ' : ''}{player?.name ?? '退出済み'}
              </span>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => runAction(() => onSetReady(!isReady))}
          disabled={!allCardsPlaced || submitting}
          className={`w-full rounded-2xl px-5 py-4 font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${isReady ? 'bg-slate-700 text-slate-200' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}
        >
          {isReady ? '完成確認を取り消す' : allCardsPlaced ? 'この並びで完成' : '全カードを配置してください'}
        </button>

        {isHost && (
          <button
            type="button"
            onClick={() => runAction(onStartShowdown)}
            disabled={!allPlayersReady || !allCardsPlaced || submitting}
            className="mt-3 w-full rounded-2xl bg-fuchsia-500 px-5 py-4 text-lg font-black text-white hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ショーダウン開始
          </button>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-300">{errorMessage}</p>
        )}
      </div>
    </section>
  );
}
