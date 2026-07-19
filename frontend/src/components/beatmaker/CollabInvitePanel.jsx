import { useEffect, useState } from 'react';
import { Handshake } from 'lucide-react';
import { getFeed } from '../../lib/api/community';
import { useGameStore } from '../../state/useGameStore';

const ROLES = ['작곡', '작사', '편곡', '보컬', '프로듀싱'];

export function CollabInvitePanel() {
  const character = useGameStore((s) => s.character);
  const inviteCollaborator = useGameStore((s) => s.inviteCollaborator);
  const persistedDraftId = useGameStore((s) => s.persistedDraftId);

  const [artists, setArtists] = useState([]);
  const [artistId, setArtistId] = useState('');
  const [role, setRole] = useState('작곡');
  const [pct, setPct] = useState(20);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getFeed().then((items) => {
      const seen = new Set();
      const list = [];
      for (const it of items) {
        if (it.artist_type === 'character' && it.artist_id !== character.id && !seen.has(it.artist_id)) {
          seen.add(it.artist_id);
          list.push({ id: it.artist_id, name: it.artist_name });
        }
      }
      setArtists(list);
    }).catch(() => {});
  }, [character.id]);

  async function submit() {
    setBusy(true); setMsg('');
    try {
      await inviteCollaborator(artistId, role, pct);
      setMsg(`초대를 보냈습니다 (${role} · ${pct}%). 상대가 수락하면 "협업" 탭의 "내 공동 작업"에 이 곡이 뜨고, 발매 수익도 지분대로 분배됩니다.`);
    } catch (e) {
      setMsg(e.message || '초대에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="me-panel" style={{ marginBottom: 20 }}>
      <div className="me-display" style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Handshake size={16} style={{ color: '#4FD1C5' }} /> 협업자 초대 <span style={{ fontSize: 11, color: '#8B8496', fontWeight: 400 }}>(선택)</span>
      </div>
      <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 12 }}>
        {persistedDraftId ? '초안이 저장되었습니다. 발매 시 이 초안이 사용됩니다.' : '초대를 보내면 현재 곡이 초안으로 저장됩니다.'}
      </div>
      {artists.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6B6577' }}>초대할 다른 아티스트가 아직 없습니다 (상대가 곡을 발매해야 목록에 나타납니다).</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={artistId} onChange={(e) => setArtistId(e.target.value)} style={inputStyle}>
            <option value="">아티스트 선택</option>
            {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="number" min={1} max={99} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
          <span style={{ fontSize: 12, color: '#8B8496' }}>%</span>
          <button className="me-btn-ghost" disabled={busy || !artistId} onClick={submit}>초대 보내기</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 11, color: '#4FD1C5', marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none' };
