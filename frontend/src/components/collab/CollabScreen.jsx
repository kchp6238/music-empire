import { useEffect, useState } from 'react';
import { Handshake } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as collabApi from '../../lib/api/collab';
import { useGameStore } from '../../state/useGameStore';

export function CollabScreen() {
  const character = useGameStore((s) => s.character);
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setInvites(await collabApi.getIncomingInvites()); } catch (e) { setError(e.message); }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      </div>
    </div>
  );
}
