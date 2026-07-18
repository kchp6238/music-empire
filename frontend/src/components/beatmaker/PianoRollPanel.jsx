import { PianoRoll } from '../shared/PianoRoll';
import { PianoKeyRoll } from '../shared/PianoKeyRoll';
import { VelocityLane } from '../shared/VelocityLane';
import { BASS_PITCHES, GUITAR_PITCHES, PIANO_PITCHES } from '../../lib/gameData/constants';

export function BassGuitarPanel({ section, onSetNote, onPaintRange, onSetVelocity, currentStep }) {
  return (
    <>
      <PianoRoll label="베이스" pitches={BASS_PITCHES} steps={section.bass} onSetNote={(i, p) => onSetNote('bass', i, p)} onPaintRange={(from, to, p) => onPaintRange('bass', from, to, p)} currentStep={currentStep} color="#5FBF8F" />
      <VelocityLane steps={section.bass} velocities={section.bassVelocity} onSetVelocity={(i, v) => onSetVelocity('bass', i, v)} color="#5FBF8F" />
      <PianoRoll label="기타" pitches={GUITAR_PITCHES} steps={section.guitar} onSetNote={(i, p) => onSetNote('guitar', i, p)} onPaintRange={(from, to, p) => onPaintRange('guitar', from, to, p)} currentStep={currentStep} color="#E8C34D" />
      <VelocityLane steps={section.guitar} velocities={section.guitarVelocity} onSetVelocity={(i, v) => onSetVelocity('guitar', i, v)} color="#E8C34D" />
    </>
  );
}

export function PianoPanel({ section, onSetNote, onPaintRange, onAdjustVelocity, currentStep }) {
  return (
    <PianoKeyRoll
      label="피아노" pitches={[...PIANO_PITCHES].reverse()} steps={section.piano} velocities={section.pianoVelocity}
      onSetNote={(i, p) => onSetNote('piano', i, p)} onPaintRange={(from, to, p) => onPaintRange('piano', from, to, p)}
      onAdjustVelocity={(i, delta) => onAdjustVelocity('piano', i, delta)}
      currentStep={currentStep} color="#B794F4"
    />
  );
}
