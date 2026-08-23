import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { GameCatalogEntry } from '@/games/catalog';
import { GameArtwork } from '@/components/site/GameArtwork';

interface GameCardProps {
  game: GameCatalogEntry;
  index?: number;
}

export function GameCard({ game, index }: GameCardProps) {
  return (
    <article className="game-card" style={{ '--game-accent': game.accent, '--game-soft': game.softColor } as CSSProperties}>
      <div className="game-card__topline">
        <span>{index ? String(index).padStart(2, '0') : game.mood}</span>
        <span>{game.duration}</span>
      </div>
      <GameArtwork gameId={game.id} className="game-card__art" />
      <div className="game-card__body">
        <p className="game-card__mood">{game.mood}</p>
        <h3>{game.shortName}</h3>
        <p>{game.summary}</p>
        <dl className="game-facts">
          <div><dt>人数</dt><dd>{game.players}</dd></div>
          <div><dt>難しさ</dt><dd>{game.difficulty}</dd></div>
        </dl>
        <Link href={`/games/${game.id}`} className="text-link">
          ルールと面白さを見る <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
