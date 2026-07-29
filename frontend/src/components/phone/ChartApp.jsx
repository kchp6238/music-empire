import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import { CoverThumb } from '../cover/CoverThumb';
import * as communityApi from '../../lib/api/community';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { compactNum } from '../../lib/utils';
import { useGameStore } from '../../state/useGameStore';

// Phone chart: the world's songs ranked by score (same /community/chart data as
// the community tab), with inline play so you can preview a hit without leaving
// the phone.
export function ChartApp() {
  const character = useGameStore((s) => s.character);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => { try { setRows(await communityApi.getChart()); } catch { setRows([]); } })();
  }, []);

  if (rows === null) return <div className="p-5 text-center text-muted text-xs">불러오는 중…</div>;
  if (!rows.length) return <div className="p-6 text-center text-muted text-xs">아직 차트에 곡이 없어요.</div>;

  return (
    <div className="px-3 py-3 flex flex-col gap-1.5">
      {rows.map((s, i) => {
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
              <div className="text-[10px] text-muted truncate">{s.artist_name}</div>
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
  );
}
