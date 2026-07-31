import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Play, Square, X, RotateCcw } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { Pill } from '../ui/Pill';
import { Button } from '../ui/Button';
import { CHANNELS, DRUM_INSTRUMENTS } from '../../lib/gameData/constants';
import { songCombined } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

const PX_PER_STEP = 6;
const STEPS_PER_BAR = 16;
const BAR_PX = STEPS_PER_BAR * PX_PER_STEP; // 96px per bar
const RULER_H = 22;
const LANE_H = 46;
const HEADER_W = 128;
const MIN_BARS = 8; // always show some empty room to drop into

const LANE_LABEL = { drums: '드럼', bass: '베이스', elecGuitar: '일렉 기타', synthLead: '신스 리드', pad: '신스 패드', brass: '브라스' };
const LANE_DEFS = CHANNELS.map((c) => ({ key: c.key, label: LANE_LABEL[c.key] || c.label, icon: c.icon, color: c.color }));

// active step indices (within one clip iteration) for a track
function clipActiveSteps(sec, track) {
  const out = [];
  const len = (sec.bass || []).length || sec.length || 16;
  for (let i = 0; i < len; i++) {
    if (track === 'drums') { if (DRUM_INSTRUMENTS.some((di) => sec.drums[di.key][i])) out.push(i); }
    else if (sec[track] && sec[track][i]) out.push(i);
  }
  return out;
}
function clipHasTrack(sec, track) {
  if (track === 'drums') return DRUM_INSTRUMENTS.some((di) => sec.drums[di.key].some(Boolean));
  return (sec[track] || []).some(Boolean);
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
  const seedTimeline = useGameStore((s) => s.seedTimelineFromArrangement);
  const addTimelineClip = useGameStore((s) => s.addTimelineClip);
  const moveTimelinePlacement = useGameStore((s) => s.moveTimelinePlacement);
  const resizeTimelinePlacement = useGameStore((s) => s.resizeTimelinePlacement);
  const deleteTimelinePlacement = useGameStore((s) => s.deleteTimelinePlacement);
  const clearTimeline = useGameStore((s) => s.clearTimeline);
  const setEditingSection = useGameStore((s) => s.setEditingSection);

  const [drag, setDrag] = useState(null); // { id, mode, origStart, origBars, previewStart, previewBars }
  const [selected, setSelected] = useState(null);

  // Seed the per-instrument timeline from the clip arrangement the first time
  // this screen opens, so an existing song shows up ready to rearrange.
  useEffect(() => {
    if (!draft.timeline.length && draft.arrangement.length) seedTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!character) return null;
  const { timeline, sections } = draft;

  const eff = (p) => {
    if (drag && drag.id === p.id) {
      return { start: drag.mode === 'move' ? drag.previewStart : p.start, bars: drag.mode === 'resize' ? drag.previewBars : p.bars };
    }
    return { start: p.start, bars: p.bars };
  };

  const usedKeys = [...new Set(timeline.map((p) => p.track))];
  const lanes = (usedKeys.length ? LANE_DEFS.filter((l) => usedKeys.includes(l.key)) : LANE_DEFS.filter((l) => l.key === 'drums' || l.key === 'bass'));
  const totalBars = Math.max(MIN_BARS, ...timeline.map((p) => { const e = eff(p); return e.start + e.bars; }));
  const totalWidth = totalBars * BAR_PX;
  const playhead = (isPlaying && playingId === 'arrange-full' && currentStep >= 0) ? currentStep : -1;
  const playingFull = isPlaying && playingId === 'arrange-full';

  function startMove(e, p) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    setSelected(p.id);
    setDrag({ id: p.id, mode: 'move', origStart: p.start, previewStart: p.start });
    const onMove = (ev) => {
      const d = Math.round((ev.clientX - startX) / BAR_PX);
      setDrag((cur) => (cur ? { ...cur, previewStart: Math.max(0, p.start + d) } : cur));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDrag((cur) => {
        if (cur && cur.previewStart !== p.start) { const v = cur.previewStart; queueMicrotask(() => moveTimelinePlacement(p.id, v)); }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startResize(e, p) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    setDrag({ id: p.id, mode: 'resize', origBars: p.bars, previewBars: p.bars });
    const onMove = (ev) => {
      const d = Math.round((ev.clientX - startX) / BAR_PX);
      setDrag((cur) => (cur ? { ...cur, previewBars: Math.max(1, p.bars + d) } : cur));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDrag((cur) => {
        if (cur && cur.previewBars !== p.bars) { const v = cur.previewBars; queueMicrotask(() => resizeTimelinePlacement(p.id, v)); }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const empty = timeline.length === 0;

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
              <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('편곡을 지금 클립 순서 기준으로 다시 깔까요? (지금 편곡 배치는 사라집니다)')) { clearTimeline(); setTimeout(seedTimeline, 0); } }} title="지금 클립들로 편곡 초기화">
                <RotateCcw size={13} /> 초기화
              </Button>
              <Button variant="primary" size="sm" disabled={empty}
                onClick={() => playingFull ? stop() : play(songCombined(draft), draft.bpm, 'arrange-full')}>
                {playingFull ? <><Square size={13} /> 정지</> : <><Play size={13} /> 전체 곡 재생</>}
              </Button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 14 }}>
            악기마다 트랙(가로 줄)이 있고, <span style={{ color: '#EDE9F0' }}>블록은 각각 따로 움직여요</span>. 블록을 좌우로 드래그해 위치를 옮기고,
            오른쪽 끝을 끌면 길이(반복), ✕로 삭제, 더블클릭하면 비트 화면에서 그 클립을 편집합니다.
          </div>

          {empty ? (
            <div style={{ fontSize: 12, color: '#8B8496', padding: '30px 16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10 }}>
              아직 편곡이 비어 있어요. 아래 클립을 눌러 트랙에 놓아보세요. (놓은 뒤 좌우로 끌어 위치를 맞추면 됩니다)
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
                  <div style={{ position: 'relative', height: RULER_H, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {Array.from({ length: totalBars }, (_, b) => (
                      <div key={b} style={{ position: 'absolute', left: b * BAR_PX, top: 4 }}>
                        <div style={{ width: 1, height: 5, background: 'rgba(255,255,255,0.18)' }} />
                        <span className="me-mono" style={{ fontSize: 9, color: '#6B6577', marginLeft: 3 }}>{b + 1}</span>
                      </div>
                    ))}
                  </div>

                  {lanes.map((lane) => (
                    <div key={lane.key} style={{ position: 'relative', height: LANE_H, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {Array.from({ length: totalBars + 1 }, (_, b) => (
                        <div key={b} style={{ position: 'absolute', left: b * BAR_PX, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.04)' }} />
                      ))}
                      {timeline.filter((p) => p.track === lane.key).map((p) => {
                        const sec = sections[p.clip];
                        if (!sec || !clipHasTrack(sec, p.track)) return null;
                        const { start, bars } = eff(p);
                        const left = start * BAR_PX;
                        const width = bars * BAR_PX;
                        const color = sec.color || '#8B8496';
                        const isSel = selected === p.id;
                        const isDragging = drag && drag.id === p.id;
                        const base = clipActiveSteps(sec, p.track);
                        const clipLen = (sec.bass || []).length || 16;
                        const marks = [];
                        for (let i = 0; i < bars * STEPS_PER_BAR; i++) if (base.includes(i % clipLen)) marks.push(i);
                        return (
                          <div
                            key={p.id}
                            onMouseDown={(e) => startMove(e, p)}
                            onClick={() => setSelected(p.id)}
                            onDoubleClick={() => { setEditingSection(p.clip); navigate('/beatmaker'); }}
                            title={`${p.clip} · ${bars}마디 · 드래그로 이동`}
                            style={{
                              position: 'absolute', left, width, top: 4, height: LANE_H - 8,
                              cursor: isDragging ? 'grabbing' : 'grab',
                              background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                              opacity: isSel ? 1 : 0.86,
                              borderRadius: 5, overflow: 'hidden', boxSizing: 'border-box',
                              boxShadow: isSel ? '0 0 0 2px #EDE9F0' : '0 1px 2px rgba(0,0,0,0.4)',
                              zIndex: isDragging ? 6 : 1,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 4px', height: 14 }}>
                              <span className="me-mono" style={{ fontSize: 8.5, fontWeight: 800, color: '#12101A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.clip}</span>
                              <button onClick={(e) => { e.stopPropagation(); deleteTimelinePlacement(p.id); }} onMouseDown={(e) => e.stopPropagation()}
                                aria-label={`${p.clip} 삭제`} title="삭제"
                                style={{ marginLeft: 'auto', background: 'rgba(18,16,26,0.25)', border: 'none', borderRadius: 2, color: '#12101A', cursor: 'pointer', padding: '0 1px', display: 'flex' }}><X size={8} /></button>
                            </div>
                            {marks.map((i, k) => (
                              <span key={k} style={{ position: 'absolute', bottom: 4, left: i * PX_PER_STEP + 1, width: Math.max(2, PX_PER_STEP - 1.5), height: 20, borderRadius: 1, background: 'rgba(18,16,26,0.5)' }} />
                            ))}
                            <div onMouseDown={(e) => startResize(e, p)} onClick={(e) => e.stopPropagation()}
                              title="드래그해 길이(반복)" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', background: 'linear-gradient(90deg, transparent, rgba(18,16,26,0.25))' }} />
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {playhead >= 0 && (
                    <div style={{ position: 'absolute', left: playhead * PX_PER_STEP, top: RULER_H, height: lanes.length * LANE_H, width: 2, background: '#EDE9F0', boxShadow: '0 0 6px #EDE9F0', zIndex: 7, pointerEvents: 'none' }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* clip palette — drops one independent block per instrument the clip uses */}
          <div className="flex items-center gap-1.5 flex-wrap mt-4">
            <span style={{ fontSize: 10, color: '#6B6577', marginRight: 2 }}>클립 놓기</span>
            {Object.keys(sections).map((key) => (
              <Pill key={key} size="sm" onClick={() => addTimelineClip(key, totalBars)}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: sections[key].color || '#8B8496', marginRight: 5, verticalAlign: 'middle' }} />
                {key}
              </Pill>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#6B6577', marginTop: 8 }}>
            클립을 놓으면 그 클립이 쓰는 악기마다 <span style={{ color: '#8B8496' }}>따로따로 블록</span>이 생겨요. 각 블록을 원하는 위치로 끌어 배치하세요.
          </div>
        </div>
      </div>
    </div>
  );
}
