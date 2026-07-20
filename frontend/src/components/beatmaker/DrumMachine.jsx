import { PluginWindow } from './PluginWindow';
import { Knob } from '../ui/Knob';
import { DRUM_INSTRUMENTS, DRUM_PARAM_SPECS, DRUM_KITS } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

/**
 * The drum machine plugin window: one strip per drum voice with its synthesis
 * knobs, plus preset kits. Clicking a pad auditions that drum so the knobs can
 * be dialled in without running the whole pattern.
 */
export function DrumMachine() {
  const drumParams = useGameStore((s) => s.drumParams);
  const drumKitId = useGameStore((s) => s.drumKitId);
  const setDrumParam = useGameStore((s) => s.setDrumParam);
  const applyDrumKit = useGameStore((s) => s.applyDrumKit);
  const auditionDrum = useGameStore((s) => s.auditionDrum);
  const setOpenPlugin = useGameStore((s) => s.setOpenPlugin);

  return (
    <PluginWindow
      title="DrumMachine"
      accent="#E8A33D"
      initial={{ x: 240, y: 130 }}
      onClose={() => setOpenPlugin(null)}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-[10px] font-mono text-faint">KIT</span>
        <select
          className="bg-groove border border-border rounded px-2 py-1 text-[11px] font-mono text-text outline-none"
          style={{ background: 'var(--color-groove)' }}
          value={drumKitId}
          onChange={(e) => {
            const k = DRUM_KITS.find((x) => x.id === e.target.value);
            if (k) applyDrumKit(k.id, k.params);
          }}
        >
          {drumKitId === 'custom' && <option value="custom">커스텀</option>}
          {DRUM_KITS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <span className="text-[9px] text-faint ml-auto">패드를 눌러 소리를 들어보세요</span>
      </div>

      <div className="flex gap-1.5">
        {DRUM_INSTRUMENTS.map((d) => {
          const params = drumParams[d.key] || { pitch: 0, gain: 0, decay: 100 };
          return (
            <div key={d.key} className="me-daw-groove flex flex-col items-center gap-2 px-2 py-2.5" style={{ width: 62 }}>
              <button
                className="w-full rounded text-[9px] font-mono font-bold py-1.5 cursor-pointer border-0 leading-tight"
                style={{ background: d.color, color: '#12101A' }}
                onClick={() => auditionDrum(d.key)}
                title={`${d.label} 듣기`}
              >
                <span className="block text-[13px] leading-none mb-0.5" aria-hidden>{d.icon}</span>
                {d.label}
              </button>
              {DRUM_PARAM_SPECS.map((spec) => (
                <Knob
                  key={spec.key}
                  value={params[spec.key] ?? spec.default}
                  min={spec.min} max={spec.max} step={spec.step} defaultValue={spec.default}
                  label={spec.label} unit={spec.unit} bipolar={spec.bipolar}
                  size={38} color={d.color}
                  onChange={(v) => setDrumParam(d.key, spec.key, v)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </PluginWindow>
  );
}
