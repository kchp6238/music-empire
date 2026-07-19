import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Music2, Play, Square } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as collabApi from '../../lib/api/collab';
import { useGameStore } from '../../state/useGameStore';
import { TIER_COLOR } from '../../lib/gameData/constants';

export function CollabSongScreen() {
  const navigate = useNavigate();
  const { songId } = useParams();
  const character = useGameStore((s) => s.character);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);

  const [song, setSong] = useState(undefined); // undefined = loading, null = not found
  const [collaborators, setCollaborators] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [songData, collabList] = await Promise.all([
          collabApi.getCollabSong(songId),
          collabApi.getMyCollabs(),
        ]);
        setSong(songData);
        const entry = collabList.find((c) => c.song_id === songId);
        setCollaborators(entry ? entry.collaborators : []);
      } catch (e) {
        setError(e.message || '곡을 불러오지 못했습니다');
        setSong(null);
      }
    })();
  }, [songId]);

  if (!character) return null;

  const playingThis = isPlaying && playingId === songId;

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 60px' }}>
        <button className="me-btn-ghost" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/collab')}>
          <ArrowLeft size={15} /> 협업 목록으로
        </button>

        {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        {song === undefined && <div style={{ fontSize: 12, color: '#6B6577' }}>불러오는 중...</div>}

        {song && (
          <>
            <div className="me-panel" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Music2 size={18} style={{ color: '#E8A33D' }} />
                <div className="me-display" style={{ fontSize: 18, fontWeight: 800 }}>{song.title || '(제목 없음)'}</div>
                {song.tier && <span className="me-mono" style={{ fontSize: 12, color: TIER_COLOR[song.tier] }}>{song.tier} · {Math.round(song.overall_score)}점</span>}
              </div>
              <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 14 }}>
                {song.genre_tags?.join(', ')} {song.mood_tags?.length ? `· ${song.mood_tags.join(', ')}` : ''} · BPM {song.bpm}
                {' · '}{song.released_at ? '발매됨' : '작업 중 (초안)'}
              </div>
              <button
                className="me-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                onClick={() => (playingThis ? stop() : play(song.pattern, song.bpm, songId))}
              >
                {playingThis ? <Square size={15} /> : <Play size={15} />} {playingThis ? '정지' : '미리 듣기'}
              </button>
            </div>

            <div className="me-panel">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>참여자</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {collaborators.map((c) => (
                  <div key={c.character_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{c.artist_name}{c.is_owner && <span style={{ marginLeft: 6, fontSize: 10, color: '#8B7FD1' }}>곡 주인</span>}</span>
                    <span className="me-mono" style={{ color: '#8B8496' }}>{c.role} · {c.contribution_pct}%</span>
                  </div>
                ))}
              </div>
              {!song.released_at && (
                <div style={{ fontSize: 11, color: '#6B6577', marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                  곡 편집과 발매는 곡 주인만 할 수 있습니다. 주인이 발매하면 지분 비율대로 수익이 자동으로 나눠집니다.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
