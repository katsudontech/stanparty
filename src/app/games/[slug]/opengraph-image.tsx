import { ImageResponse } from 'next/og';
import { GAME_CATALOG, getGameById } from '@/games/catalog';
import { SITE_ORIGIN } from '@/lib/site';

export const alt = 'StanPartyのゲーム紹介画像';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type ImageProps = {
  params: Promise<{ slug: string }>;
};

function GameMark({ gameId, accent }: { gameId: string; accent: string }) {
  if (gameId === 'coyote') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ width: 0, height: 0, borderLeft: '28px solid transparent', borderRight: '28px solid transparent', borderBottom: `42px solid ${accent}` }} />
          <div style={{ width: 0, height: 0, borderLeft: '28px solid transparent', borderRight: '28px solid transparent', borderBottom: `42px solid ${accent}` }} />
        </div>
        <div style={{ display: 'flex', width: 190, height: 150, alignItems: 'center', justifyContent: 'center', border: '5px solid #26372e', borderRadius: 16, background: '#fffaf0', color: accent, fontSize: 92, fontWeight: 900 }}>?</div>
      </div>
    );
  }

  if (gameId === 'ito') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {[12, 54, 91].map((number, index) => (
          <div key={number} style={{ display: 'flex', width: 92, height: 92, alignItems: 'center', justifyContent: 'center', border: '5px solid #26372e', borderRadius: 999, background: '#fffaf0', color: accent, fontSize: 30, fontWeight: 900, transform: `translateY(${index === 1 ? 35 : index === 2 ? -24 : 0}px)` }}>{number}</div>
        ))}
      </div>
    );
  }

  if (gameId === 'ai-barenai') {
    return (
      <div style={{ display: 'flex', width: 260, height: 170, alignItems: 'center', justifyContent: 'center', border: '5px solid #26372e', borderRadius: 28, background: '#fffaf0', color: accent, fontSize: 70, fontWeight: 900 }}>AI?</div>
    );
  }

  if (gameId === 'ai-barenai-drawing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', width: 170, height: 150, alignItems: 'center', justifyContent: 'center', border: '5px solid #26372e', background: '#fffaf0', color: accent, fontSize: 42, fontWeight: 900 }}>DRAW</div>
        <div style={{ display: 'flex', width: 38, height: 170, border: '5px solid #26372e', borderRadius: 10, background: '#f3c85b', transform: 'rotate(35deg)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <div style={{ display: 'flex', width: 190, height: 150, alignItems: 'center', justifyContent: 'center', border: '5px solid #26372e', background: '#fffaf0', color: accent, fontSize: 45, fontWeight: 900 }}>ART</div>
      <div style={{ display: 'flex', width: 42, height: 170, border: '5px solid #26372e', borderRadius: 9, background: '#f3c85b', transform: 'rotate(35deg)' }} />
    </div>
  );
}

export default async function OpenGraphImage({ params }: ImageProps) {
  const { slug } = await params;
  const game = getGameById(slug) ?? GAME_CATALOG[0];
  const siteOrigin = SITE_ORIGIN.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', border: '4px solid #26372e', background: '#f4f0e6', color: '#17231d', fontFamily: 'sans-serif' }}>
        <div style={{ width: 700, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '66px 0 62px 78px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', width: 66, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: '#17231d', boxShadow: '7px 7px 0 #e85d3f', color: '#fffaf0', fontSize: 23, fontWeight: 900 }}>SP</div>
            <div style={{ display: 'flex', fontSize: 31, fontWeight: 900 }}>StanParty</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 610 }}>
            <div style={{ display: 'flex', color: game.accent, fontSize: 23, fontWeight: 900, letterSpacing: 2 }}>Web版 GAME GUIDE</div>
            <div style={{ display: 'flex', marginTop: 13, fontSize: game.seo.heading.length > 15 ? 45 : 55, fontWeight: 900, lineHeight: 1.12 }}>{game.seo.heading}</div>
            <div style={{ display: 'flex', marginTop: 21, color: '#657068', fontSize: 22, fontWeight: 700 }}>スマホ・ブラウザですぐ遊べる</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', padding: '9px 15px', border: '2px solid #26372e', borderRadius: 99, background: '#fffaf0', fontSize: 16, fontWeight: 900 }}>{game.players}</div>
            <div style={{ display: 'flex', color: '#657068', fontSize: 18, fontWeight: 700 }}>{game.mood}</div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: 70, top: 72, display: 'flex', width: 390, height: 390, alignItems: 'center', justifyContent: 'center', border: '5px solid #26372e', borderRadius: 28, background: game.softColor, transform: 'rotate(2deg)' }}>
          <GameMark gameId={game.id} accent={game.accent} />
        </div>
        <div style={{ position: 'absolute', right: 82, bottom: 62, display: 'flex', color: '#657068', fontSize: 18, fontWeight: 700 }}>StanParty　{siteOrigin}</div>
      </div>
    ),
    size,
  );
}
