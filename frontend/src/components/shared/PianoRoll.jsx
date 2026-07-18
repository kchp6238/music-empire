export function PianoRoll({ label, pitches, steps, onSetNote, currentStep, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0, paddingTop: 2 }}>{label}</div>
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
                  const active = val === p;
                  return (
                    <div
                      key={colIdx}
                      onClick={() => onSetNote(colIdx, p)}
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
