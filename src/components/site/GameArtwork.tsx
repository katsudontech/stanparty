import type { PlayableGameId } from '@/games/catalog';

interface GameArtworkProps {
  gameId: PlayableGameId;
  className?: string;
}

export function GameArtwork({ gameId, className = '' }: GameArtworkProps) {
  if (gameId === 'fake-artist') {
    return (
      <svg className={className} viewBox="0 0 240 180" role="img" aria-label="絵筆とキャンバスのイラスト">
        <path d="M33 145c42-25 79-7 109-35 19-18 23-46 51-62" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <path d="M39 54h111v79H39z" fill="#fffaf0" stroke="currentColor" strokeWidth="5" />
        <path d="m70 104 21-22 18 14 18-27" fill="none" stroke="#e85d3f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m164 123 37-73 13 7-37 73z" fill="#f3c85b" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="m163 124-5 24 19-16z" fill="#e85d3f" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M62 145h99" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  if (gameId === 'coyote') {
    return (
      <svg className={className} viewBox="0 0 240 180" role="img" aria-label="数字カードとコヨーテのイラスト">
        <path d="m68 44-24-20 3 41m125-21 24-20-3 41" fill="#d79a24" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M48 77c0-29 32-50 72-50s72 21 72 50v49c0 20-32 34-72 34s-72-14-72-34z" fill="#f2dfa8" stroke="currentColor" strokeWidth="5" />
        <path d="M81 96h1m76 0h1" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="m105 119 15 11 15-11" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="85" y="8" width="70" height="75" rx="6" fill="#fffaf0" stroke="currentColor" strokeWidth="5" transform="rotate(3 120 45)" />
        <text x="120" y="61" textAnchor="middle" fontSize="37" fontWeight="900" fill="#d79a24">?</text>
      </svg>
    );
  }

  if (gameId === 'ai-barenai') {
    return (
      <svg className={className} viewBox="0 0 240 180" role="img" aria-label="AIと吹き出しのイラスト">
        <rect x="46" y="30" width="148" height="112" rx="18" fill="#e4d8fa" stroke="currentColor" strokeWidth="5" />
        <circle cx="91" cy="81" r="12" fill="#8b5cf6" /><circle cx="149" cy="81" r="12" fill="#8b5cf6" />
        <path d="M86 111c18 12 40 12 58 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M37 58H16v47h21l19 17V41z" fill="#fffaf0" stroke="currentColor" strokeWidth="5" />
        <text x="27" y="91" textAnchor="middle" fontSize="24" fontWeight="900" fill="#8b5cf6">?</text>
      </svg>
    );
  }

  if (gameId === 'ai-barenai-drawing') {
    return (
      <svg className={className} viewBox="0 0 240 180" role="img" aria-label="AIにバレるな！お絵かき版のイラスト">
        <rect x="45" y="25" width="125" height="125" fill="#fffaf0" stroke="currentColor" strokeWidth="5" />
        <path d="M65 117c25-32 37-8 53-36 12-21 21-18 38-37" fill="none" stroke="#ef6c4d" strokeWidth="7" strokeLinecap="round" />
        <path d="m174 131 35-77 12 6-35 77z" fill="#f3c85b" stroke="currentColor" strokeWidth="4" />
        <path d="m173 131-4 22 18-16z" fill="#ef6c4d" stroke="currentColor" strokeWidth="4" />
        <circle cx="190" cy="34" r="20" fill="#f8ded3" stroke="currentColor" strokeWidth="4" />
        <text x="190" y="42" textAnchor="middle" fontSize="22" fontWeight="900" fill="#ef6c4d">?</text>
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 240 180" role="img" aria-label="糸でつながった数字のイラスト">
      <path d="M25 115c20-70 56-70 73-18s42 50 56 6 36-56 61-12" fill="none" stroke="#3978a8" strokeWidth="7" strokeLinecap="round" />
      <circle cx="45" cy="77" r="25" fill="#fffaf0" stroke="currentColor" strokeWidth="5" />
      <circle cx="118" cy="124" r="28" fill="#fffaf0" stroke="currentColor" strokeWidth="5" />
      <circle cx="190" cy="63" r="30" fill="#fffaf0" stroke="currentColor" strokeWidth="5" />
      <text x="45" y="85" textAnchor="middle" fontSize="23" fontWeight="900" fill="currentColor">12</text>
      <text x="118" y="132" textAnchor="middle" fontSize="23" fontWeight="900" fill="currentColor">54</text>
      <text x="190" y="71" textAnchor="middle" fontSize="23" fontWeight="900" fill="currentColor">91</text>
    </svg>
  );
}
