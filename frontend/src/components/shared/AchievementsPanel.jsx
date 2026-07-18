import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { getAchievements } from '../../lib/api/progress';

export function AchievementsPanel() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    getAchievements().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return null;
  const unlocked = items.filter((a) => a.unlocked).length;
  return (
    <div className="me-panel">
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Trophy size={15} style={{ color: '#E8A33D' }} /> 업적 <span className="me-mono" style={{ color: '#8B8496', fontSize: 11 }}>{unlocked}/{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: a.unlocked ? 1 : 0.4 }}>
            <span style={{ fontSize: 13 }}>{a.unlocked ? '🏆' : '🔒'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: a.unlocked ? '#EDE9F0' : '#8B8496' }}>{a.name}</div>
              <div style={{ fontSize: 10, color: '#6B6577', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
