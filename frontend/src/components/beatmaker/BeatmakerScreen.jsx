import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, FileText } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { DrumGrid } from './DrumGrid';
import { BassGuitarPanel, PianoPanel } from './PianoRollPanel';
import { Mixer } from './Mixer';
import { SECTION_TYPES } from '../../lib/gameData/constants';
import { buildCombinedPattern, analyzeCombinedPattern, sectionHasContent } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

export function BeatmakerScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const setEditingSection = useGameStore((s) => s.setEditingSection);
  const setSectionLength = useGameStore((s) => s.setSectionLength);
  const toggleDrumStep = useGameStore((s) => s.toggleDrumStep);
  const setNoteStep = useGameStore((s) => s.setNoteStep);
  const setLyrics = useGameStore((s) => s.setLyrics);
  const loadBasicPattern = useGameStore((s) => s.loadBasicPattern);
  const clearSection = useGameStore((s) => s.clearSection);
  const addToArrangement = useGameStore((s) => s.addToArrangement);
  const removeFromArrangement = useGameStore((s) => s.removeFromArrangement);
  const moveArrangement = useGameStore((s) => s.moveArrangement);
  const handleRelease = useGameStore((s) => s.handleRelease);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  if (!character) return null;

  const editingSec = draft.sections[draft.editingSection];
  const combinedDraft = buildCombinedPattern(draft.sections, draft.arrangement);
  const patternInfo = analyzeCombinedPattern(combinedDraft);
  const canRelease = draft.title.trim() && draft.genres.length > 0 && draft.moods.length > 0 && draft.arrangement.length > 0 && patternInfo.totalActive >= 6;

  async function onRelease() {
    if (!canRelease || releasing) return;
    setReleasing(true);
    setReleaseError('');
    try {
      await handleRelease();
      navigate('/results');
    } catch (e) {
      setReleaseError(e.message || '발매에 실패했습니다');
    } finally {
      setReleasing(false);
    }
  }

  const sectionStep = playingId === 'section-preview' ? currentStep : -1;

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div className="me-panel" style={{ marginBottom: 20 }}>
          <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} style={{ color: '#4FD1C5' }} /> 곡 구조
          </div>
          <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 10 }}>섹션을 추가해 순서를 짜세요. 같은 종류의 섹션은 같은 패턴을 공유합니다.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {SECTION_TYPES.map((t) => (
              <button key={t} className="me-btn-ghost" onClick={() => addToArrangement(t)}>+ {t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, minHeight: 34 }}>
            {draft.arrangement.length === 0 && <span style={{ fontSize: 12, color: '#6B6577' }}>아직 구조가 비어있습니다. 위 버튼으로 섹션을 추가하세요.</span>}
            {draft.arrangement.map((key, idx) => (
              <div key={idx} className="me-chip" onClick={() => setEditingSection(key)} style={draft.editingSection === key ? { borderColor: '#E8A33D' } : {}}>
                <span>{idx + 1}. {key}</span>
                <button onClick={(e) => { e.stopPropagation(); moveArrangement(idx, -1); }}>◀</button>
                <button onClick={(e) => { e.stopPropagation(); moveArrangement(idx, 1); }}>▶</button>
                <button onClick={(e) => { e.stopPropagation(); removeFromArrangement(idx); }}>×</button>
              </div>
            ))}
          </div>
          <button
            className="me-btn-primary" style={{ padding: '10px 18px' }} disabled={draft.arrangement.length === 0}
            onClick={() => (isPlaying && playingId === 'draft-full') ? stop() : play(combinedDraft, draft.bpm, 'draft-full')}
          >
            {(isPlaying && playingId === 'draft-full') ? '■ 정지' : '▶ 전체 곡 재생'}
          </button>
        </div>

        <div className="me-panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div className="me-display" style={{ fontSize: 18, fontWeight: 800 }}>섹션 편집</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className={`me-pill small ${editingSec.length === 16 ? 'active' : ''}`} onClick={() => setSectionLength(16)}>1마디 (16)</div>
              <div className={`me-pill small ${editingSec.length === 32 ? 'active' : ''}`} onClick={() => setSectionLength(32)}>2마디 (32)</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {SECTION_TYPES.map((t) => (
              <div key={t} className={`me-pill small ${draft.editingSection === t ? 'active' : ''}`} onClick={() => setEditingSection(t)}>
                {t}{sectionHasContent(draft.sections[t]) ? ' ●' : ''}
              </div>
            ))}
          </div>

          <div className="me-scroll" style={{ overflowX: 'auto', marginBottom: 8 }}>
            <div style={{ minWidth: 520 }}>
              <DrumGrid section={editingSec} onToggle={toggleDrumStep} currentStep={sectionStep} />
              <div style={{ height: 8 }} />
              <BassGuitarPanel section={editingSec} onSetNote={setNoteStep} currentStep={sectionStep} />
            </div>
          </div>

          <div className="me-scroll" style={{ overflowX: 'auto', marginTop: 16 }}>
            <div style={{ minWidth: 520 }}>
              <PianoPanel section={editingSec} onSetNote={setNoteStep} currentStep={sectionStep} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="me-btn-ghost" onClick={loadBasicPattern}>기본 패턴 불러오기</button>
            <button className="me-btn-ghost" onClick={clearSection}>이 섹션 지우기</button>
            <button
              className="me-btn-ghost"
              onClick={() => (isPlaying && playingId === 'section-preview') ? stop() : play(buildCombinedPattern(draft.sections, [draft.editingSection]), draft.bpm, 'section-preview')}
            >
              {(isPlaying && playingId === 'section-preview') ? '■ 정지' : `▶ ${draft.editingSection} 미리듣기`}
            </button>
          </div>
        </div>

        <div className="me-panel" style={{ marginBottom: 20 }}>
          <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: '#E893A6' }} /> 가사 노트 — {draft.editingSection}
          </div>
          <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 12 }}>섹션을 바꾸려면 위 "섹션 편집" 탭을 클릭하세요.</div>
          <div className="me-notebook">
            <textarea value={editingSec.lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="가사를 적어보세요..." />
          </div>
          <div style={{ fontSize: 10, color: '#6B6577', marginTop: 8 }}>
            {editingSec.lyrics.trim() ? `${editingSec.lyrics.trim().split(/\s+/).length}단어` : '아직 가사가 없어요'} · 완성도에 소폭 반영돼요
          </div>
        </div>

        <Mixer />

        <div className="me-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 11, color: releaseError ? '#C4576B' : canRelease ? '#4FD1C5' : '#C4576B' }}>
            {releaseError ? releaseError :
              draft.arrangement.length === 0 ? '곡 구조에 섹션을 최소 1개 이상 추가하세요' :
              patternInfo.totalActive < 6 ? `최소 6칸 이상 입력해야 발매할 수 있어요 (현재 ${patternInfo.totalActive}개)` :
              `${patternInfo.totalActive}개 스텝 · ${draft.arrangement.length}개 섹션 구성 완료`}
          </div>
          <button className="me-btn-primary" onClick={onRelease} disabled={!canRelease || releasing}>
            {releasing ? '발매 중...' : '곡 발매하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
