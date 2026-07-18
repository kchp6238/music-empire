export function PianoKeyRoll({ label, pitches, steps, onSetNote, currentStep, color }) {
  const cellW = 22;
  const rowH = 18;
  const whiteKeyH = 46;
  const blackKeyH = 28;
  const width = pitches.length * cellW;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>{label} — 실제 건반처럼 가로로 배열, 스텝은 아래로 진행</div>
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
                const active = steps[stepIdx] === p;
                return (
                  <div
                    key={p}
                    onClick={() => onSetNote(stepIdx, p)}
                    style={{
                      width: cellW, height: rowH, cursor: 'pointer', boxSizing: 'border-box',
                      background: active ? color : (p.includes('#') ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)'),
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
