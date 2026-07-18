import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { getCurrentTrend } from '../../lib/api/progress';

export function TrendBanner() {
  const [trend, setTrend] = useState(null);
  useEffect(() => {
    getCurrentTrend().then(setTrend).catch(() => {});
  }, []);
  if (!trend) return null;
  return (
    <div className="me-panel" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, borderColor: '#4FD1C5' }}>
      <TrendingUp size={16} style={{ color: '#4FD1C5' }} />
      <span style={{ fontSize: 12, color: '#8B8496' }}>이번 주 유행</span>
      <span className="me-pill small active" style={{ background: '#4FD1C5', borderColor: '#4FD1C5' }}>{trend.genre}</span>
      <span className="me-pill small active" style={{ background: '#4FD1C5', borderColor: '#4FD1C5' }}>{trend.mood}</span>
      <span style={{ fontSize: 11, color: '#6B6577', marginLeft: 'auto' }}>매칭 태그로 곡을 내면 노출이 오릅니다</span>
    </div>
  );
}
