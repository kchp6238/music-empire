import { useState } from 'react';
import { Plus, Sliders, X } from 'lucide-react';
import { CHANNELS, EFFECT_TYPES, EFFECT_TYPE_KEYS } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

/**
 * The channel rack — one row per mixer channel, each with its fader, mute and
 * its own insert-effect chain. Selecting a row drives which editor the centre
 * pane shows; channels with a plugin (currently just the drum machine) get a
 * button that opens its window.
 */
export function ChannelRack() {
  const channelMix = useGameStore((s) => s.channelMix);
  const channelFx = useGameStore((s) => s.channelFx);
  const selectedChannel = useGameStore((s) => s.selectedChannel);
  const openEffectIds = useGameStore((s) => s.openEffectIds);
  const selectChannel = useGameStore((s) => s.selectChannel);
  const setChannelVol = useGameStore((s) => s.setChannelVol);
  const toggleChannelMute = useGameStore((s) => s.toggleChannelMute);
  const setOpenPlugin = useGameStore((s) => s.setOpenPlugin);
  const addChannelEffect = useGameStore((s) => s.addChannelEffect);
  const removeChannelEffect = useGameStore((s) => s.removeChannelEffect);
  const toggleEffectWindow = useGameStore((s) => s.toggleEffectWindow);

  const [addingFor, setAddingFor] = useState(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-faint px-1">Channels</div>
      {CHANNELS.map((ch) => {
        const mix = channelMix[ch.key];
        const effects = channelFx[ch.key] || [];
        const selected = selectedChannel === ch.key;
        return (
          <div key={ch.key} className={`me-rack-row p-2.5 ${selected ? 'active' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-[13px] leading-none shrink-0" aria-hidden>{ch.icon}</span>
              <button
                className="flex-1 text-left text-xs font-semibold truncate bg-transparent border-0 p-0 cursor-pointer"
                style={{ color: selected ? 'var(--color-text)' : 'var(--color-muted)' }}
                onClick={() => selectChannel(ch.key)}
              >
                {ch.label}
              </button>
              {ch.plugin && (
                <button
                  className="bg-transparent border-0 p-0.5 cursor-pointer text-faint hover:text-accent2"
                  title="플러그인 열기"
                  aria-label={`${ch.label} 플러그인 열기`}
                  onClick={() => setOpenPlugin(ch.plugin)}
                >
                  <Sliders size={13} />
                </button>
              )}
              <button
                className="text-[9px] font-mono w-5 h-5 rounded border cursor-pointer shrink-0"
                style={{
                  borderColor: mix.mute ? 'var(--color-danger)' : 'rgba(255,255,255,0.15)',
                  background: mix.mute ? 'var(--color-danger)' : 'transparent',
                  color: mix.mute ? '#12101A' : 'var(--color-faint)',
                }}
                title={mix.mute ? '음소거 해제' : '음소거'}
                onClick={() => toggleChannelMute(ch.key)}
              >M</button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="range" className="me-slider flex-1" min={-30} max={6} step={0.5}
                value={mix.vol} onChange={(e) => setChannelVol(ch.key, Number(e.target.value))}
                aria-label={`${ch.label} 볼륨`}
              />
              <span className="font-mono text-[9px] text-faint w-9 text-right">
                {mix.vol > 0 ? '+' : ''}{mix.vol.toFixed(1)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              {effects.map((e) => {
                const spec = EFFECT_TYPES[e.type];
                const open = openEffectIds.includes(e.id);
                return (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded text-[9px] font-mono border"
                    style={{
                      borderColor: open ? spec.color : 'rgba(255,255,255,0.12)',
                      color: open ? spec.color : 'var(--color-muted)',
                      background: 'var(--color-groove)',
                    }}
                  >
                    <button
                      className="bg-transparent border-0 p-0 cursor-pointer text-inherit"
                      onClick={() => toggleEffectWindow(e.id)}
                      title={`${spec.label} 창 ${open ? '닫기' : '열기'}`}
                    >{spec.label}</button>
                    <button
                      className="bg-transparent border-0 p-0 cursor-pointer text-faint hover:text-danger leading-none"
                      onClick={() => removeChannelEffect(ch.key, e.id)}
                      aria-label={`${spec.label} 제거`}
                    ><X size={9} /></button>
                  </span>
                );
              })}

              {addingFor === ch.key ? (
                <span className="inline-flex gap-1">
                  {EFFECT_TYPE_KEYS.map((t) => (
                    <button
                      key={t}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer"
                      style={{ borderColor: EFFECT_TYPES[t].color, color: EFFECT_TYPES[t].color, background: 'transparent' }}
                      onClick={() => { addChannelEffect(ch.key, t); setAddingFor(null); }}
                    >{EFFECT_TYPES[t].label}</button>
                  ))}
                  <button
                    className="px-1 py-0.5 rounded text-[9px] border border-border text-faint cursor-pointer bg-transparent"
                    onClick={() => setAddingFor(null)}
                  >취소</button>
                </span>
              ) : (
                <button
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] border border-dashed cursor-pointer bg-transparent"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--color-faint)' }}
                  onClick={() => setAddingFor(ch.key)}
                ><Plus size={9} /> 이펙트</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
