// Horizontal velocity strip beneath a PianoRoll (bass/guitar) — one bar per
// step, only interactive where that step has a note. Drag a bar vertically
// to set 1-127. Not used by PianoKeyRoll (transposed layout — see its own
// velocity-by-drag-on-note-cell handling instead).
export function VelocityLane({ steps, velocities, onSetVelocity, cellWidth = 22, leftOffset = 118, color = '#8B7FD1' }) {
  const height = 36;

  function startDrag(idx, e) {
    if (!steps[idx]) return;
    e.preventDefault();
    const track = e.currentTarget.parentElement.getBoundingClientRect();
    function apply(clientY) {
      const ratio = 1 - Math.max(0, Math.min(1, (clientY - track.top) / track.height));
      onSetVelocity(idx, Math.round(ratio * 127));
    }
    apply(e.clientY); // from the React onMouseDown handler itself — no deferral needed
    // queueMicrotask: subsequent calls run inside a native mousemove listener
    // — see Timeline.jsx's onResizeStart for why this avoids a React warning.
    function onMove(ev) { queueMicrotask(() => apply(ev.clientY)); }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
      <div style={{ width: leftOffset - 8, fontSize: 10, color: '#6B6577', flexShrink: 0, textAlign: 'right', paddingTop: 12 }}>벨로시티</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', height, position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
        {steps.map((val, idx) => {
          const active = Boolean(val);
          const v = velocities?.[idx] ?? 100;
          const barH = active ? Math.max(3, (v / 127) * height) : 2;
          return (
            <div
              key={idx}
              onMouseDown={(e) => startDrag(idx, e)}
              title={active ? `벨로시티 ${v}` : undefined}
              style={{
                width: cellWidth, height, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                cursor: active ? 'ns-resize' : 'default', marginRight: (idx % 4 === 3) ? 8 : 0,
              }}
            >
              <div style={{ width: cellWidth - 8, height: barH, background: active ? color : 'rgba(255,255,255,0.06)', borderRadius: 2, transition: 'height .05s' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
