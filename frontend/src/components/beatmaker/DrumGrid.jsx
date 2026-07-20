import { DrumRow } from '../shared/DrumRow';
import { DRUM_INSTRUMENTS } from '../../lib/gameData/constants';

export function DrumGrid({ section, onToggle, onClearLane, currentStep }) {
  return (
    <>
      {DRUM_INSTRUMENTS.map((di) => (
        <DrumRow
          key={di.key} instKey={di.key} label={di.label} icon={di.icon}
          steps={section.drums[di.key]} onToggle={(i) => onToggle(di.key, i)}
          onClear={onClearLane}
          currentStep={currentStep} color={di.color}
        />
      ))}
    </>
  );
}
