import { useNavigate } from 'react-router-dom';
import { ChevronRight, Music2, TrendingUp, Sparkles } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { MiniBar } from '../shared/MiniBar';
import { TrendBanner } from '../shared/TrendBanner';
import { TimePassedToast } from '../shared/TimePassedToast';
import { AchievementsPanel } from '../shared/AchievementsPanel';
import { TrainingPanel } from './TrainingPanel';
import { GENRES, MOODS, CHORD_PRESETS, TIER_COLOR } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

export function StudioScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const draft = useGameStore((s) => s.draft);
  const setDraftField = useGameStore((s) => s.setDraftField);
  const toggleTag = useGameStore((s) => s.toggleTag);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 24px 0' }}>
        <TimePassedToast />
        <TrendBanner />
      </div>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '8px 24px 20px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div className="me-panel">
          <div className="me-display" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Music2 size={20} style={{ color: '#E8A33D' }} /> 곡 기본 정보
          </div>
          <div style={{ color: '#8B8496', fontSize: 12, marginBottom: 20 }}>곡의 방향을 정하세요. 발매 후에는 되돌릴 수 없습니다.</div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>곡 제목</div>
            <input
              value={draft.title} onChange={(e) => setDraftField('title', e.target.value)} placeholder="곡 제목을 입력하세요"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>BPM: <span className="me-mono">{draft.bpm}</span></div>
            <input type="range" className="me-slider" min={60} max={180} value={draft.bpm} onChange={(e) => setDraftField('bpm', Number(e.target.value))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>장르 (최대 2개)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GENRES.map((g) => (
                  <div key={g} className={`me-pill small ${draft.genres.includes(g) ? 'active' : ''}`} onClick={() => toggleTag('genres', g, 2)}>{g}</div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>분위기 (최대 2개)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MOODS.map((m) => (
                  <div key={m} className={`me-pill small ${draft.moods.includes(m) ? 'active' : ''}`} onClick={() => toggleTag('moods', m, 2)}>{m}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>코드 진행</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {CHORD_PRESETS.map((c) => (
                <div key={c.id} className={`me-card ${draft.chordPresetId === c.id ? 'selected' : ''}`} style={{ padding: 10 }} onClick={() => setDraftField('chordPresetId', c.id)}>
                  <div className="me-mono" style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#8B8496', marginTop: 2 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>제작 모드</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className={`me-pill small ${draft.productionMode === 'beginner' ? 'active' : ''}`} onClick={() => setDraftField('productionMode', 'beginner')}>초보자</div>
                <div className={`me-pill small ${draft.productionMode === 'expert' ? 'active' : ''}`} onClick={() => setDraftField('productionMode', 'expert')}>전문가</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>보컬</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div className={`me-pill small ${draft.vocalSource === 'self' ? 'active' : ''}`} onClick={() => setDraftField('vocalSource', 'self')}>직접</div>
                <div className={`me-pill small ${draft.vocalSource === 'ai' ? 'active' : ''}`} onClick={() => setDraftField('vocalSource', 'ai')}>AI</div>
                <div
                  className={`me-pill small ${draft.vocalSource === 'npc' ? 'active' : ''}`}
                  style={character.money < 300 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                  onClick={() => character.money >= 300 && setDraftField('vocalSource', 'npc')}
                >NPC 고용</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="me-panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} style={{ color: '#4FD1C5' }} /> 실력 스탯</div>
            {Object.entries(character.stats).map(([k, v]) => (<MiniBar key={k} label={k} value={v} color="#4FD1C5" />))}
          </div>
          <div className="me-panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={15} style={{ color: '#E8A33D' }} /> 재능</div>
            {Object.entries(character.talent).map(([k, v]) => (<MiniBar key={k} label={k} value={v} color="#E8A33D" />))}
          </div>
          <div className="me-panel" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8B8496' }}>누적 스트리밍</span>
            <span className="me-mono" style={{ fontSize: 14, color: '#4FD1C5' }}>{(character.totalStreams || 0).toLocaleString('ko-KR')}</span>
          </div>
          <TrainingPanel />
          <div style={{ marginBottom: 16 }}><AchievementsPanel /></div>
          {character.songs.length > 0 && (
            <div className="me-panel">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>발매 기록</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }} className="me-scroll">
                {character.songs.slice().reverse().map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <button className="me-btn-ghost" style={{ padding: '2px 8px', fontSize: 11, borderRadius: 6 }} aria-label={(isPlaying && playingId === s.id) ? `${s.title} 정지` : `${s.title} 재생`} onClick={() => (isPlaying && playingId === s.id) ? stop() : play(s.pattern, s.bpm, s.id)}>
                      {(isPlaying && playingId === s.id) ? '■' : '▶'}
                    </button>
                    <span style={{ color: '#EDE9F0', flex: 1, margin: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                    <span className="me-mono" style={{ color: TIER_COLOR[s.tier] }}>{s.tier} · {s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 60px' }}>
        <div className="me-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#8B8496' }}>기본 정보를 정했다면 비트메이커에서 곡을 완성하세요.</div>
          <button className="me-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/beatmaker')}>
            비트메이커로 이동 <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
