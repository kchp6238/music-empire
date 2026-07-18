export function MixerRow({ label, vol, mute, onVolChange, onMuteToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <button
        onClick={onMuteToggle} className="me-mono"
        style={{ width: 26, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: mute ? '#C4576B' : 'transparent', color: mute ? '#12101A' : '#8B8496', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
      >M</button>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0 }}>{label}</div>
      <input type="range" className="me-slider" min={-30} max={6} value={vol} onChange={(e) => onVolChange(Number(e.target.value))} style={{ flex: 1 }} />
      <div className="me-mono" style={{ width: 40, fontSize: 10, color: '#8B8496', textAlign: 'right', flexShrink: 0 }}>{vol}dB</div>
    </div>
  );
}
