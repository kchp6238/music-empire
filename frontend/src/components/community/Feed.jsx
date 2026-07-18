import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getFeed } from '../../lib/api/community';
import { TIER_COLOR, pickLine, tierKeyFromScore } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

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

  const mine = items.filter((i) => i.source === 'user' && i.artist_name === character.artistName);
  const others = items.filter((i) => !(i.source === 'user' && i.artist_name === character.artistName));

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#8B8496', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> 내 곡</div>
      {mine.length === 0 && <div style={{ fontSize: 12, color: '#6B6577', marginBottom: 24 }}>아직 발매한 곡이 없어요. 스튜디오에서 곡을 만들어보세요.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {mine.map((s) => (
          <div key={s.id} className="me-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} onClick={() => (isPlaying && playingId === s.id) ? stop() : play(s.pattern, s.bpm, s.id)}>
                {(isPlaying && playingId === s.id) ? '■' : '▶'}
              </span>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.artist_name}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>· {s.title}</div>
              <div className="me-mono" style={{ marginLeft: 'auto', fontSize: 12, color: TIER_COLOR[s.tier] }}>{s.tier} · {Math.round(s.overall_score)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[0, 1, 2].map((i) => (<div key={i} style={{ fontSize: 11, color: '#B8B2C4' }}>💬 {pickLine(tierKeyFromScore(s.overall_score))}</div>))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#8B8496' }}>다른 아티스트</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {others.map((s) => (
          <div key={s.id} className="me-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} onClick={() => (isPlaying && playingId === s.id) ? stop() : play(s.pattern, s.bpm, s.id)}>
                {(isPlaying && playingId === s.id) ? '■' : '▶'}
              </span>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.artist_name}</div>
              <div style={{ fontSize: 11, color: '#8B8496' }}>· {s.title}</div>
              <div className="me-mono" style={{ fontSize: 12, color: TIER_COLOR[s.tier] }}>{s.tier} · {Math.round(s.overall_score)}</div>
              <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 11, marginLeft: 'auto' }} onClick={() => toggleFollow(s.artist_type, s.artist_id)}>
                {isFollowing(s) ? '팔로잉' : '+ 팔로우'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[0, 1].map((i) => (<div key={i} style={{ fontSize: 11, color: '#B8B2C4' }}>💬 {pickLine(tierKeyFromScore(s.overall_score))}</div>))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
