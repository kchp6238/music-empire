import { PianoRoll } from '../shared/PianoRoll';
import { PianoKeyRoll } from '../shared/PianoKeyRoll';
import { VelocityLane } from '../shared/VelocityLane';
import { PIANO_PITCHES, CHANNELS, MELODIC_BY_KEY } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

const iconFor = (key) => CHANNELS.find((c) => c.key === key)?.icon;

// 이어서(sustain) vs 또박또박(retrigger): how a run of the same pitch plays.
function RetrigToggle({ track, section }) {
  const toggleRetrig = useGameStore((s) => s.toggleRetrig);
  const on = Boolean(section[`${track}Retrig`]);
  return (
    <div className="flex items-center gap-2 mb-2" style={{ marginLeft: 92 }}>
      <span className="text-[10px] text-faint">같은 음 이어붙일 때:</span>
      <button
        onClick={() => toggleRetrig(track)}
        className="me-pill small"
        style={on ? { borderColor: '#4FD1C5', color: '#4FD1C5' } : {}}
        title="여러 칸에 같은 음을 이어 놓았을 때 — 길게 한 음(띵~~~)으로 낼지, 또박또박(띵띵띵) 낼지"
      >
        {on ? '🥁 또박또박 (띵띵띵)' : '➖ 이어서 (띵~~~)'}
      </button>
    </div>
  );
}

/** A single melodic lane + its velocity strip — the channel rack shows one
 *  instrument at a time, so each pitched track is rendered independently. Any
 *  track in MELODIC_BY_KEY works here (bass/guitar and the newer roster). */
export function MelodicPanel({ track, section, onSetNote, onPaintRange, onSetVelocity, currentStep }) {
  const cfg = MELODIC_BY_KEY[track];
  return (
    <>
      <div className="text-[10px] text-faint mb-1" style={{ marginLeft: 92 }}>
        같은 칸에 여러 음을 눌러 <span className="text-text/80">화음</span>을 만들 수 있어요.
      </div>
      <PianoRoll
        label={cfg.label} icon={iconFor(track)} track={track}
        pitches={cfg.pitches} steps={section[track]}
        onSetNote={(i, p) => onSetNote(track, i, p)}
        onPaintRange={(from, to, p) => onPaintRange(track, from, to, p)}
        currentStep={currentStep} color={cfg.color}
      />
      <RetrigToggle track={track} section={section} />
      <VelocityLane
        steps={section[track]} velocities={section[`${track}Velocity`]}
        onSetVelocity={(i, v) => onSetVelocity(track, i, v)} color={cfg.color}
      />
    </>
  );
}

export function PianoPanel({ section, onSetNote, onPaintRange, onAdjustVelocity, currentStep }) {
  return (
    <>
      <div className="text-[10px] text-faint mb-1">같은 칸에 여러 음을 눌러 <span className="text-text/80">화음</span>을 만들 수 있어요.</div>
      <PianoKeyRoll
        label="피아노" icon={iconFor('piano')} track="piano"
        pitches={[...PIANO_PITCHES].reverse()} steps={section.piano} velocities={section.pianoVelocity}
        onSetNote={(i, p) => onSetNote('piano', i, p)} onPaintRange={(from, to, p) => onPaintRange('piano', from, to, p)}
        onAdjustVelocity={(i, delta) => onAdjustVelocity('piano', i, delta)}
        currentStep={currentStep} color="#B794F4"
      />
      <RetrigToggle track="piano" section={section} />
    </>
  );
}
