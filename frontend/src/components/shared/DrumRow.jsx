import { X } from 'lucide-react';
import { auditionDrum } from '../../lib/audio/engine';

// One drum lane. Toggling a step also fires that drum so you hear what you're
// placing; the label itself is a pad you can hit without editing anything.
// The ✕ clears just this lane — otherwise wiping a hihat is 16 clicks.
export function DrumRow({ instKey, label, icon, steps, onToggle, onClear, currentStep, color }) {
  const hasAny = steps.some(Boolean);
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
      <button
        onClick={() => onClear?.(instKey)}
        disabled={!hasAny}
        title={`${label} 라인만 지우기`}
        aria-label={`${label} 라인 지우기`}
        style={{
          width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', padding: 0,
          color: '#6B6577', cursor: hasAny ? 'pointer' : 'default', opacity: hasAny ? 1 : 0.25,
        }}
      >
        <X size={11} />
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
