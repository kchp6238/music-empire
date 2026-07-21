import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getFeed } from '../../lib/api/community';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { CoverThumb } from '../cover/CoverThumb';
import { useGameStore } from '../../state/useGameStore';

/** Fan comments written at release time by the server, so they name who said
 *  it and stay put instead of reshuffling on every render. */
function SongReactions({ reactions }) {
  if (!reactions?.length) {
    return <div style={{ fontSize: 11, color: '#6B6577' }}>아직 반응이 없어요.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {reactions.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.persona_color || '#8B8496', flexShrink: 0, transform: 'translateY(-1px)' }} />
          <span style={{ color: r.persona_color || '#8B8496', fontWeight: 600, flexShrink: 0 }}>{r.persona_name}</span>
          <span style={{ color: '#B8B2C4' }}>{r.comment_line}</span>
        </div>
      ))}
    </div>
  );
}

export function Feed() {
  const character = useGameStore((s) => s.character);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const followedArtists = useGameStore((s) => s.followedArtists);
  const toggleFollow = useGameStore((s) => s.toggleFollow);
  const isFollowing = (s) => followedArtists.some((f) => f.followed_type === s.artist_type && f.followed_id === s.artist_id);

  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getFeed().then(setItems).catch((e) => setError(e.message || '피드를 불러오지 못했습니다'));
  }, []);

  if (error) return <div style={{ fontSize: 12, color: '#C4576B' }}>{error}</div>;
  if (!items) return <div style={{ fontSize: 12, color: '#6B6577' }}>불러오는 중...</div>;

  // By character id, not name — two artists in a multi world can share a name.
  const isMine = (i) => i.source === 'user' && i.artist_id === character.id;
  const mine = items.filter(isMine);
  const others = items.filter((i) => !isMine(i));

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#8B8496', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> 내 곡</div>
      {mine.length === 0 && <div style={{ fontSize: 12, color: '#6B6577', marginBottom: 24 }}>아직 발매한 곡이 없어요. 스튜디오에서 곡을 만들어보세요.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {mine.map((s) => (
          <div key={s.id} className="me-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <CoverThumb songId={s.id} hasCover={s.has_cover} title={s.title} size={38} />
              <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} aria-label={(isPlaying && playingId === s.id) ? `${s.title} 정지` : `${s.title} 재생`} onClick={() => (isPlaying && playingId === s.id) ? stop() : play(s.pattern, s.bpm, s.id)}>
                {(isPlaying && playingId === s.id) ? '■' : '▶'}
              </button>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.artist_name}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>· {s.title}</div>
              <div className="me-mono" style={{ marginLeft: 'auto', fontSize: 12, color: TIER_COLOR[s.tier] }}>{s.tier} · {Math.round(s.overall_score)}</div>
            </div>
            <SongReactions reactions={s.reactions} />
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#8B8496' }}>다른 아티스트</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {others.map((s) => (
          <div key={s.id} className="me-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <CoverThumb songId={s.id} hasCover={s.has_cover} title={s.title} size={38} />
              <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} aria-label={(isPlaying && playingId === s.id) ? `${s.title} 정지` : `${s.title} 재생`} onClick={() => (isPlaying && playingId === s.id) ? stop() : play(s.pattern, s.bpm, s.id)}>
                {(isPlaying && playingId === s.id) ? '■' : '▶'}
              </button>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.artist_name}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>· {s.title}</div>
              <div className="me-mono" style={{ fontSize: 12, color: TIER_COLOR[s.tier] }}>{s.tier} · {Math.round(s.overall_score)}</div>
              <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 11, marginLeft: 'auto' }} onClick={() => toggleFollow(s.artist_type, s.artist_id)}>
                {isFollowing(s) ? '팔로잉' : '+ 팔로우'}
              </button>
            </div>
            <SongReactions reactions={s.reactions} />
          </div>
        ))}
      </div>
    </div>
  );
}
