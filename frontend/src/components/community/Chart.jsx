import { Trophy } from 'lucide-react';
import { NPC_ARTISTS } from '../../lib/gameData/npcArtists';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

export function Chart() {
  const character = useGameStore((s) => s.character);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);

  const chartEntries = [
    ...NPC_ARTISTS.map((a) => ({ ...a.song, artistName: a.name })),
    ...character.songs.map((s) => ({ ...s, artistName: character.artistName })),
  ].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#8B8496', display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} /> 종합 차트</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chartEntries.map((s, idx) => (
          <div key={s.id} className="me-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="me-mono" style={{ width: 22, fontSize: 14, fontWeight: 700, color: idx === 0 ? '#E8A33D' : idx === 1 ? '#4FD1C5' : idx === 2 ? '#E893A6' : '#8B8496' }}>{idx + 1}</div>
            <span className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} onClick={() => (isPlaying && playingId === s.id) ? stop() : play(s.pattern, s.bpm, s.id)}>
              {(isPlaying && playingId === s.id) ? '■' : '▶'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>{s.artistName}</div>
            </div>
            <div className="me-mono" style={{ fontSize: 13, color: TIER_COLOR[s.tier] }}>{s.tier} · {s.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
