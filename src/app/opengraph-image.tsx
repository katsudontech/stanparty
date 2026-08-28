import { ImageResponse } from 'next/og';

export const alt = 'StanParty - 待ち時間を、遊ぶ時間に。';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const cards = [
  { label: '01', color: '#f3c85b', rotate: '-7deg', x: 760, y: 76 },
  { label: '02', color: '#7ea8c4', rotate: '5deg', x: 900, y: 180 },
  { label: '03', color: '#e85d3f', rotate: '-2deg', x: 720, y: 325 },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', overflow: 'hidden', color: '#17231d', background: '#f4f0e6', fontFamily: 'sans-serif' }}>
        <div style={{ position: 'absolute', inset: 28, display: 'flex', border: '4px solid #26372e' }} />

        <div style={{ width: 700, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '76px 0 68px 78px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 76, height: 66, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fffaf0', background: '#17231d', borderRadius: 7, boxShadow: '8px 8px 0 #e85d3f', fontSize: 25, fontWeight: 900, letterSpacing: 1, transform: 'rotate(-2deg)' }}>
              SP
            </div>
            <div style={{ display: 'flex', fontSize: 35, fontWeight: 900, letterSpacing: -1 }}>StanParty</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 66, fontWeight: 900, lineHeight: 1.08, letterSpacing: -4 }}>待ち時間を、</div>
            <div style={{ display: 'flex', fontSize: 66, fontWeight: 900, lineHeight: 1.08, letterSpacing: -4 }}>遊ぶ時間に。</div>
            <div style={{ display: 'flex', marginTop: 28, fontSize: 24, fontWeight: 700, color: '#657068' }}>スマホひとつで、みんなと遊べる。</div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {['NO SIGN-UP', 'REALTIME', 'BROWSER GAME'].map((label) => (
              <div key={label} style={{ display: 'flex', padding: '9px 14px', border: '2px solid #26372e', borderRadius: 99, fontSize: 15, fontWeight: 900, letterSpacing: 1, background: '#fffaf0' }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', right: -90, top: -120, width: 560, height: 850, display: 'flex', background: '#e9e2d3', borderLeft: '4px solid #26372e', transform: 'rotate(8deg)' }} />

        {cards.map((card) => (
          <div key={card.label} style={{ position: 'absolute', left: card.x, top: card.y, width: 238, height: 196, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17231d', background: card.color, border: '4px solid #26372e', borderRadius: 22, boxShadow: '10px 10px 0 #26372e', transform: `rotate(${card.rotate})`, fontSize: 68, fontWeight: 900 }}>
            {card.label}
          </div>
        ))}
      </div>
    ),
    size,
  );
}
