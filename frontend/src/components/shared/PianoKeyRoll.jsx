import { useState } from 'react';

// Click a cell to toggle a single-step note. Mousedown + vertical drag across
// rows in the SAME pitch column paints one sustained note (mirrors
// PianoRoll's horizontal paint gesture — here steps run top-to-bottom).
// Scroll-wheel over an active note adjusts its velocity (shown as opacity).
export function PianoKeyRoll({ label, pitches, steps, velocities, onSetNote, onPaintRange, onAdjustVelocity, currentStep, color }) {
  const cellW = 22;
  const rowH = 18;
  const whiteKeyH = 46;
  const blackKeyH = 28;
  const width = pitches.length * cellW;
  const [drag, setDrag] = useState(null); // { pitch, start, end }

  function startPaint(pitch, row) {
    setDrag({ pitch, start: row, end: row });
    function onUp() {
      window.removeEventListener('mouseup', onUp);
      setDrag((d) => {
        if (!d) return null;
        // queueMicrotask: commit runs inside a native mouseup listener — see
        // Timeline.jsx's onResizeStart for why this avoids a React warning.
        if (d.start === d.end) queueMicrotask(() => onSetNote(d.start, d.pitch));
        else queueMicrotask(() => onPaintRange(d.start, d.end, d.pitch));
        return null;
      });
    }
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>{label} — 실제 건반처럼 가로로 배열, 스텝은 아래로 진행. 드래그로 노트 길이, 스크롤로 벨로시티 조절.</div>
      <div className="me-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width, height: whiteKeyH }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width, height: whiteKeyH, background: '#EDE9F0', borderRadius: '4px 4px 0 0', boxShadow: 'inset 0 -3px 4px rgba(0,0,0,0.15)' }} />
          {pitches.map((p, idx) => (
            !p.includes('#') ? (
              <div key={p + '-sep'} style={{ position: 'absolute', left: idx * cellW, top: 0, width: 1, height: whiteKeyH, background: 'rgba(0,0,0,0.18)' }} />
            ) : null
          ))}
          {pitches.map((p, idx) => (
            p.includes('#') ? (
              <div key={p + '-blk'} style={{ position: 'absolute', left: idx * cellW + 4, top: 0, width: 14, height: blackKeyH, background: 'linear-gradient(180deg, #1c1a22, #050508)', borderRadius: '0 0 3px 3px', boxShadow: '0 2px 3px rgba(0,0,0,0.5)' }} />
            ) : null
          ))}
          {pitches.map((p, idx) => (
            !p.includes('#') && p.startsWith('C') ? (
              <div key={p + '-lbl'} className="me-mono" style={{ position: 'absolute', left: idx * cellW, bottom: 4, width: cellW, textAlign: 'center', fontSize: 8, color: '#12101A', pointerEvents: 'none' }}>{p}</div>
            ) : null
          ))}
        </div>
        <div style={{ width }}>
          {steps.map((_, stepIdx) => (
            <div key={stepIdx} style={{ display: 'flex', marginBottom: (stepIdx % 4 === 3) ? 6 : 0 }}>
              {pitches.map((p) => {
                const painting = drag && drag.pitch === p && stepIdx >= Math.min(drag.start, drag.end) && stepIdx <= Math.max(drag.start, drag.end);
                const active = steps[stepIdx] === p || painting;
                const velocity = velocities?.[stepIdx] ?? 100;
                return (
                  <div
                    key={p}
                    onMouseDown={(e) => { e.preventDefault(); startPaint(p, stepIdx); }}
                    onMouseEnter={() => { if (drag && drag.pitch === p) setDrag((d) => ({ ...d, end: stepIdx })); }}
                    onWheel={(e) => { if (steps[stepIdx] === p) { e.preventDefault(); onAdjustVelocity(stepIdx, e.deltaY < 0 ? 8 : -8); } }}
                    title={steps[stepIdx] === p ? `벨로시티 ${velocity}` : undefined}
                    style={{
                      width: cellW, height: rowH, cursor: 'pointer', boxSizing: 'border-box',
                      background: active ? color : (p.includes('#') ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)'),
                      opacity: (steps[stepIdx] === p) ? (0.45 + (velocity / 127) * 0.55) : 1,
                      border: currentStep === stepIdx ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.05)',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
