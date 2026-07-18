import { clamp } from '../utils';
import { DRUM_INSTRUMENTS, SECTION_TYPES } from '../gameData/constants';

const DEFAULT_VELOCITY = 100; // 0-127, MIDI-style

export function emptySection(length) {
  const drums = {};
  DRUM_INSTRUMENTS.forEach((di) => { drums[di.key] = Array(length).fill(false); });
  return {
    length, drums,
    bass: Array(length).fill(null), bassVelocity: Array(length).fill(DEFAULT_VELOCITY),
    piano: Array(length).fill(null), pianoVelocity: Array(length).fill(DEFAULT_VELOCITY),
    guitar: Array(length).fill(null), guitarVelocity: Array(length).fill(DEFAULT_VELOCITY),
    lyrics: '',
  };
}
export function emptySections() { return Object.fromEntries(SECTION_TYPES.map((t) => [t, emptySection(16)])); }

export function basicPatternForLength(length) {
  const base = {
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihatClosed: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    hihatOpen: Array(16).fill(false),
    clap: Array(16).fill(false),
    tom: Array(16).fill(false),
    crash: Array(16).fill(false),
  };
  const baseBass = ['C2', null, null, null, null, null, 'E2', null, 'G2', null, null, null, null, null, 'E2', null];
  const baseGuitar = Array(16).fill(null);
  const basePiano = Array(16).fill(null);
  const reps = length / 16;
  const tile = (arr) => { let out = []; for (let i = 0; i < reps; i++) out = out.concat(arr); return out.slice(0, length); };
  const drums = {};
  Object.keys(base).forEach((k) => { drums[k] = tile(base[k]); });
  return {
    length, drums,
    bass: tile(baseBass), bassVelocity: Array(length).fill(DEFAULT_VELOCITY),
    piano: tile(basePiano), pianoVelocity: Array(length).fill(DEFAULT_VELOCITY),
    guitar: tile(baseGuitar), guitarVelocity: Array(length).fill(DEFAULT_VELOCITY),
    lyrics: '',
  };
}

export function sectionHasContent(sec) {
  if (!sec) return false;
  const drumHit = Object.values(sec.drums).some((arr) => arr.some(Boolean));
  return drumHit || sec.bass.some(Boolean) || sec.piano.some(Boolean) || sec.guitar.some(Boolean);
}

// velocityFallback: older/NPC/community-feed song data may not have
// bassVelocity/pianoVelocity/guitarVelocity (see docs/frontend-architecture.md
// on the backend's build_combined_pattern ignoring these extra keys) —
// default to a flat velocity so playback still works, just without dynamics.
function velocityFallback(sec, track) {
  return sec[`${track}Velocity`] || Array(sec[track].length).fill(100);
}

export function buildCombinedPattern(sections, arrangement) {
  const combined = { drums: {}, bass: [], bassVelocity: [], piano: [], pianoVelocity: [], guitar: [], guitarVelocity: [] };
  DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = []; });
  arrangement.forEach((key) => {
    const sec = sections[key];
    if (!sec) return;
    DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = combined.drums[di.key].concat(sec.drums[di.key]); });
    combined.bass = combined.bass.concat(sec.bass);
    combined.bassVelocity = combined.bassVelocity.concat(velocityFallback(sec, 'bass'));
    combined.piano = combined.piano.concat(sec.piano);
    combined.pianoVelocity = combined.pianoVelocity.concat(velocityFallback(sec, 'piano'));
    combined.guitar = combined.guitar.concat(sec.guitar);
    combined.guitarVelocity = combined.guitarVelocity.concat(velocityFallback(sec, 'guitar'));
  });
  if (combined.bass.length === 0) {
    DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = [false]; });
    combined.bass = [null]; combined.bassVelocity = [100];
    combined.piano = [null]; combined.pianoVelocity = [100];
    combined.guitar = [null]; combined.guitarVelocity = [100];
  }
  return combined;
}

export function analyzeCombinedPattern(combined) {
  const totalSteps = combined.bass.length;
  const drumCount = Object.values(combined.drums).reduce((a, arr) => a + arr.filter(Boolean).length, 0);
  const bassCount = combined.bass.filter(Boolean).length;
  const pianoCount = combined.piano.filter(Boolean).length;
  const guitarCount = combined.guitar.filter(Boolean).length;
  const totalActive = drumCount + bassCount + pianoCount + guitarCount;
  const capacity = Math.max(totalSteps * (DRUM_INSTRUMENTS.length + 3) * 0.3, 1);
  const density = clamp((totalActive / capacity) * 100, 0, 100);
  const uniqueNotes = new Set([...combined.bass.filter(Boolean), ...combined.piano.filter(Boolean), ...combined.guitar.filter(Boolean)]).size;
  const variety = clamp(uniqueNotes * 10, 0, 100);
  return { density, variety, totalActive, totalSteps };
}

export function lyricsWordCount(sections, arrangement) {
  return arrangement.reduce((sum, key) => {
    const sec = sections[key];
    const txt = sec && sec.lyrics ? sec.lyrics.trim() : '';
    return sum + (txt ? txt.split(/\s+/).length : 0);
  }, 0);
}
