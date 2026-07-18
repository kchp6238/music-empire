import { useNavigate } from 'react-router-dom';
import { BACKGROUNDS } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

export function CharacterCreation() {
  const navigate = useNavigate();
  const confirmBackground = useGameStore((s) => s.confirmBackground);

  function handleSelect(bg) {
    confirmBackground(bg);
    navigate('/studio');
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px' }}>
      <div className="me-display" style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>시작 배경을 선택하세요</div>
      <div style={{ color: '#8B8496', fontSize: 13, marginBottom: 24 }}>모든 배경은 각자의 장단점이 있다. 강제된 정답은 없다.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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
