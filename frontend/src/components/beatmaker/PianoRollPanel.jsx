import { PianoRoll } from '../shared/PianoRoll';
import { PianoKeyRoll } from '../shared/PianoKeyRoll';
import { VelocityLane } from '../shared/VelocityLane';
import { PIANO_PITCHES, CHANNELS, MELODIC_BY_KEY } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

const iconFor = (key) => CHANNELS.find((c) => c.key === key)?.icon;

// How clicks vs drags shape a note, plus how to convert one after the fact.
function Hint() {
  return (
    <div className="text-[10px] text-faint mb-1" style={{ marginLeft: 92 }}>
      같은 칸에 여러 음 = <span className="text-text/80">화음</span> · 하나씩 클릭 = <span className="text-text/80">또박또박(띵띵띵)</span>, 드래그 = <span className="text-text/80">길게(띵~~~)</span> · 음 <span className="text-text/80">우클릭</span>으로 서로 전환
    </div>
  );
}

/** A single melodic lane + its velocity strip — the channel rack shows one
 *  instrument at a time, so each pitched track is rendered independently. Any
 *  track in MELODIC_BY_KEY works here (bass/guitar and the newer roster). */
export function MelodicPanel({ track, section, onSetNote, onPaintRange, onSetVelocity, currentStep }) {
  const cfg = MELODIC_BY_KEY[track];
  const toggleCellRetrig = useGameStore((s) => s.toggleCellRetrig);
  return (
    <>
      <Hint />
      <PianoRoll
        label={cfg.label} icon={iconFor(track)} track={track}
        pitches={cfg.pitches} steps={section[track]} retrig={section[`${track}Retrig`]}
        onSetNote={(i, p) => onSetNote(track, i, p)}
        onPaintRange={(from, to, p) => onPaintRange(track, from, to, p)}
        onToggleRetrig={(i) => toggleCellRetrig(track, i)}
        currentStep={currentStep} color={cfg.color}
      />
      <VelocityLane
        steps={section[track]} velocities={section[`${track}Velocity`]}
        onSetVelocity={(i, v) => onSetVelocity(track, i, v)} color={cfg.color}
      />
    </>
  );
}

export function PianoPanel({ section, onSetNote, onPaintRange, onAdjustVelocity, currentStep }) {
  const toggleCellRetrig = useGameStore((s) => s.toggleCellRetrig);
  return (
    <>
      <Hint />
      <PianoKeyRoll
        label="피아노" icon={iconFor('piano')} track="piano"
        pitches={[...PIANO_PITCHES].reverse()} steps={section.piano} velocities={section.pianoVelocity} retrig={section.pianoRetrig}
        onSetNote={(i, p) => onSetNote('piano', i, p)} onPaintRange={(from, to, p) => onPaintRange('piano', from, to, p)}
        onAdjustVelocity={(i, delta) => onAdjustVelocity('piano', i, delta)}
        onToggleRetrig={(i) => toggleCellRetrig('piano', i)}
        currentStep={currentStep} color="#B794F4"
      />
    </>
  );
}
