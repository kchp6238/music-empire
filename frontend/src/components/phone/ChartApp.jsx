import { useEffect, useMemo, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import { CoverThumb } from '../cover/CoverThumb';
import * as communityApi from '../../lib/api/community';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { compactNum } from '../../lib/utils';
import { useGameStore } from '../../state/useGameStore';

// Fixed category chips, YouTube-Music style. Genre chips are appended from
// whatever genres actually appear in the world's songs.
const CHART_LIMIT = 50; // top-N shown per category, so the chart stays a chart

const BASE_CATS = [
  { key: 'popular', label: '인기' },
  { key: 'new', label: '신곡' },
  { key: 'rising', label: '급상승' },
  { key: 'mine', label: '내 곡' },
];

export function ChartApp() {
  const character = useGameStore((s) => s.character);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const [rows, setRows] = useState(null);
  const [cat, setCat] = useState('popular');

  useEffect(() => {
    (async () => { try { setRows(await communityApi.getChart()); } catch { setRows([]); } })();
  }, []);

  // genres present in the data → extra chips
  const genres = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => (r.genres || []).forEach((g) => g && set.add(g)));
    return [...set];
  }, [rows]);

  const list = useMemo(() => {
    let items = [...(rows || [])];
    if (cat === 'mine') items = items.filter((r) => r.artist_id === character.id);
    else if (cat.startsWith('genre:')) {
      const g = cat.slice(6);
      items = items.filter((r) => (r.genres || []).includes(g));
    }
    if (cat === 'new') items.sort((a, b) => (b.released_on || '').localeCompare(a.released_on || ''));
    else if (cat === 'rising') items.sort((a, b) => (b.views || 0) - (a.views || 0));
    else items.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
    // A chart is a top-N, not a dump of every song ever released.
    return items.slice(0, CHART_LIMIT);
  }, [rows, cat, character.id]);

  if (rows === null) return <div className="p-5 text-center text-muted text-xs">불러오는 중…</div>;

  return (
    <div>
      {/* category chip bar */}
      <div className="sticky top-0 z-10 px-2.5 py-2 flex gap-1.5 overflow-x-auto me-scroll" style={{ background: '#0E0C15' }}>
        {[...BASE_CATS, ...genres.map((g) => ({ key: `genre:${g}`, label: g }))].map((c) => {
          const active = cat === c.key;
          return (
            <button
              key={c.key} onClick={() => setCat(c.key)}
              className="shrink-0 text-[11px] px-3 py-1.5 rounded-full cursor-pointer border transition-colors"
              style={{
                borderColor: active ? '#E8A33D' : 'rgba(255,255,255,0.15)',
                background: active ? '#E8A33D' : 'transparent',
                color: active ? '#12101A' : '#B8B2C4',
                fontWeight: active ? 700 : 400,
              }}
            >{c.label}</button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="p-8 text-center text-muted text-xs">
          {cat === 'mine' ? '아직 발매한 곡이 없어요.' : '이 카테고리에는 곡이 없어요.'}
        </div>
      ) : (
        <div className="px-3 py-2 flex flex-col gap-1.5">
          {list.map((s, i) => {
            const mine = s.artist_id === character.id;
            const nowPlaying = isPlaying && playingId === s.id;
            return (
              <div
                key={s.id}
                className="flex items-center gap-2.5 p-2 rounded-lg"
                style={mine ? { background: 'rgba(232,163,61,0.10)', border: '1px solid rgba(232,163,61,0.3)' } : {}}
              >
                <div className="me-mono text-sm w-6 text-center shrink-0" style={{ color: i < 3 ? '#E8A33D' : '#8B8496' }}>{i + 1}</div>
                {s.has_cover
                  ? <CoverThumb songId={s.id} title={s.title} size={34} rounded={7} />
                  : <ArtistAvatar name={s.artist_name} color={mine ? '#E8A33D' : '#8B8496'} size={34} rounded={7} />}
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-text truncate">{s.title}</div>
                  <div className="text-[10px] text-muted truncate">
                    {s.artist_name}{s.genres?.[0] ? ` · ${s.genres[0]}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="me-mono text-[11px]" style={{ color: TIER_COLOR[s.tier] || '#EDE9F0' }}>{s.tier} · {s.overall_score}</div>
                  <div className="me-mono text-[9px] text-faint">▷ {compactNum(s.views || 0)}</div>
                </div>
                <button
                  onClick={() => nowPlaying ? stop() : play(s.pattern, s.bpm, s.id, s.vocals, s.title)}
                  aria-label={nowPlaying ? `${s.title} 정지` : `${s.title} 재생`}
                  className="w-7 h-7 flex items-center justify-center rounded-full shrink-0 cursor-pointer border-0"
                  style={{ background: nowPlaying ? 'var(--color-danger)' : 'rgba(255,255,255,0.1)', color: '#EDE9F0' }}
                >
                  {nowPlaying ? <Square size={12} /> : <Play size={12} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
