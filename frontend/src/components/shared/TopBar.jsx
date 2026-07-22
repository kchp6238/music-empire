import { Disc3, LogOut, LibraryBig, Music2, SlidersHorizontal, Mic, Users, Handshake, Building2, Globe } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { won } from '../../lib/utils';
import { useAuthStore } from '../../state/useAuthStore';
import { useGameStore } from '../../state/useGameStore';

// Icons let the tabs collapse to a thumb-reachable bottom bar on phones while
// staying text labels on desktop.
const TABS = [
  { path: '/studio', label: '스튜디오', icon: Music2 },
  { path: '/beatmaker', label: '비트', icon: SlidersHorizontal },
  { path: '/recording', label: '녹음실', icon: Mic },
  { path: '/community', label: '커뮤니티', icon: Users },
  { path: '/collab', label: '협업', icon: Handshake },
  { path: '/company', label: '회사', icon: Building2 },
  { path: '/online', label: '온라인', icon: Globe },
];

function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted leading-tight">{label}</div>
      <div className="text-[13px] md:text-sm leading-tight" style={{ color }}>{value}</div>
    </div>
  );
}

export function TopBar({ character }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const switchSave = useGameStore((s) => s.switchSave);
  if (!character) return null;

  return (
    <>
      <div className="me-topbar">
        {/* identity + (desktop) inline nav */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <Disc3 size={20} style={{ color: '#E8A33D' }} />
          <div className="min-w-0">
            <div className="me-display font-bold text-[15px] truncate">
              {character.artistName}
              {character.age != null && <span className="text-[11px] text-muted font-normal ml-1.5">{character.age}세</span>}
            </div>
            <div className="text-[11px] text-muted truncate">{character.backgroundName}</div>
          </div>
          {character.gameDate && (
            <div className="me-mono text-xs text-accent2 border border-accent2/35 rounded-lg px-2.5 py-1"
              title="게임 내 날짜 — 곡 발매·훈련 같은 행동을 하면 흘러갑니다">
              {character.gameDate}
            </div>
          )}
          {/* desktop-only inline nav (phones use the bottom bar) */}
          <div className="hidden md:flex gap-1.5 ml-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.path} className="me-btn-ghost"
                style={location.pathname === tab.path ? { borderColor: '#E8A33D', color: '#E8A33D' } : {}}
                onClick={() => navigate(tab.path)}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {/* stats + save/logout */}
        <div className="flex items-center justify-between md:justify-end gap-4 md:gap-5 me-mono w-full md:w-auto">
          <Stat label="명성" value={Math.round(character.fame)} color="#4FD1C5" />
          <Stat label="자금" value={won(character.money)} color="#E8A33D" />
          <Stat label="팬" value={character.fansCount.toLocaleString('ko-KR')} color="#E893A6" />
          <Stat label="발매곡" value={character.songs.length} color="#EDE9F0" />
          <button className="me-btn-ghost !px-2.5 !py-1.5" onClick={() => { switchSave(); navigate('/'); }} title="세이브 전환" aria-label="세이브 전환">
            <LibraryBig size={14} />
          </button>
          <button className="me-btn-ghost !px-2.5 !py-1.5" onClick={() => { logout(); navigate('/'); }} title="로그아웃" aria-label="로그아웃">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* phone bottom tab bar — hidden at md+ via CSS (.me-bottomnav) */}
      <nav className="me-bottomnav">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname === tab.path;
          return (
            <button key={tab.path} className={active ? 'active' : ''} onClick={() => navigate(tab.path)} aria-label={tab.label}>
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
