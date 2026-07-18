import { clamp } from '../../lib/utils';

export function Fader({ label, value, color }) {
  const v = clamp(value, 0, 100);
  return (
    <div className="me-fader-col">
      <div className="me-mono" style={{ fontSize: 12, color: '#EDE9F0' }}>{Math.round(v)}</div>
      <div className="me-fader-track">
        <div className="me-fader-fill" style={{ height: `${v}%`, background: `linear-gradient(180deg, ${color}, ${color}99)` }} />
        <div className="me-fader-cap" style={{ bottom: `calc(${v}% - 3px)` }} />
      </div>
      <div style={{ fontSize: 11, color: '#8B8496', textAlign: 'center', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}
