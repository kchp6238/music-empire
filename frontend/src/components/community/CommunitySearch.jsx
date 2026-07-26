import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchCommunity } from '../../lib/api/community';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import { useGameStore } from '../../state/useGameStore';

/** Debounced artist/song search — results drop down, clicking one opens that
 *  artist's profile. */
export function CommunitySearch() {
  const openArtist = useGameStore((s) => s.openArtist);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setRes(null); return; }
    const t = setTimeout(() => {
      searchCommunity(q).then(setRes).catch(() => setRes(null));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const has = res && (res.artists.length || res.songs.length);

  return (
    <div ref={boxRef} style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#12101A', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px' }}>
        <Search size={15} className="text-faint" />
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="아티스트·곡 검색"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#EDE9F0', fontSize: 13 }}
        />
        {q && <button className="bg-transparent border-0 cursor-pointer text-faint" onClick={() => { setQ(''); setRes(null); }} aria-label="지우기"><X size={14} /></button>}
      </div>

      {open && q.trim() && (
        <div className="me-panel me-scroll" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 30, maxHeight: 360, overflowY: 'auto', padding: 10 }}>
          {!has && <div className="text-xs text-faint">검색 결과가 없어요.</div>}

          {res?.artists?.length > 0 && <div className="text-[10px] text-muted mb-1.5 uppercase tracking-wide">아티스트</div>}
          {res?.artists?.map((a) => (
            <div key={a.type + a.id} className="flex items-center gap-2 py-1.5 cursor-pointer me-artist-link" onClick={() => { openArtist(a.type, a.id); setOpen(false); }}>
              <ArtistAvatar name={a.name} color={a.color || '#8B8496'} size={28} />
              <span className="text-[13px] text-text truncate">{a.name}</span>
              <span className="text-[10px] text-faint ml-auto shrink-0">{a.type === 'npc' ? '라이벌' : '아티스트'}</span>
            </div>
          ))}

          {res?.songs?.length > 0 && <div className="text-[10px] text-muted mb-1.5 mt-2 uppercase tracking-wide">곡</div>}
          {res?.songs?.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1.5 cursor-pointer" onClick={() => { openArtist(s.artist_type, s.artist_id); setOpen(false); }}>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-text truncate">{s.title}</div>
                <div className="text-[10px] text-faint truncate">{s.artist_name}</div>
              </div>
              <span className="me-mono text-[10px] shrink-0" style={{ color: TIER_COLOR[s.tier] }}>{s.tier} {Math.round(s.score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
