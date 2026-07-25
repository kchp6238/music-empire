import { useEffect, useState } from 'react';
import { Ticket, Store, Mic2 } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as onlineApi from '../../lib/api/online';
import { won, compactNum } from '../../lib/utils';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

export function OnlineScreen() {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);
  const [tab, setTab] = useState('perform');
  if (!character) return null;
  return (
    <div>
      <TopBar character={character} />
      <div className="max-w-[900px] mx-auto px-4 md:px-6 pt-7 pb-16">
        <div className="flex gap-2 mb-6 flex-wrap">
          <div className={`me-pill ${tab === 'perform' ? 'active' : ''}`} onClick={() => setTab('perform')}>공연 열기</div>
          <div className={`me-pill ${tab === 'concerts' ? 'active' : ''}`} onClick={() => setTab('concerts')}>합동 콘서트</div>
          <div className={`me-pill ${tab === 'market' ? 'active' : ''}`} onClick={() => setTab('market')}>마켓플레이스</div>
        </div>
        {tab === 'perform' && <Perform character={character} refresh={refreshCharacter} />}
        {tab === 'concerts' && <Concerts character={character} refresh={refreshCharacter} />}
        {tab === 'market' && <Marketplace character={character} refresh={refreshCharacter} />}
      </div>
    </div>
  );
}

function Perform({ character, refresh }) {
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null); // venue object
  const [price, setPrice] = useState(0);
  const [result, setResult] = useState(null);

  async function load() {
    try { setVenues(await onlineApi.getVenues()); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  function pick(v) {
    setSelected(v); setPrice(v.base_price); setResult(null); setError('');
  }

  async function hold() {
    if (!selected) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await onlineApi.holdConcert(selected.id, price);
      setResult(res);
      await refresh();
      await load();
    } catch (e) {
      setError(e.message || '공연에 실패했습니다');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="text-muted text-xs mb-4">
        공연장을 빌려 무대에 서세요. 명성·팬이 많고 티켓값이 적당할수록 관객이 몰려요. 공연은 이틀이 걸립니다.
      </div>
      {error && <div className="text-danger text-xs mb-3">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
        {venues && venues.map((v) => (
          <div
            key={v.id}
            className="me-panel"
            style={{
              padding: 14, cursor: v.unlocked ? 'pointer' : 'not-allowed', opacity: v.unlocked ? 1 : 0.5,
              borderColor: selected?.id === v.id ? '#E8A33D' : undefined,
            }}
            onClick={() => v.unlocked && pick(v)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm">{v.name}</span>
              <span className="me-mono text-[11px] text-muted">{compactNum(v.capacity)}석</span>
            </div>
            <div className="text-[11px] text-muted">
              대관료 {won(v.rental)}
            </div>
            {!v.unlocked && (
              <div className="text-[10px] text-danger mt-1">명성 {v.min_fame}+ · 팬 {v.min_fans.toLocaleString('ko-KR')}+ 필요</div>
            )}
            {v.unlocked && !v.affordable && (
              <div className="text-[10px] text-danger mt-1">대관료 부족</div>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div className="me-panel mb-5">
          <div className="text-sm font-bold mb-2 flex items-center gap-1.5"><Mic2 size={15} className="text-accent" /> {selected.name} 공연</div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-muted">티켓 가격</label>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} style={{ ...inputStyle, width: 130 }} />
            <span className="text-[11px] text-faint">{selected.capacity.toLocaleString('ko-KR')}석 · 대관료 {won(selected.rental)}</span>
            <button className="me-btn-primary ml-auto" disabled={busy || !selected.bookable} onClick={hold}>
              {busy ? '공연 중…' : '공연 열기'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="me-panel" style={{ borderColor: result.fill_pct >= 60 ? '#5FBF8F' : '#C4576B' }}>
          <div className="me-display text-lg font-extrabold mb-1">{result.verdict} 공연!</div>
          <div className="text-sm mb-3">
            <span className="text-text">{result.venue}</span> · 관객 <b className="text-accent2">{result.attendance.toLocaleString('ko-KR')}</b> / {result.capacity.toLocaleString('ko-KR')}석
            <span className="text-muted"> (매진율 {result.fill_pct}%)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <ResultStat label="티켓 수입" value={won(result.revenue)} color="#4FD1C5" />
            <ResultStat label="대관료" value={`-${won(result.rental)}`} color="#C4576B" />
            <ResultStat label="순수익" value={won(result.net)} color={result.net >= 0 ? '#E8A33D' : '#C4576B'} />
            <ResultStat label="명성/팬" value={`${result.fame_delta >= 0 ? '+' : ''}${result.fame_delta} · +${result.fans_delta.toLocaleString('ko-KR')}`} color="#E893A6" />
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, color }) {
  return (
    <div className="me-panel" style={{ padding: 10 }}>
      <div className="text-[10px] text-muted mb-0.5">{label}</div>
      <div className="me-mono text-[13px]" style={{ color }}>{value}</div>
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
