import { Sliders } from 'lucide-react';
import { MixerRow } from '../shared/MixerRow';
import { MIXER_TRACKS } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

export function Mixer() {
  const mixer = useGameStore((s) => s.mixer);
  const fx = useGameStore((s) => s.fx);
  const setMixerVol = useGameStore((s) => s.setMixerVol);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setFx = useGameStore((s) => s.setFx);

  return (
    <div className="me-panel" style={{ marginBottom: 20 }}>
      <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sliders size={18} style={{ color: '#E8A33D' }} /> 믹서 & 이펙트
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 28px' }}>
        {MIXER_TRACKS.map((t) => (
          <MixerRow
            key={t.key} label={t.label} vol={mixer[t.key].vol} mute={mixer[t.key].mute}
            onVolChange={(v) => setMixerVol(t.key, v)}
            onMuteToggle={() => toggleMute(t.key)}
          />
        ))}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0 16px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>리버브 <span className="me-mono">{fx.reverbWet}%</span></div>
          <input type="range" className="me-slider" min={0} max={100} value={fx.reverbWet} onChange={(e) => setFx('reverbWet', Number(e.target.value))} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>딜레이 <span className="me-mono">{fx.delayWet}%</span></div>
          <input type="range" className="me-slider" min={0} max={100} value={fx.delayWet} onChange={(e) => setFx('delayWet', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
