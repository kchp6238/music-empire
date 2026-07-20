import { auditionDrum } from '../../lib/audio/engine';

// One drum lane. Toggling a step also fires that drum so you hear what you're
// placing; the label itself is a pad you can hit without editing anything.
export function DrumRow({ instKey, label, icon, steps, onToggle, currentStep, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <button
        onClick={() => auditionDrum(instKey)}
        title={`${label} 듣기`}
        style={{
          width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0, textAlign: 'left',
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        }}
      >
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </button>
      <div style={{ display: 'flex', gap: 5 }}>
        {steps.map((on, i) => (
          <div
            key={i}
            onClick={() => { if (!on) auditionDrum(instKey); onToggle(i); }}
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
