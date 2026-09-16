import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';

export function TurnOrder({ players, gameState }: { players: Player[]; gameState: FakeArtistGameState }) {
  const { turnOrder, currentTurnPlayerId, playerStates } = gameState;
  const orderedIds = [...turnOrder, ...players.filter(player => !turnOrder.includes(player.userId)).map(player => player.userId)];

  return (
    <ol aria-label="描画順とプレイヤー色" className="grid grid-cols-4 gap-1 text-left">
      {orderedIds.map((id, index) => {
        const player = players.find(player => player.userId === id);
        const isCurrent = id === currentTurnPlayerId;
        const draws = index < turnOrder.length;
        const name = player?.name || '退出したプレイヤー';
        const label = draws ? `${index + 1}. ${name}${isCurrent ? '（いまの番）' : ''}` : `${name}（出題者 / 描画なし）`;
        return (
          <li key={id} aria-current={isCurrent ? 'step' : undefined} aria-label={label} title={label}
            className={`flex min-w-0 items-center gap-1 rounded-md border-2 px-1 py-1.5 text-[11px] sm:text-xs ${!draws ? 'col-span-2' : ''} ${isCurrent ? 'border-indigo-500 bg-indigo-500/15 font-black' : 'border-transparent bg-slate-800 font-medium'}`}>
            <span className="shrink-0" aria-hidden="true">{draws ? `${isCurrent ? '▶' : ''}${index + 1}` : '－'}</span>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: playerStates[id]?.color || player?.color }} aria-hidden="true" />
            <span className="min-w-0 truncate">
              {name}
              {!draws && <span className="block truncate text-[9px] text-slate-400">出題者 / 描画なし</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
