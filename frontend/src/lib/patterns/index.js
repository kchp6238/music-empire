import { clamp } from '../utils';
import { DRUM_INSTRUMENTS, SECTION_TYPES, MELODIC_KEYS } from '../gameData/constants';

const DEFAULT_VELOCITY = 100; // 0-127, MIDI-style

export function emptySection(length) {
  const drums = {};
  DRUM_INSTRUMENTS.forEach((di) => { drums[di.key] = Array(length).fill(false); });
  const sec = { length, drums, lyrics: '' };
  MELODIC_KEYS.forEach((k) => {
    sec[k] = Array(length).fill(null);
    sec[`${k}Velocity`] = Array(length).fill(DEFAULT_VELOCITY);
  });
  return sec;
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
  const reps = length / 16;
  const tile = (arr) => { let out = []; for (let i = 0; i < reps; i++) out = out.concat(arr); return out.slice(0, length); };
  const drums = {};
  Object.keys(base).forEach((k) => { drums[k] = tile(base[k]); });
  // Start empty for every melodic lane except bass, which gets the seed line.
  const sec = emptySection(length);
  sec.drums = drums;
  sec.bass = tile(baseBass);
  return sec;
}

export function sectionHasContent(sec) {
  if (!sec) return false;
  const drumHit = Object.values(sec.drums).some((arr) => arr.some(Boolean));
  return drumHit || MELODIC_KEYS.some((k) => (sec[k] || []).some(Boolean));
}

// velocityFallback: older/NPC/community-feed song data may not have
// bassVelocity/pianoVelocity/guitarVelocity (see docs/frontend-architecture.md
// on the backend's build_combined_pattern ignoring these extra keys) —
// default to a flat velocity so playback still works, just without dynamics.
function velocityFallback(sec, track) {
  return sec[`${track}Velocity`] || Array((sec[track] || []).length).fill(100);
}

// defaultBpm: the song-level tempo each step falls back to when its section has
// no per-section BPM of its own. Playback-only extras (stepBpms, drum
// velocity/ratchet, swing) live at the TOP LEVEL, never inside `drums`, so the
// scoring analyzer — which iterates combined.drums — stays untouched.
export function buildCombinedPattern(sections, arrangement, defaultBpm) {
  const combined = { drums: {}, drumVel: {}, drumRatchet: {}, stepBpms: [] };
  DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = []; combined.drumVel[di.key] = []; combined.drumRatchet[di.key] = []; });
  MELODIC_KEYS.forEach((k) => { combined[k] = []; combined[`${k}Velocity`] = []; });
  arrangement.forEach((key) => {
    const sec = sections[key];
    if (!sec) return;
    const len = (sec.bass || []).length;
    const secBpm = sec.bpm || defaultBpm || 100;
    for (let i = 0; i < len; i++) combined.stepBpms.push(secBpm);
    DRUM_INSTRUMENTS.forEach((di) => {
      combined.drums[di.key] = combined.drums[di.key].concat(sec.drums[di.key]);
      combined.drumVel[di.key] = combined.drumVel[di.key].concat(sec.drums[`${di.key}Velocity`] || Array(len).fill(100));
      combined.drumRatchet[di.key] = combined.drumRatchet[di.key].concat(sec.drums[`${di.key}Ratchet`] || Array(len).fill(1));
    });
    MELODIC_KEYS.forEach((k) => {
      // Older/NPC song data predating this instrument has no lane — treat a
      // missing lane as all-rests of the section's length so lanes stay aligned.
      combined[k] = combined[k].concat(sec[k] || Array(len).fill(null));
      combined[`${k}Velocity`] = combined[`${k}Velocity`].concat(sec[k] ? velocityFallback(sec, k) : Array(len).fill(100));
    });
  });
  if (combined.bass.length === 0) {
    DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = [false]; });
    MELODIC_KEYS.forEach((k) => { combined[k] = [null]; combined[`${k}Velocity`] = [100]; });
    combined.stepBpms = [defaultBpm || 100];
  }
  return combined;
}

export function analyzeCombinedPattern(combined) {
  const totalSteps = combined.bass.length;
  const drumCount = Object.values(combined.drums).reduce((a, arr) => a + arr.filter(Boolean).length, 0);
  const melodicActive = MELODIC_KEYS.reduce((a, k) => a + (combined[k] || []).filter(Boolean).length, 0);
  const totalActive = drumCount + melodicActive;
  // Capacity denominator stays at the original 3 melodic lanes on purpose: the
  // new instruments add note credit (density/variety go up when you use them)
  // without inflating the denominator, so a classic 3-lane song scores exactly
  // as it did before — new instruments only ever help, never nerf.
  const capacity = Math.max(totalSteps * (DRUM_INSTRUMENTS.length + 3) * 0.3, 1);
  const density = clamp((totalActive / capacity) * 100, 0, 100);
  const uniqueNotes = new Set(MELODIC_KEYS.flatMap((k) => (combined[k] || []).filter(Boolean))).size;
  const variety = clamp(uniqueNotes * 10, 0, 100);
  return { density, variety, totalActive, totalSteps };
}

/** Start time (seconds) of each section's FIRST appearance in the arrangement
 *  — the client twin of recordings_service.section_offsets, used to schedule a
 *  section's vocal take to enter at the right moment. */
export function sectionOffsets(sections, arrangement, bpm) {
  const stepSec = 60 / (bpm || 100) / 4; // one 16th-note step
  const offsets = {};
  let cumSteps = 0;
  (arrangement || []).forEach((key) => {
    if (!(key in offsets)) offsets[key] = cumSteps * stepSec;
    const sec = sections?.[key];
    cumSteps += sec?.length || sec?.bass?.length || 16;
  });
  return offsets;
}

export function lyricsWordCount(sections, arrangement) {
  return arrangement.reduce((sum, key) => {
    const sec = sections[key];
    const txt = sec && sec.lyrics ? sec.lyrics.trim() : '';
    return sum + (txt ? txt.split(/\s+/).length : 0);
  }, 0);
}
