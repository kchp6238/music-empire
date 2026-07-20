import { Library, Mic } from 'lucide-react';
import { PATTERN_PRESETS, PRESET_STEP_LENGTH, DRUM_INSTRUMENTS } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

// Tiny 16-step preview of what a preset lays down, so the list reads as
// rhythms rather than as six identical rows of text.
function PresetPreview({ steps }) {
  const lanes = DRUM_INSTRUMENTS.filter((d) => (steps[d.key] || []).length > 0).slice(0, 3);
  return (
    <div className="flex flex-col gap-[2px] mt-1.5">
      {lanes.map((d) => {
        const hits = new Set(steps[d.key]);
        return (
          <div key={d.key} className="flex gap-[1px]">
            {Array.from({ length: PRESET_STEP_LENGTH }, (_, i) => (
              <span
                key={i}
                className="flex-1 rounded-[1px]"
                style={{ height: 3, background: hits.has(i) ? d.color : 'rgba(255,255,255,0.07)' }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Right-hand library pane — click a groove to lay it into the section that's
 *  currently open in the editor. */
export function PresetLibrary({ onOpenVoice }) {
  const applyDrumPreset = useGameStore((s) => s.applyDrumPreset);
  const editingSection = useGameStore((s) => s.draft.editingSection);
  const selectChannel = useGameStore((s) => s.selectChannel);

  return (
    <div className="flex flex-col gap-2">
      <button
        className="me-rack-row p-2.5 text-left cursor-pointer w-full"
        style={{ borderColor: 'rgba(232,147,166,0.45)' }}
        onClick={onOpenVoice}
      >
        <div className="text-[11px] font-semibold text-text flex items-center gap-1.5">
          <Mic size={12} className="text-pink" /> 목소리로 찍기
        </div>
        <div className="text-[9px] text-faint leading-tight mt-0.5">
          입으로 리듬을 내거나 멜로디를 흥얼거리면 그대로 찍힙니다
        </div>
      </button>

      <div className="text-[10px] font-mono uppercase tracking-widest text-faint px-1 flex items-center gap-1.5 mt-1">
        <Library size={11} /> Pattern Library
      </div>
      <div className="text-[10px] text-faint px-1 -mt-1">
        클릭하면 <span className="text-muted">{editingSection}</span> 구간의 드럼에 적용됩니다.
      </div>
      {PATTERN_PRESETS.map((p) => (
        <button
          key={p.id}
          className="me-rack-row p-2.5 text-left cursor-pointer w-full"
          onClick={() => { applyDrumPreset(p); selectChannel('drums'); }}
          title={`${p.label} 패턴을 ${editingSection}에 적용`}
        >
          <div className="text-[11px] font-semibold text-text">{p.label}</div>
          <div className="text-[9px] text-faint leading-tight">{p.desc}</div>
          <PresetPreview steps={p.steps} />
        </button>
      ))}
    </div>
  );
}
