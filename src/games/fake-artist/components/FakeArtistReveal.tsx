import { Avatar } from '@/components/shared/Avatar';
import type { Player } from '@/games/core/types';
import type { FakeArtistGameState } from '../types';

export function FakeArtistReveal({ players, gameState }: { players: Player[]; gameState: FakeArtistGameState }) {
  const id = Object.keys(gameState.playerStates).find(id => gameState.playerStates[id].role === 'fake_artist');
  if (!id) return null;
  const player = players.find(player => player.userId === id);
  const name = player?.name || '退出したプレイヤー';
  const color = gameState.playerStates[id].color || player?.color;
  return (
    <div className="flex w-full items-center justify-center gap-3 rounded-lg border border-orange-500/50 bg-orange-500/10 p-3">
      <Avatar avatarUrl={player?.avatarUrl} name={name} color={color} size="sm" decorative />
      <p className="min-w-0 text-left text-sm font-bold">
        <span className="block text-xs text-slate-400">エセ芸術家は</span>
        <span className="break-all text-orange-400">{name}さんでした</span>
      </p>
    </div>
  );
}
