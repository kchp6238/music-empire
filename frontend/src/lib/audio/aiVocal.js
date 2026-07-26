import * as Tone from 'tone';
import { audioBufferToWav } from './autotune';

/**
 * AI vocals, two ways:
 *  - renderAiVocal(): a synth "voice" that SINGS a melody on a vowel (ah/oo/ee),
 *    rendered offline to a WAV blob so it can be uploaded as a vocal take and
 *    layered over the beat like a recorded one. Not lyrics — real singing needs
 *    a hosted model — but an actual on-pitch vocal-timbre line.
 *  - speakLyrics(): reads the lyrics aloud via the browser's speech synthesis
 *    (spoken, not sung), for a quick "AI reads my lyrics" preview.
 */

// Vowel formant pairs (F1, F2 in Hz) — two bandpass peaks that read as a vowel.
const FORMANTS = { ah: [800, 1150], oo: [350, 640], ee: [300, 2300] };

// Merge consecutive equal-pitch steps into sustained notes (same idea as the
// engine's computeRuns) so held notes sing as one long tone.
function runs(steps) {
  const out = [];
  let i = 0;
  while (i < steps.length) {
    if (!steps[i]) { i++; continue; }
    const pitch = steps[i];
    let j = i + 1;
    while (j < steps.length && steps[j] === pitch) j++;
    out.push({ start: i, length: j - i, pitch });
    i = j;
  }
  return out;
}

export function hasMelody(steps) {
  return Array.isArray(steps) && steps.some(Boolean);
}

export async function renderAiVocal(steps, bpm, { vowel = 'ah' } = {}) {
  const notes = runs(steps || []);
  if (!notes.length) throw new Error('부를 멜로디가 없어요');
  const stepSec = 60 / (bpm || 100) / 4;
  const totalSteps = steps.length;
  const duration = totalSteps * stepSec + 1.2;
  const [f1hz, f2hz] = FORMANTS[vowel] || FORMANTS.ah;

  const rendered = await Tone.Offline(() => {
    // glottal source → two parallel formant bandpasses → vibrato → out
    const source = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.95, release: 0.28 },
      filterEnvelope: { attack: 0.02, decay: 0.1, sustain: 1, baseFrequency: 200, octaves: 2 },
    });
    const out = new Tone.Gain(0.85).toDestination();
    const vib = new Tone.Vibrato({ frequency: 5.2, depth: 0.12 }).connect(out);
    const f1 = new Tone.Filter({ type: 'bandpass', frequency: f1hz, Q: 6 }).connect(vib);
    const f2 = new Tone.Filter({ type: 'bandpass', frequency: f2hz, Q: 9 }).connect(vib);
    source.connect(f1);
    source.connect(f2);
    notes.forEach((n) => {
      const t = n.start * stepSec;
      source.triggerAttackRelease(n.pitch, stepSec * n.length * 0.92, t, 0.9);
    });
  }, duration);

  const audioBuffer = rendered.get ? rendered.get() : rendered;
  return { blob: audioBufferToWav(audioBuffer), durationSec: audioBuffer.duration };
}

/** Read text aloud (spoken, Korean voice if available). Returns false if the
 *  browser has no speech synthesis. */
export function speakLyrics(text) {
  if (!('speechSynthesis' in window) || !text || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.lang = 'ko-KR';
  u.rate = 0.95;
  const ko = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('ko'));
  if (ko) u.voice = ko;
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
