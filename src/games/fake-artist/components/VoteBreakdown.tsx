import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';

export function VoteBreakdown({ players, gameState }: { players: Player[]; gameState: FakeArtistGameState }) {
  const entries = Object.entries(gameState.votes);
  const renderPlayer = (id: string) => {
    const player = players.find(player => player.userId === id);
    return (
      <span className="flex min-w-0 items-center gap-1.5" title={player?.name || '退出したプレイヤー'}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: gameState.playerStates[id]?.color || player?.color || '#64748b' }} aria-hidden="true" />
        <span className="truncate">{player?.name || '退出したプレイヤー'}</span>
      </span>
    );
  };
  return (
    <section aria-label="投票結果" className="w-full text-left">
      <h4 className="mb-2 text-sm font-bold text-slate-200">投票結果</h4>
      {entries.length ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {entries.map(([voter, target]) => (
            <li key={voter} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded bg-slate-800 px-2 py-1.5 text-xs">
              {renderPlayer(voter)}<span aria-label="の投票先">→</span>{renderPlayer(target)}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-400">投票の記録がありません</p>}
    </section>
  );
}
