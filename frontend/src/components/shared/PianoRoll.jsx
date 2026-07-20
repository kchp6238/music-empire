import { useState } from 'react';
import { auditionNote } from '../../lib/audio/engine';

// Click a cell to toggle a single-step note (unchanged). Mousedown + drag
// across cells in the SAME row paints one sustained note spanning the
// dragged steps — engine.js merges same-pitch runs into one triggered note
// with duration = run length, instead of retriggering every step.
//
// Every cell press also auditions the real instrument at that pitch, so you
// can hear what you're placing instead of guessing from the grid.
export function PianoRoll({ label, icon, track, pitches, steps, onSetNote, onPaintRange, currentStep, color }) {
  const [drag, setDrag] = useState(null); // { pitch, start, end }

  function startPaint(pitch, col) {
    auditionNote(track, pitch);
    setDrag({ pitch, start: col, end: col });
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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0, paddingTop: 2 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </div>
      <div className="me-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ flexShrink: 0 }}>
            {pitches.map((p) => (
              <div key={p} className="me-mono" style={{ width: 34, height: 18, fontSize: 9, color: p.includes('#') ? '#6B6577' : '#B8B2C4', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>{p}</div>
            ))}
          </div>
          <div>
            {pitches.map((p, rowIdx) => (
              <div key={p} style={{ display: 'flex' }}>
                {steps.map((val, colIdx) => {
                  const painting = drag && drag.pitch === p && colIdx >= Math.min(drag.start, drag.end) && colIdx <= Math.max(drag.start, drag.end);
                  const active = val === p || painting;
                  return (
                    <div
                      key={colIdx}
                      onMouseDown={(e) => { e.preventDefault(); startPaint(p, colIdx); }}
                      onMouseEnter={() => { if (drag && drag.pitch === p) setDrag((d) => ({ ...d, end: colIdx })); }}
                      style={{
                        width: 22, height: 18, cursor: 'pointer', boxSizing: 'border-box',
                        background: active ? color : (rowIdx % 12 === 11 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)'),
                        border: currentStep === colIdx ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.06)',
                        marginRight: (colIdx % 4 === 3) ? 8 : 0,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
