import { PianoRoll } from '../shared/PianoRoll';
import { PianoKeyRoll } from '../shared/PianoKeyRoll';
import { BASS_PITCHES, GUITAR_PITCHES, PIANO_PITCHES } from '../../lib/gameData/constants';

export function BassGuitarPanel({ section, onSetNote, currentStep }) {
  return (
    <>
      <PianoRoll label="베이스" pitches={BASS_PITCHES} steps={section.bass} onSetNote={(i, p) => onSetNote('bass', i, p)} currentStep={currentStep} color="#5FBF8F" />
      <PianoRoll label="기타" pitches={GUITAR_PITCHES} steps={section.guitar} onSetNote={(i, p) => onSetNote('guitar', i, p)} currentStep={currentStep} color="#E8C34D" />
    </>
  );
}

export function PianoPanel({ section, onSetNote, currentStep }) {
  return (
    <PianoKeyRoll label="피아노" pitches={[...PIANO_PITCHES].reverse()} steps={section.piano} onSetNote={(i, p) => onSetNote('piano', i, p)} currentStep={currentStep} color="#B794F4" />
  );
}
