import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Guitar, Mic, Headphones, Piano, PersonStanding, Disc3, Building, Building2, Dices } from 'lucide-react';
import { BACKGROUNDS } from '../../lib/gameData/constants';

// A themed banner (icon + gradient) per starting background — keyed by id so
// each card reads at a glance.
const BG_ART = {
  unknown: { Icon: Guitar, grad: 'linear-gradient(135deg,#3A2D1F,#1B1620)', color: '#E8C34D' },
  star: { Icon: Mic, grad: 'linear-gradient(135deg,#521E38,#26122C)', color: '#E893A6' },
  producer: { Icon: Headphones, grad: 'linear-gradient(135deg,#123039,#101724)', color: '#4FD1C5' },
  genius: { Icon: Piano, grad: 'linear-gradient(135deg,#352755,#1D1730)', color: '#B794F4' },
  trainee: { Icon: PersonStanding, grad: 'linear-gradient(135deg,#26371E,#141B16)', color: '#5FBF8F' },
  indie: { Icon: Disc3, grad: 'linear-gradient(135deg,#3A3320,#1E1A13)', color: '#E8A33D' },
  ceo_small: { Icon: Building, grad: 'linear-gradient(135deg,#1F2F3A,#131922)', color: '#7FA8D1' },
  ceo_big: { Icon: Building2, grad: 'linear-gradient(135deg,#2A2A3A,#15151F)', color: '#B6BECC' },
  random: { Icon: Dices, grad: 'linear-gradient(135deg,#38203F,#191123)', color: '#C88BFF' },
};

// Themed photo per background (bundled). Revealed on hover.
const BG_PHOTOS = import.meta.glob('../../assets/backgrounds/*.jpg', { eager: true, query: '?url', import: 'default' });
function photoFor(id) {
  const key = Object.keys(BG_PHOTOS).find((k) => k.endsWith(`/${id}.jpg`));
  return key ? BG_PHOTOS[key] : null;
}
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useGameStore } from '../../state/useGameStore';

export function CharacterCreation() {
  const navigate = useNavigate();
  const artistNameInput = useGameStore((s) => s.artistNameInput);
  const setArtistNameInput = useGameStore((s) => s.setArtistNameInput);
  const confirmBackground = useGameStore((s) => s.confirmBackground);
  const switchSave = useGameStore((s) => s.switchSave);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const nameReady = artistNameInput.trim().length > 0;

  async function handleSelect(bg) {
    if (busy) return;
    if (!nameReady) { setError('먼저 아티스트 이름을 입력하세요'); return; }
    setBusy(true);
    setError('');
    try {
      await confirmBackground(bg);
      navigate('/studio');
    } catch (e) {
      setError(e.message || '캐릭터 생성에 실패했습니다');
      setBusy(false);
    }
  }

  // Abandoning creation returns to save-select rather than into a half-made
  // world — the world exists but has no character yet.
  function back() {
    switchSave();
    navigate('/');
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px' }}>
      <button className="me-btn-ghost" style={{ marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={back}>
        <ArrowLeft size={14} /> 세이브 선택으로
      </button>

      <div className="me-display" style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>새 아티스트 만들기</div>
      <div style={{ color: '#8B8496', fontSize: 13, marginBottom: 20 }}>이름을 정하고 시작 배경을 고르세요. 모든 배경은 각자의 장단점이 있습니다.</div>

      <div style={{ maxWidth: 360, marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>아티스트 이름</div>
        <Input value={artistNameInput} onChange={(e) => setArtistNameInput(e.target.value)} placeholder="예: 블루문" maxLength={40} />
      </div>

      {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 16 }}>{error}</div>}

      <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 10 }}>시작 배경</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, opacity: busy || !nameReady ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
        {BACKGROUNDS.map((bg) => (
          <div key={bg.id} className="me-card" onClick={() => handleSelect(bg)} style={{ overflow: 'hidden' }}
            onMouseEnter={() => setHoveredId(bg.id)} onMouseLeave={() => setHoveredId((h) => (h === bg.id ? null : h))}>
            {(() => {
              const art = BG_ART[bg.id] || BG_ART.unknown;
              const Icon = art.Icon;
              const photo = photoFor(bg.id);
              const hovered = hoveredId === bg.id;
              return (
                <div style={{ margin: '-16px -16px 12px', height: 74, background: art.grad, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(65% 130% at 50% 0%, ${art.color}26, transparent 70%)` }} />
                  <Icon size={30} style={{ color: art.color, filter: `drop-shadow(0 2px 8px ${art.color}66)`, position: 'relative', opacity: hovered ? 0 : 1, transition: 'opacity .3s' }} />
                  {photo && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1.06)' : 'scale(1)', transition: 'opacity .35s ease, transform 4s ease' }} />}
                  {photo && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(11,9,16,0.55))', opacity: hovered ? 1 : 0, transition: 'opacity .35s' }} />}
                </div>
              );
            })()}
            <div className="me-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{bg.name}</div>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 10 }}>{bg.tagline}</div>
            <div style={{ fontSize: 11, color: '#4FD1C5', marginBottom: 2 }}>+ {bg.pro}</div>
            <div style={{ fontSize: 11, color: '#C4576B' }}>− {bg.con}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
