import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getArtistProfile } from '../../lib/api/community';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { compactNum } from '../../lib/utils';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import { useGameStore } from '../../state/useGameStore';

function Bars({ obj, color }) {
  if (!obj) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-[10px] text-muted w-12 shrink-0 truncate">{k}</span>
          <div className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${Math.min(100, v)}%`, background: color }} />
          </div>
          <span className="me-mono text-[10px] text-faint w-6 text-right">{Math.round(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function ArtistProfile() {
  const profileArtist = useGameStore((s) => s.profileArtist);
  const closeArtist = useGameStore((s) => s.closeArtist);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profileArtist) { setData(null); setError(''); return; }
    let alive = true;
    setData(null); setError('');
    getArtistProfile(profileArtist.type, profileArtist.id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || '프로필을 불러오지 못했습니다'));
    return () => { alive = false; };
  }, [profileArtist]);

  if (!profileArtist) return null;
  const accent = data?.color || '#E8A33D';

  return (
    <div className="me-modal-backdrop" onClick={closeArtist}>
      <div className="me-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <ArtistAvatar name={data?.name || ''} color={accent} size={48} />
          <div className="min-w-0 flex-1">
            <div className="me-display text-lg font-extrabold truncate">{data?.name || '...'}</div>
            <div className="text-[11px] text-muted">
              {data?.type === 'npc'
                ? `${data.genre || ''} · 라이벌 아티스트`
                : data ? `${data.background_name || ''}${data.age != null ? ` · ${data.age}세` : ''}${data.is_me ? ' · 나' : ''}` : ''}
            </div>
          </div>
          <button className="me-btn-ghost !px-2 !py-1.5" onClick={closeArtist} aria-label="닫기"><X size={14} /></button>
        </div>

        {error && <div className="text-danger text-xs">{error}</div>}
        {!data && !error && <div className="text-faint text-xs">불러오는 중...</div>}

        {data && (
          <>
            {data.bio && <div className="text-[12px] text-muted mb-3">{data.bio}</div>}

            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-xs">
              {data.type === 'npc' ? (
                <>
                  <span className="text-muted">실력 <b className="text-text me-mono">{data.skill ?? '?'}</b></span>
                  <span className="text-muted">발매 <b className="text-text me-mono">{data.releases}곡</b></span>
                  {data.avg_score != null && <span className="text-muted">평균 <b className="text-text me-mono">{data.avg_score}</b></span>}
                  {data.moods?.length ? <span className="text-muted">무드 {data.moods.join('·')}</span> : null}
                </>
              ) : (
                <>
                  <span className="text-muted">명성 <b className="text-accent2 me-mono">{data.fame}</b></span>
                  <span className="text-muted">팬 <b className="text-pink me-mono">{compactNum(data.fans_count)}</b></span>
                  <span className="text-muted">발매 <b className="text-text me-mono">{data.releases}곡</b></span>
                  {data.avg_score != null && <span className="text-muted">평균 <b className="text-text me-mono">{data.avg_score}</b></span>}
                </>
              )}
            </div>

            {data.type === 'character' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[10px] text-muted mb-1.5 uppercase tracking-wide">실력</div>
                  <Bars obj={data.stats} color="#4FD1C5" />
                </div>
                <div>
                  <div className="text-[10px] text-muted mb-1.5 uppercase tracking-wide">재능</div>
                  <Bars obj={data.talent} color="#E8A33D" />
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted mb-1.5 uppercase tracking-wide">발매곡</div>
            {data.songs.length === 0 && <div className="text-xs text-faint">아직 발매한 곡이 없어요.</div>}
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto me-scroll">
              {data.songs.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="me-mono text-[10px] text-faint">▷ {compactNum(s.views)}</span>
                  <span className="me-mono text-[10px]" style={{ color: TIER_COLOR[s.tier] }}>{s.tier} {Math.round(s.overall_score)}</span>
                  <span className="me-mono text-[10px] text-faint w-16 text-right">{s.released_on}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
