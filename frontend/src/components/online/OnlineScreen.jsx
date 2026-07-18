import { useEffect, useState } from 'react';
import { Ticket, Store } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as onlineApi from '../../lib/api/online';
import { won } from '../../lib/utils';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

export function OnlineScreen() {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);
  const [tab, setTab] = useState('concerts');
  if (!character) return null;
  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <div className={`me-pill ${tab === 'concerts' ? 'active' : ''}`} onClick={() => setTab('concerts')}>콘서트</div>
          <div className={`me-pill ${tab === 'market' ? 'active' : ''}`} onClick={() => setTab('market')}>마켓플레이스</div>
        </div>
        {tab === 'concerts' ? <Concerts character={character} refresh={refreshCharacter} /> : <Marketplace character={character} refresh={refreshCharacter} />}
      </div>
    </div>
  );
}

function Concerts({ character, refresh }) {
  const [concerts, setConcerts] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [price, setPrice] = useState(50);
  const [date, setDate] = useState('');

  async function load() {
    try { setConcerts(await onlineApi.getConcerts()); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); await load(); await refresh(); } catch (e) { setError(e.message || '실패'); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="me-panel" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Ticket size={15} style={{ color: '#E8A33D' }} /> 콘서트 개최</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: 8, alignItems: 'center' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="콘서트명" style={inputStyle} />
          <input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} placeholder="정원" style={inputStyle} />
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="티켓가" style={inputStyle} />
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <button className="me-btn-primary" disabled={busy || !date} onClick={() => run(() => onlineApi.createConcert(title, capacity, price, new Date(date).toISOString()))}>개최</button>
        </div>
      </div>
      {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {concerts && concerts.length === 0 && <div style={{ fontSize: 12, color: '#6B6577' }}>예정된 콘서트가 없습니다.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {concerts && concerts.map((c) => (
          <div key={c.id} className="me-panel" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>{c.host_name} · {new Date(c.scheduled_at).toLocaleString('ko-KR')} · {c.tickets_sold}/{c.venue_capacity}석</div>
            </div>
            <div className="me-mono" style={{ fontSize: 12, color: '#E8A33D' }}>{won(c.ticket_price)}</div>
            {c.is_host ? (
              <span style={{ fontSize: 11, color: '#8B8496' }}>내 콘서트</span>
            ) : c.has_ticket ? (
              <span style={{ fontSize: 11, color: '#5FBF8F' }}>예매 완료</span>
            ) : (
              <button className="me-btn-ghost" disabled={busy} onClick={() => run(() => onlineApi.buyTicket(c.id))}>예매하기</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Marketplace({ character, refresh }) {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [songId, setSongId] = useState('');
  const [price, setPrice] = useState(500);

  async function load() {
    try { setListings(await onlineApi.getMarketplace()); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); await load(); await refresh(); } catch (e) { setError(e.message || '실패'); } finally { setBusy(false); }
  }

  const myReleased = character.songs;

  return (
    <div>
      <div className="me-panel" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Store size={15} style={{ color: '#E8A33D' }} /> 내 곡 판매 등록</div>
        {myReleased.length === 0 ? (
          <div style={{ fontSize: 12, color: '#6B6577' }}>발매한 곡이 있어야 등록할 수 있습니다.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={songId} onChange={(e) => setSongId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">곡 선택</option>
              {myReleased.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.tier})</option>)}
            </select>
            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="가격" style={{ ...inputStyle, width: 120 }} />
            <button className="me-btn-primary" disabled={busy || !songId} onClick={() => run(() => onlineApi.createListing(songId, price))}>등록</button>
          </div>
        )}
      </div>
      {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {listings && listings.length === 0 && <div style={{ fontSize: 12, color: '#6B6577' }}>판매 중인 곡이 없습니다.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {listings && listings.map((l) => (
          <div key={l.id} className="me-panel" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{l.song_title}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>{l.seller_name} · <span style={{ color: TIER_COLOR[l.tier] }}>{l.tier} {Math.round(l.overall_score)}</span></div>
            </div>
            <div className="me-mono" style={{ fontSize: 13, color: '#E8A33D' }}>{won(l.price)}</div>
            {l.is_mine ? <span style={{ fontSize: 11, color: '#8B8496' }}>내 곡</span>
              : <button className="me-btn-ghost" disabled={busy} onClick={() => run(() => onlineApi.buyListing(l.id))}>구매</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none', boxSizing: 'border-box', width: '100%' };
