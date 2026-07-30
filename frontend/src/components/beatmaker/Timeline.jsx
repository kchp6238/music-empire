import { useRef, useState } from 'react';
import { X, Copy, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../ui/Pill';
import { SECTION_TYPES, SECTION_COLORS, DRUM_INSTRUMENTS, MELODIC_KEYS } from '../../lib/gameData/constants';
import { buildCombinedPattern } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

const PX_PER_STEP = 6;
const STEPS_PER_BAR = 16;

// Which steps in a section carry sound, split into the three rows a clip shows:
// drums, bass, and everything melodic above it. Rendered as note marks inside
// the region so a clip reads like a real DAW region, not a flat block.
function sectionMarks(section) {
  const len = section.length;
  const drums = [], bass = [], melody = [];
  for (let i = 0; i < len; i++) {
    if (DRUM_INSTRUMENTS.some((di) => section.drums[di.key][i])) drums.push(i);
    if (section.bass[i]) bass.push(i);
    if (MELODIC_KEYS.some((k) => k !== 'bass' && section[k] && section[k][i])) melody.push(i);
  }
  return { len, drums, bass, melody };
}

// One preview row of note ticks, tiled `count` times across the region.
function MarkRow({ steps, len, count, color, top, height }) {
  const marks = [];
  for (let r = 0; r < count; r++) for (const i of steps) marks.push(r * len + i);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, height }}>
      {marks.map((i, k) => (
        <span key={k} style={{
          position: 'absolute', left: i * PX_PER_STEP + 1, top: 0, height,
          width: Math.max(2, PX_PER_STEP - 1.5), borderRadius: 1, background: color,
        }} />
      ))}
    </div>
  );
}

export function Timeline() {
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const setEditingSection = useGameStore((s) => s.setEditingSection);
  const addToArrangement = useGameStore((s) => s.addToArrangement);
  const setArrangement = useGameStore((s) => s.setArrangement);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);

  const [dragGroup, setDragGroup] = useState(null);
  const [resizing, setResizing] = useState(null); // { gi, key, previewCount }
  const containerRef = useRef(null);

  const { arrangement, sections, editingSection } = draft;

  // Collapse consecutive identical clips into one region with a repeat count —
  // that's how "make one, drop it, and stretch it across N bars" is stored
  // (the arrangement stays a flat list of names, so the backend is untouched).
  const groups = [];
  arrangement.forEach((key, i) => {
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.count += 1;
    else groups.push({ key, count: 1, start: i });
  });

  const renderCount = (gi, g) => (resizing && resizing.gi === gi ? resizing.previewCount : g.count);

  // x-offset (in steps) of each group, honouring the live resize preview
  const offsets = [];
  let cursor = 0;
  groups.forEach((g, gi) => { offsets.push(cursor); cursor += renderCount(gi, g) * sections[g.key].length; });
  const totalSteps = Math.max(cursor, STEPS_PER_BAR);
  const totalWidth = totalSteps * PX_PER_STEP;
  const bars = Math.ceil(totalSteps / STEPS_PER_BAR);

  const playhead = (isPlaying && playingId === 'draft-full' && currentStep >= 0) ? currentStep : -1;

  function commit(list) { setArrangement(list); }

  function flatten(gs) { return gs.flatMap((g) => Array(g.count).fill(g.key)); }

  function moveGroup(fromGi, toGi) {
    if (fromGi === toGi) return;
    const gs = groups.map((g) => ({ key: g.key, count: g.count }));
    const [m] = gs.splice(fromGi, 1);
    gs.splice(toGi, 0, m);
    commit(flatten(gs));
  }

  function duplicateGroup(g) {
    const at = g.start + g.count;
    commit([...arrangement.slice(0, at), ...Array(g.count).fill(g.key), ...arrangement.slice(at)]);
  }

  function deleteGroup(g) {
    commit([...arrangement.slice(0, g.start), ...arrangement.slice(g.start + g.count)]);
  }

  function onResizeStart(e, gi, g) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const barPx = sections[g.key].length * PX_PER_STEP;
    setResizing({ gi, key: g.key, previewCount: g.count });
    function onMove(ev) {
      const deltaBars = Math.round((ev.clientX - startX) / barPx);
      const next = Math.max(1, Math.min(16, g.count + deltaBars));
      setResizing((r) => (r ? { ...r, previewCount: next } : r));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setResizing((r) => {
        // queueMicrotask: commit outside this native mouseup handler so the
        // store write doesn't race React's synthetic handling on subscribers.
        if (r && r.previewCount !== g.count) {
          const next = r.previewCount;
          queueMicrotask(() => commit([
            ...arrangement.slice(0, g.start),
            ...Array(next).fill(g.key),
            ...arrangement.slice(g.start + g.count),
          ]));
        }
        return null;
      });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const playingFull = isPlaying && playingId === 'draft-full';

  return (
    <div className="me-panel" style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="me-display flex items-center gap-2" style={{ fontSize: 18, fontWeight: 800 }}>
          <Layers size={18} style={{ color: '#4FD1C5' }} /> 편곡 타임라인
        </div>
        <Button
          variant="primary" size="sm" disabled={arrangement.length === 0}
          onClick={() => playingFull ? stop() : play(buildCombinedPattern(sections, arrangement, draft.bpm), draft.bpm, 'draft-full')}
        >
          {playingFull ? '■ 정지' : '▶ 전체 곡 재생'}
        </Button>
      </div>
      <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 12 }}>
        아래 버튼으로 구간을 추가하고, 클립을 드래그해 순서를 바꾸세요. 오른쪽 끝을 끌면 그 구간이
        <span style={{ color: '#EDE9F0' }}> 반복</span>되며 늘어나고, ⧉ 로 복제할 수 있어요.
      </div>

      {arrangement.length === 0 ? (
        <div style={{
          fontSize: 12, color: '#8B8496', padding: '28px 16px', textAlign: 'center',
          border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10, marginBottom: 14,
        }}>
          아직 곡 구조가 비어 있어요. 아래에서 구간을 추가해 첫 클립을 놓아보세요.
        </div>
      ) : (
        <div className="me-scroll" style={{ overflowX: 'auto', marginBottom: 14 }} ref={containerRef}>
          <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
            {/* bar ruler */}
            <div style={{ position: 'relative', height: 16, marginBottom: 4 }}>
              {Array.from({ length: bars }, (_, b) => (
                <div key={b} style={{ position: 'absolute', left: b * STEPS_PER_BAR * PX_PER_STEP, top: 0, bottom: 0 }}>
                  <div style={{ width: 1, height: 6, background: 'rgba(255,255,255,0.18)' }} />
                  <span className="me-mono" style={{ fontSize: 9, color: '#6B6577', marginLeft: 3 }}>{b + 1}</span>
                </div>
              ))}
            </div>

            {/* region track */}
            <div style={{ position: 'relative', height: 62 }}>
              {/* bar gridlines */}
              {Array.from({ length: bars + 1 }, (_, b) => (
                <div key={b} style={{
                  position: 'absolute', left: b * STEPS_PER_BAR * PX_PER_STEP, top: 0, bottom: 0,
                  width: 1, background: 'rgba(255,255,255,0.05)',
                }} />
              ))}

              {groups.map((g, gi) => {
                const section = sections[g.key];
                const count = renderCount(gi, g);
                const left = offsets[gi] * PX_PER_STEP;
                const width = count * section.length * PX_PER_STEP;
                const color = SECTION_COLORS[g.key] || '#8B8496';
                const selected = editingSection === g.key;
                const marks = sectionMarks(section);
                return (
                  <div
                    key={gi}
                    draggable
                    onDragStart={() => setDragGroup(gi)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragGroup !== null) moveGroup(dragGroup, gi); setDragGroup(null); }}
                    onClick={() => setEditingSection(g.key)}
                    title={`${g.key}${count > 1 ? ` ×${count}` : ''} — 클릭해 편집`}
                    style={{
                      position: 'absolute', left, width, top: 0, height: 62, cursor: 'grab',
                      background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                      opacity: selected ? 1 : 0.62,
                      borderRadius: 7, boxSizing: 'border-box', overflow: 'hidden',
                      boxShadow: selected ? `0 0 0 2px #EDE9F0, 0 2px 8px ${color}66` : '0 1px 3px rgba(0,0,0,0.35)',
                      transition: resizing ? 'none' : 'left .12s, width .12s, opacity .12s',
                    }}
                  >
                    {/* header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 5px', height: 18 }}>
                      <span className="me-mono" style={{ fontSize: 10, fontWeight: 800, color: '#12101A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {g.key}{count > 1 && <span style={{ opacity: 0.7 }}> ×{count}</span>}
                      </span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); duplicateGroup(g); }}
                          aria-label={`${g.key} 복제`} title="복제"
                          style={{ background: 'rgba(18,16,26,0.25)', border: 'none', borderRadius: 3, color: '#12101A', cursor: 'pointer', padding: '1px 2px', display: 'flex' }}
                        ><Copy size={9} /></button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteGroup(g); }}
                          aria-label={`${g.key} 삭제`} title="삭제"
                          style={{ background: 'rgba(18,16,26,0.25)', border: 'none', borderRadius: 3, color: '#12101A', cursor: 'pointer', padding: '1px 2px', display: 'flex' }}
                        ><X size={9} /></button>
                      </div>
                    </div>
                    {/* content preview: melody / bass / drums rows, like a DAW region */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 18, bottom: 0 }}>
                      <MarkRow steps={marks.melody} len={marks.len} count={count} color="rgba(255,255,255,0.75)" top={4} height={12} />
                      <MarkRow steps={marks.bass} len={marks.len} count={count} color="rgba(18,16,26,0.55)" top={20} height={8} />
                      <MarkRow steps={marks.drums} len={marks.len} count={count} color="rgba(18,16,26,0.6)" top={31} height={7} />
                    </div>
                    {/* resize / repeat handle */}
                    <div
                      onMouseDown={(e) => onResizeStart(e, gi, g)}
                      onClick={(e) => e.stopPropagation()}
                      title="드래그해 반복(늘리기/줄이기)"
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 10, cursor: 'ew-resize', background: 'linear-gradient(90deg, transparent, rgba(18,16,26,0.25))' }}
                    />
                  </div>
                );
              })}

              {playhead >= 0 && (
                <div style={{ position: 'absolute', left: playhead * PX_PER_STEP, top: -4, bottom: -4, width: 2, background: '#EDE9F0', boxShadow: '0 0 6px #EDE9F0', zIndex: 5, pointerEvents: 'none' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* add-section palette */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#6B6577', marginRight: 2 }}>구간 추가</span>
        {SECTION_TYPES.map((t) => (
          <Pill key={t} size="sm" onClick={() => addToArrangement(t)}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SECTION_COLORS[t], marginRight: 5, verticalAlign: 'middle' }} />
            {t}
          </Pill>
        ))}
      </div>
    </div>
  );
}
