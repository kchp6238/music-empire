import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Play, Square, X, Copy } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { Pill } from '../ui/Pill';
import { Button } from '../ui/Button';
import { CHANNELS, DRUM_INSTRUMENTS } from '../../lib/gameData/constants';
import { buildCombinedPattern } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

const PX_PER_STEP = 6;
const STEPS_PER_BAR = 16;
const RULER_H = 22;
const LANE_H = 46;
const HEADER_W = 128;

// One horizontal track per instrument, drums first. Short Korean labels so the
// lane list reads like a DAW track header column.
const LANE_LABEL = { drums: '드럼', bass: '베이스', elecGuitar: '일렉 기타', synthLead: '신스 리드', pad: '신스 패드', brass: '브라스' };
const LANE_DEFS = CHANNELS.map((c) => ({ key: c.key, label: LANE_LABEL[c.key] || c.label, icon: c.icon, color: c.color }));

function clipHasLane(sec, key) {
  if (!sec) return false;
  if (key === 'drums') return DRUM_INSTRUMENTS.some((di) => sec.drums[di.key].some(Boolean));
  return (sec[key] || []).some(Boolean);
}
function laneMarks(sec, key) {
  const out = [];
  const len = sec.length;
  for (let i = 0; i < len; i++) {
    if (key === 'drums') { if (DRUM_INSTRUMENTS.some((di) => sec.drums[di.key][i])) out.push(i); }
    else if (sec[key] && sec[key][i]) out.push(i);
  }
  return out;
}

// The note ticks inside a region — the instrument's active steps, tiled across
// the clip's repeats, so a region shows its content like a DAW waveform.
function RegionMarks({ steps, len, count }) {
  const marks = [];
  for (let r = 0; r < count; r++) for (const i of steps) marks.push(r * len + i);
  return (
    <>
      {marks.map((i, k) => (
        <span key={k} style={{
          position: 'absolute', bottom: 4, left: i * PX_PER_STEP + 1,
          width: Math.max(2, PX_PER_STEP - 1.5), height: 20, borderRadius: 1, background: 'rgba(18,16,26,0.5)',
        }} />
      ))}
    </>
  );
}

export function ArrangeScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const setArrangement = useGameStore((s) => s.setArrangement);
  const addToArrangement = useGameStore((s) => s.addToArrangement);
  const addClip = useGameStore((s) => s.addClip);
  const setEditingSection = useGameStore((s) => s.setEditingSection);

  const [dragGroup, setDragGroup] = useState(null);
  const [resizing, setResizing] = useState(null); // { gi, previewCount }
  const [selected, setSelected] = useState(null);  // clip key

  if (!character) return null;
  const { arrangement, sections } = draft;

  // instrument lanes that actually have content anywhere (fall back to a couple
  // so the grid is never empty)
  const used = LANE_DEFS.filter((l) => Object.values(sections).some((sec) => clipHasLane(sec, l.key)));
  const lanes = used.length ? used : LANE_DEFS.filter((l) => l.key === 'drums' || l.key === 'bass');

  // consecutive identical clips → one region with a repeat count (same model as
  // the beatmaker timeline; the arrangement stays a flat list of clip names)
  const groups = [];
  arrangement.forEach((key, i) => {
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.count += 1;
    else groups.push({ key, count: 1, start: i });
  });
  const renderCount = (gi, g) => (resizing && resizing.gi === gi ? resizing.previewCount : g.count);

  const offsets = [];
  let cursor = 0;
  groups.forEach((g, gi) => { offsets.push(cursor); cursor += renderCount(gi, g) * (sections[g.key]?.length || 16); });
  const totalSteps = Math.max(cursor, STEPS_PER_BAR);
  const totalWidth = totalSteps * PX_PER_STEP;
  const bars = Math.ceil(totalSteps / STEPS_PER_BAR);
  const playhead = (isPlaying && playingId === 'arrange-full' && currentStep >= 0) ? currentStep : -1;
  const playingFull = isPlaying && playingId === 'arrange-full';

  const flatten = (gs) => gs.flatMap((g) => Array(g.count).fill(g.key));
  function moveGroup(from, to) {
    if (from === to) return;
    const gs = groups.map((g) => ({ key: g.key, count: g.count }));
    const [m] = gs.splice(from, 1); gs.splice(to, 0, m);
    setArrangement(flatten(gs));
  }
  function duplicateGroup(g) {
    const at = g.start + g.count;
    setArrangement([...arrangement.slice(0, at), ...Array(g.count).fill(g.key), ...arrangement.slice(at)]);
  }
  function deleteGroup(g) {
    setArrangement([...arrangement.slice(0, g.start), ...arrangement.slice(g.start + g.count)]);
  }
  function onResizeStart(e, gi, g) {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const barPx = (sections[g.key]?.length || 16) * PX_PER_STEP;
    setResizing({ gi, previewCount: g.count });
    const onMove = (ev) => {
      const d = Math.round((ev.clientX - startX) / barPx);
      setResizing((r) => (r ? { ...r, previewCount: Math.max(1, Math.min(16, g.count + d)) } : r));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setResizing((r) => {
        if (r && r.previewCount !== g.count) {
          const n = r.previewCount;
          queueMicrotask(() => setArrangement([...arrangement.slice(0, g.start), ...Array(n).fill(g.key), ...arrangement.slice(g.start + g.count)]));
        }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function editClip(key) { setEditingSection(key); navigate('/beatmaker'); }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar character={character} />

      <div className="max-w-[1400px] w-full mx-auto px-4 md:px-6 pt-5 flex-1">
        <div className="me-panel">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <div className="me-display flex items-center gap-2" style={{ fontSize: 19, fontWeight: 800 }}>
              <ListMusic size={19} style={{ color: '#4FD1C5' }} /> 편곡
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/beatmaker')}>← 비트로</Button>
              <Button variant="primary" size="sm" disabled={arrangement.length === 0}
                onClick={() => playingFull ? stop() : play(buildCombinedPattern(sections, arrangement, draft.bpm), draft.bpm, 'arrange-full')}>
                {playingFull ? <><Square size={13} /> 정지</> : <><Play size={13} /> 전체 곡 재생</>}
              </Button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 14 }}>
            악기마다 트랙(가로 줄)이 있어요. 아래 클립을 눌러 놓으면 그 클립이 쓰는 악기 줄에 블록으로 뜹니다.
            블록을 드래그해 순서 변경, 오른쪽 끝을 끌면 반복, ⧉ 복제, 더블클릭하면 비트 화면에서 그 클립을 편집해요.
          </div>

          {arrangement.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8B8496', padding: '30px 16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10 }}>
              아직 곡 구조가 비어 있어요. 아래 클립을 눌러 트랙에 놓아보세요.
            </div>
          ) : (
            <div className="flex" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', background: 'var(--color-rack)' }}>
              {/* track header column */}
              <div style={{ width: HEADER_W, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ height: RULER_H, borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
                {lanes.map((l) => (
                  <div key={l.key} className="flex items-center gap-1.5 px-2.5" style={{ height: LANE_H, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11 }}>{l.icon}</span>
                    <span className="text-[11px] text-text/85 truncate">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* scrolling timeline */}
              <div className="me-scroll" style={{ overflowX: 'auto', flex: 1 }}>
                <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
                  {/* ruler */}
                  <div style={{ position: 'relative', height: RULER_H, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {Array.from({ length: bars }, (_, b) => (
                      <div key={b} style={{ position: 'absolute', left: b * STEPS_PER_BAR * PX_PER_STEP, top: 4 }}>
                        <div style={{ width: 1, height: 5, background: 'rgba(255,255,255,0.18)' }} />
                        <span className="me-mono" style={{ fontSize: 9, color: '#6B6577', marginLeft: 3 }}>{b + 1}</span>
                      </div>
                    ))}
                  </div>

                  {/* lane rows */}
                  {lanes.map((lane) => (
                    <div key={lane.key} style={{ position: 'relative', height: LANE_H, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {/* bar gridlines */}
                      {Array.from({ length: bars + 1 }, (_, b) => (
                        <div key={b} style={{ position: 'absolute', left: b * STEPS_PER_BAR * PX_PER_STEP, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.04)' }} />
                      ))}
                      {groups.map((g, gi) => {
                        const sec = sections[g.key];
                        if (!sec || !clipHasLane(sec, lane.key)) return null;
                        const count = renderCount(gi, g);
                        const left = offsets[gi] * PX_PER_STEP;
                        const width = count * sec.length * PX_PER_STEP;
                        const color = sec.color || '#8B8496';
                        const isSel = selected === g.key;
                        return (
                          <div
                            key={gi}
                            draggable
                            onDragStart={() => setDragGroup(gi)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); if (dragGroup !== null) moveGroup(dragGroup, gi); setDragGroup(null); }}
                            onClick={() => setSelected(g.key)}
                            onDoubleClick={() => editClip(g.key)}
                            title={`${g.key}${count > 1 ? ` ×${count}` : ''} · 더블클릭=편집`}
                            style={{
                              position: 'absolute', left, width, top: 4, height: LANE_H - 8, cursor: 'grab',
                              background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                              opacity: isSel ? 1 : 0.82,
                              borderRadius: 5, overflow: 'hidden', boxSizing: 'border-box',
                              boxShadow: isSel ? '0 0 0 2px #EDE9F0' : '0 1px 2px rgba(0,0,0,0.4)',
                              transition: resizing ? 'none' : 'left .1s, width .1s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 4px', height: 14 }}>
                              <span className="me-mono" style={{ fontSize: 8.5, fontWeight: 800, color: '#12101A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {g.key}{count > 1 && ` ×${count}`}
                              </span>
                              {lane.key === lanes[0].key && (
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                                  <button onClick={(e) => { e.stopPropagation(); duplicateGroup(g); }} title="복제" aria-label={`${g.key} 복제`}
                                    style={{ background: 'rgba(18,16,26,0.25)', border: 'none', borderRadius: 2, color: '#12101A', cursor: 'pointer', padding: '0 1px', display: 'flex' }}><Copy size={8} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); deleteGroup(g); }} title="삭제" aria-label={`${g.key} 삭제`}
                                    style={{ background: 'rgba(18,16,26,0.25)', border: 'none', borderRadius: 2, color: '#12101A', cursor: 'pointer', padding: '0 1px', display: 'flex' }}><X size={8} /></button>
                                </div>
                              )}
                            </div>
                            <RegionMarks steps={laneMarks(sec, lane.key)} len={sec.length} count={count} />
                            <div onMouseDown={(e) => onResizeStart(e, gi, g)} onClick={(e) => e.stopPropagation()}
                              title="드래그해 반복" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', background: 'linear-gradient(90deg, transparent, rgba(18,16,26,0.25))' }} />
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {playhead >= 0 && (
                    <div style={{ position: 'absolute', left: playhead * PX_PER_STEP, top: RULER_H, height: lanes.length * LANE_H, width: 2, background: '#EDE9F0', boxShadow: '0 0 6px #EDE9F0', zIndex: 5, pointerEvents: 'none' }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* clip palette */}
          <div className="flex items-center gap-1.5 flex-wrap mt-4">
            <span style={{ fontSize: 10, color: '#6B6577', marginRight: 2 }}>클립 놓기</span>
            {Object.keys(sections).map((key) => (
              <Pill key={key} size="sm" onClick={() => addToArrangement(key)}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: sections[key].color || '#8B8496', marginRight: 5, verticalAlign: 'middle' }} />
                {key}
              </Pill>
            ))}
            <Pill size="sm" onClick={addClip}>＋ 새 클립</Pill>
          </div>
          <div style={{ fontSize: 10, color: '#6B6577', marginTop: 8 }}>
            트랙은 클립에 실제로 들어있는 악기만 줄로 보여요. 특정 악기만 있는 구간을 만들려면 비트 화면에서 그 악기만 찍은 클립을 만들어 놓으면 됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
