import { PluginWindow } from './PluginWindow';
import { Knob } from '../ui/Knob';
import { CHANNELS, EFFECT_TYPES } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

/** One open insert effect: its knobs, wired straight to the live Tone node. */
export function EffectWindow({ channel, effect, index }) {
  const setChannelEffectParam = useGameStore((s) => s.setChannelEffectParam);
  const toggleEffectWindow = useGameStore((s) => s.toggleEffectWindow);

  const spec = EFFECT_TYPES[effect.type];
  const channelLabel = CHANNELS.find((c) => c.key === channel)?.label || channel;

  return (
    <PluginWindow
      title={`${spec.label} — ${channelLabel}`}
      accent={spec.color}
      initial={{ x: 300 + index * 28, y: 180 + index * 28 }}
      onClose={() => toggleEffectWindow(effect.id)}
    >
      <div className="flex gap-4 px-2 py-1">
        {spec.params.map((p) => (
          <Knob
            key={p.key}
            value={effect[p.key] ?? p.default}
            min={p.min} max={p.max} step={p.step} defaultValue={p.default}
            label={p.label} unit="%" size={46} color={spec.color}
            onChange={(v) => setChannelEffectParam(channel, effect.id, p.key, v)}
          />
        ))}
      </div>
    </PluginWindow>
  );
}
