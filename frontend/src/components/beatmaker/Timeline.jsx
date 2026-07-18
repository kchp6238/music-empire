import { useRef, useState } from 'react';
import { X, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../ui/Pill';
import { SECTION_TYPES, SECTION_COLORS, DRUM_INSTRUMENTS } from '../../lib/gameData/constants';
import { buildCombinedPattern } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

const PX_PER_STEP = 6;
const MIN_LENGTH = 16;
const MAX_LENGTH = 64;
const LANES = [
  { id: 'drums', label: '드럼' },
  { id: 'bass', label: '베이스' },
  { id: 'piano', label: '피아노' },
  { id: 'guitar', label: '기타' },
];

function laneActivity(section, laneId) {
  if (laneId === 'drums') {
    const total = DRUM_INSTRUMENTS.reduce((sum, di) => sum + section.drums[di.key].filter(Boolean).length, 0);
    return total / (section.length * DRUM_INSTRUMENTS.length);
  }
  return section[laneId].filter(Boolean).length / section.length;
}

export function Timeline() {
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const setEditingSection = useGameStore((s) => s.setEditingSection);
  const addToArrangement = useGameStore((s) => s.addToArrangement);
  const removeFromArrangement = useGameStore((s) => s.removeFromArrangement);
  const reorderArrangement = useGameStore((s) => s.reorderArrangement);
  const setSectionLengthFor = useGameStore((s) => s.setSectionLengthFor);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);

  const [dragFrom, setDragFrom] = useState(null);
  const [resizing, setResizing] = useState(null); // { idx, key, startX, startLength, previewLength }
  const containerRef = useRef(null);

  const { arrangement, sections, editingSection } = draft;

  const offsets = [];
  let cursor = 0;
  arrangement.forEach((key) => {
    offsets.push(cursor);
    cursor += (resizing && resizing.key === key ? resizing.previewLength : sections[key].length);
  });
  const totalSteps = cursor;
  const totalWidth = Math.max(totalSteps * PX_PER_STEP, 200);

  const playheadLocalStep = (() => {
    if (!isPlaying || playingId !== 'draft-full' || currentStep < 0) return -1;
    return currentStep; // combined-pattern step index already matches the concatenated timeline
  })();

  function onResizeStart(e, idx, key) {
    e.stopPropagation();
    e.preventDefault();
    setResizing({ idx, key, startX: e.clientX, startLength: sections[key].length, previewLength: sections[key].length });
    function onMove(ev) {
      setResizing((r) => {
        if (!r) return r;
        const deltaSteps = Math.round((ev.clientX - r.startX) / PX_PER_STEP / 16) * 16;
        const next = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, r.startLength + deltaSteps));
        return { ...r, previewLength: next };
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setResizing((r) => {
        if (r && r.previewLength !== r.startLength) setSectionLengthFor(r.key, r.previewLength);
        return null;
      });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div className="me-panel" style={{ marginBottom: 20 }}>
      <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Layers size={18} style={{ color: '#4FD1C5' }} /> 타임라인
      </div>
      <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 12 }}>
        클립을 클릭해 선택, 드래그해 순서 변경, 오른쪽 끝을 드래그해 길이 조절(1마디 단위)하세요. 같은 종류의 클립은 패턴을 공유합니다.
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SECTION_TYPES.map((t) => (
            <Pill key={t} size="sm" onClick={() => addToArrangement(t)}>+ {t}</Pill>
          ))}
        </div>
        <Button
          variant="primary" size="sm" disabled={arrangement.length === 0}
          onClick={() => (isPlaying && playingId === 'draft-full') ? stop() : play(buildCombinedPattern(sections, arrangement), draft.bpm, 'draft-full')}
        >
          {(isPlaying && playingId === 'draft-full') ? '■ 정지' : '▶ 전체 곡 재생'}
        </Button>
      </div>

      {arrangement.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6B6577', padding: '20px 0' }}>아직 구조가 비어있습니다. 위 버튼으로 섹션을 추가하세요.</div>
      ) : (
        <div className="me-scroll" style={{ overflowX: 'auto' }} ref={containerRef}>
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Clip ruler — interactive */}
            <div style={{ position: 'relative', height: 40, marginBottom: 6 }}>
              {arrangement.map((key, idx) => {
                const length = resizing && resizing.idx === idx ? resizing.previewLength : sections[key].length;
                const left = offsets[idx] * PX_PER_STEP;
                const width = length * PX_PER_STEP;
                const selected = editingSection === key;
                const color = SECTION_COLORS[key];
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => setDragFrom(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) reorderArrangement(dragFrom, idx); setDragFrom(null); }}
                    onClick={() => setEditingSection(key)}
                    title={`${key} · ${length}스텝`}
                    style={{
                      position: 'absolute', left, width, height: 40, top: 0, cursor: 'grab',
                      background: color, opacity: selected ? 1 : 0.55,
                      border: selected ? '2px solid #EDE9F0' : '1px solid rgba(0,0,0,0.25)',
                      borderRadius: 8, boxSizing: 'border-box',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px',
                      transition: resizing ? 'none' : 'left .15s, width .15s',
                    }}
                  >
                    <span className="me-mono" style={{ fontSize: 10, color: '#12101A', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {idx + 1}. {key}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromArrangement(idx); }}
                      aria-label={`${key} 삭제`}
                      style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 4, color: '#12101A', cursor: 'pointer', flexShrink: 0, padding: 2 }}
                    >
                      <X size={10} />
                    </button>
                    <div
                      onMouseDown={(e) => onResizeStart(e, idx, key)}
                      title="드래그해 길이 조절"
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }}
                    />
                  </div>
                );
              })}
              {playheadLocalStep >= 0 && (
                <div style={{ position: 'absolute', left: playheadLocalStep * PX_PER_STEP, top: -2, bottom: -2, width: 2, background: '#EDE9F0', boxShadow: '0 0 6px #EDE9F0', zIndex: 5 }} />
              )}
            </div>

            {/* Lane visualizations — read-only activity strips */}
            {LANES.map((lane) => (
              <div key={lane.id} style={{ display: 'flex', alignItems: 'center', height: 20, marginBottom: 3 }}>
                <div style={{ position: 'relative', width: totalWidth, height: 14 }}>
                  {arrangement.map((key, idx) => {
                    const length = resizing && resizing.idx === idx ? resizing.previewLength : sections[key].length;
                    const left = offsets[idx] * PX_PER_STEP;
                    const width = length * PX_PER_STEP;
                    const activity = laneActivity(sections[key], lane.id);
                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute', left, width, height: 14, borderRadius: 3,
                          background: activity > 0 ? SECTION_COLORS[key] : 'rgba(255,255,255,0.04)',
                          opacity: activity > 0 ? 0.25 + activity * 0.6 : 1,
                          border: '1px solid rgba(255,255,255,0.05)', boxSizing: 'border-box',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {LANES.map((lane) => (
                <span key={lane.id} style={{ fontSize: 9, color: '#6B6577' }}>{lane.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
