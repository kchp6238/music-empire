import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BACKGROUNDS } from '../../lib/gameData/constants';
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
          <div key={bg.id} className="me-card" onClick={() => handleSelect(bg)}>
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
