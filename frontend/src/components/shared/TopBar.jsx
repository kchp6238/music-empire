import { Disc3, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { won } from '../../lib/utils';
import { useAuthStore } from '../../state/useAuthStore';

const TABS = [
  { path: '/studio', label: '스튜디오' },
  { path: '/beatmaker', label: '비트메이커' },
  { path: '/community', label: '커뮤니티' },
  { path: '/collab', label: '협업' },
  { path: '/company', label: '회사' },
  { path: '/online', label: '온라인' },
];

export function TopBar({ character }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  if (!character) return null;
  return (
    <div className="me-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Disc3 size={20} style={{ color: '#E8A33D' }} />
        <div>
          <div className="me-display" style={{ fontSize: 15, fontWeight: 700 }}>{character.artistName}</div>
          <div style={{ fontSize: 11, color: '#8B8496' }}>{character.backgroundName}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
          {TABS.map((tab) => (
            <button
              key={tab.path} className="me-btn-ghost"
              style={location.pathname === tab.path ? { borderColor: '#E8A33D', color: '#E8A33D' } : {}}
              onClick={() => navigate(tab.path)}
            >{tab.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22 }} className="me-mono">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>명성</div>
          <div style={{ fontSize: 14, color: '#4FD1C5' }}>{Math.round(character.fame)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>자금</div>
          <div style={{ fontSize: 14, color: '#E8A33D' }}>{won(character.money)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>팬</div>
          <div style={{ fontSize: 14, color: '#E893A6' }}>{character.fansCount.toLocaleString('ko-KR')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>발매곡</div>
          <div style={{ fontSize: 14, color: '#EDE9F0' }}>{character.songs.length}</div>
        </div>
        <button className="me-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => { logout(); navigate('/'); }} title="로그아웃">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
