export function DrumRow({ label, steps, onToggle, currentStep, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0 }}>{label}</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {steps.map((on, i) => (
          <div
            key={i}
            onClick={() => onToggle(i)}
            style={{
              width: 26, height: 26, borderRadius: 5, cursor: 'pointer', boxSizing: 'border-box',
              background: on ? color : 'rgba(255,255,255,0.06)',
              border: currentStep === i ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.12)',
              marginRight: (i % 4 === 3) ? 10 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
