import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, Music2, ChevronRight } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as collabApi from '../../lib/api/collab';
import { useGameStore } from '../../state/useGameStore';
import { TIER_COLOR } from '../../lib/gameData/constants';

export function CollabScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const [invites, setInvites] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [inv, mineList] = await Promise.all([collabApi.getIncomingInvites(), collabApi.getMyCollabs()]);
      setInvites(inv);
      setMine(mineList);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function respond(id, accept) {
    setBusy(true); setError('');
    try { await collabApi.respondInvite(id, accept); await load(); } catch (e) { setError(e.message || '실패'); } finally { setBusy(false); }
  }

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div className="me-display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Handshake size={20} style={{ color: '#4FD1C5' }} /> 협업 초대함
        </div>
        <div style={{ color: '#8B8496', fontSize: 12, marginBottom: 20 }}>다른 아티스트가 보낸 공동 작업 초대입니다. 수락하면 발매 수익을 기여도만큼 나눠 받습니다.</div>
        {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        {invites && invites.length === 0 && <div style={{ fontSize: 12, color: '#6B6577' }}>받은 초대가 없습니다.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {invites && invites.map((inv) => (
            <div key={inv.id} className="me-panel" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{inv.inviter_name} 님의 초대 · {inv.song_title}</div>
                <div style={{ fontSize: 11, color: '#8B8496' }}>역할 {inv.role} · 수익 {inv.contribution_pct}%</div>
              </div>
              <button className="me-btn-primary" style={{ padding: '8px 14px' }} disabled={busy} onClick={() => respond(inv.id, true)}>수락</button>
              <button className="me-btn-ghost" disabled={busy} onClick={() => respond(inv.id, false)}>거절</button>
            </div>
          ))}
        </div>

        <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Music2 size={17} style={{ color: '#E8A33D' }} /> 내 공동 작업
        </div>
        <div style={{ color: '#8B8496', fontSize: 12, marginBottom: 20 }}>초대를 수락했거나, 다른 사람이 내 곡에 참여 중인 곡들입니다.</div>
        {mine && mine.length === 0 && <div style={{ fontSize: 12, color: '#6B6577' }}>참여 중인 공동 작업이 없습니다.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mine && mine.map((song) => (
            <button
              key={song.song_id} className="me-panel"
              style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none' }}
              onClick={() => navigate(`/collab/songs/${song.song_id}`)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {song.title || '(제목 없음)'}
                  {song.is_owner && <span style={{ marginLeft: 6, fontSize: 10, color: '#8B7FD1' }}>내 곡</span>}
                </div>
                <div style={{ fontSize: 11, color: '#8B8496' }}>
                  내 역할 {song.my_role} · 지분 {song.my_contribution_pct}%
                  {song.released ? (
                    <> · <span style={{ color: TIER_COLOR[song.tier] }}>{song.tier} · {Math.round(song.overall_score)}점</span></>
                  ) : ' · 작업 중'}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: '#6B6577' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
