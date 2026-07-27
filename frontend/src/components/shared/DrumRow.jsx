import { X } from 'lucide-react';
import { auditionDrum } from '../../lib/audio/engine';

// One drum lane. Left-click toggles a step (and fires the drum so you hear what
// you place); right-click selects a hit for the cell inspector below the grid,
// where its velocity (세기) and ratchet/roll (롤) live. Velocity shows as cell
// brightness; ratchet ≥2 shows as little pips so a roll is visible at a glance.
export function DrumRow({
  instKey, label, icon, steps, velArr, ratArr, onToggle, onClear, onSelectCell,
  selectedIdx, currentStep, color,
}) {
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
        {steps.map((on, i) => {
          const vel = velArr?.[i] ?? 100;
          const rat = ratArr?.[i] ?? 1;
          const selected = selectedIdx === i;
          return (
            <div
              key={i}
              onClick={() => { if (!on) auditionDrum(instKey); onToggle(i); }}
              onContextMenu={(e) => { e.preventDefault(); onSelectCell?.(instKey, i); }}
              title={on ? `세기 ${vel} · 롤 ${rat}× — 우클릭으로 조절` : '클릭해서 켜기 · 우클릭으로 세기/롤 조절'}
              style={{
                position: 'relative',
                width: 26, height: 26, borderRadius: 5, cursor: 'pointer', boxSizing: 'border-box',
                background: on ? color : 'rgba(255,255,255,0.06)',
                opacity: on ? 0.4 + 0.6 * (vel / 127) : 1,
                border: selected ? '2px solid #F0C24D'
                  : currentStep === i ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.12)',
                marginRight: (i % 4 === 3) ? 10 : 0,
              }}
            >
              {on && rat > 1 && (
                <div style={{
                  position: 'absolute', top: 2, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 1.5, pointerEvents: 'none',
                }}>
                  {Array.from({ length: rat }, (_, k) => (
                    <span key={k} style={{ width: 2.5, height: 5, borderRadius: 1, background: 'rgba(18,16,26,0.75)' }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
