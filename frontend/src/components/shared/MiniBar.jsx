import { clamp } from '../../lib/utils';

export function MiniBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8B8496', marginBottom: 2 }}>
        <span>{label}</span><span className="me-mono">{Math.round(value)}</span>
      </div>
      <div style={{ height: 6, background: '#0E0C14', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamp(value, 0, 100)}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}
