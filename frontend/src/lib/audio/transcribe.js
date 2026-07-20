import { detectPitch, freqToMidi, snapMidiToScale, midiToName } from './autotune';

/**
 * Turn a voice recording into pattern data — hum a melody or beatbox a
 * rhythm and get notes on the grid, so you can write a part without knowing
 * how to play anything.
 *
 * Two paths share one front end (decode → onset detection → quantise):
 *  - drums: each onset is classified by brightness into kick/snare/hihat
 *  - melody: each onset's pitch is detected, snapped to the key, and written
 *    as a run of repeated steps (which engine.js merges into one held note)
 *
 * Everything runs offline over a decoded AudioBuffer; nothing here touches
 * the live audio graph.
 */

const FRAME = 1024;
const HOP = 256;

/** Decode a recorded Blob into a mono Float32Array + sample rate. */
export async function decodeToMono(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const { numberOfChannels, length, sampleRate } = buf;
    if (numberOfChannels === 1) return { data: buf.getChannelData(0).slice(), sampleRate, duration: buf.duration };
    const mono = new Float32Array(length);
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += d[i] / numberOfChannels;
    }
    return { data: mono, sampleRate, duration: buf.duration };
  } finally {
    ctx.close();
  }
}

/** Per-frame RMS and spectral brightness (zero-crossing rate). Brightness is
 *  what separates a "ts" from a "doom" without needing an FFT. */
function analyseFrames(data, sampleRate) {
  const frames = [];
  for (let pos = 0; pos + FRAME <= data.length; pos += HOP) {
    let sumSq = 0;
    let crossings = 0;
    let prev = data[pos];
    for (let i = 0; i < FRAME; i++) {
      const v = data[pos + i];
      sumSq += v * v;
      if ((v >= 0) !== (prev >= 0)) crossings++;
      prev = v;
    }
    frames.push({
      pos,
      time: pos / sampleRate,
      rms: Math.sqrt(sumSq / FRAME),
      zcr: crossings / FRAME,
    });
  }
  return frames;
}

/**
 * Onsets = frames where energy rises sharply above the recent average.
 * A relative threshold (rather than a fixed one) is what lets the same code
 * work for a quiet hum and a loud beatbox without a sensitivity slider.
 */
function detectOnsets(frames, { sensitivity = 1 }) {
  const peak = frames.reduce((m, f) => Math.max(m, f.rms), 0);
  if (peak <= 0.001) return [];
  const floor = peak * 0.12 * sensitivity;

  const onsets = [];
  let lastOnsetFrame = -999;
  // ~60ms of lockout, so one hit's decay can't register as a second hit
  const minGap = Math.ceil(0.06 / (HOP / 44100));

  for (let i = 2; i < frames.length - 1; i++) {
    const f = frames[i];
    if (f.rms < floor) continue;
    const prevAvg = (frames[i - 1].rms + frames[i - 2].rms) / 2;
    const rising = f.rms > prevAvg * 1.6 && f.rms >= frames[i + 1].rms * 0.8;
    if (rising && i - lastOnsetFrame >= minGap) {
      onsets.push(f);
      lastOnsetFrame = i;
    }
  }
  return onsets;
}

/** Which 16th-note step a time falls on, for a given tempo. */
function stepForTime(time, bpm, offset) {
  const stepSec = 60 / bpm / 4;
  return Math.round((time - offset) / stepSec);
}

/**
 * Beatbox → drum lanes. Classification is deliberately coarse — three
 * recognisable mouth sounds beat seven unreliable ones:
 *   low + dull  -> kick, mid + noisy -> snare, high + very noisy -> hihat
 */
export function transcribeDrums(mono, sampleRate, { bpm, steps, sensitivity = 1 }) {
  const frames = analyseFrames(mono, sampleRate);
  const onsets = detectOnsets(frames, { sensitivity });
  const hits = { kick: [], snare: [], hihatClosed: [] };
  if (onsets.length === 0) return { hits, onsetCount: 0 };

  // Anchor the grid on the first hit so you don't have to start exactly on
  // the beat — everything is measured relative to when you actually began.
  const offset = onsets[0].time;

  onsets.forEach((o) => {
    const step = stepForTime(o.time, bpm, offset);
    if (step < 0 || step >= steps) return;
    const lane = o.zcr > 0.22 ? 'hihatClosed' : o.zcr > 0.09 ? 'snare' : 'kick';
    if (!hits[lane].includes(step)) hits[lane].push(step);
  });

  Object.values(hits).forEach((arr) => arr.sort((a, b) => a - b));
  return { hits, onsetCount: onsets.length };
}

/**
 * Hum → a melodic lane. Each onset starts a note that runs until the next
 * onset (or until the voice drops out), written as repeated steps so the
 * engine sounds it as one held note.
 */
export function transcribeMelody(mono, sampleRate, {
  bpm, steps, keyIndex = 0, scale = 'major', pitches, sensitivity = 1,
}) {
  const frames = analyseFrames(mono, sampleRate);
  const onsets = detectOnsets(frames, { sensitivity });
  const notes = Array(steps).fill(null);
  if (onsets.length === 0) return { notes, noteCount: 0 };

  const offset = onsets[0].time;
  const allowed = new Set(pitches);

  // The pitch of a note is the median of its frames — one bad frame at the
  // attack transient shouldn't decide the whole note.
  const midiBetween = (fromPos, toPos) => {
    const found = [];
    for (let pos = fromPos; pos + FRAME <= Math.min(toPos, mono.length); pos += HOP) {
      const hz = detectPitch(mono.subarray(pos, pos + FRAME), sampleRate);
      if (hz > 0) found.push(freqToMidi(hz));
    }
    if (found.length === 0) return null;
    found.sort((a, b) => a - b);
    return found[Math.floor(found.length / 2)];
  };

  let noteCount = 0;
  onsets.forEach((o, i) => {
    const startStep = stepForTime(o.time, bpm, offset);
    if (startStep < 0 || startStep >= steps) return;
    const next = onsets[i + 1];
    const endStep = next ? Math.min(steps, stepForTime(next.time, bpm, offset)) : steps;
    const endPos = next ? next.pos : mono.length;

    const midi = midiBetween(o.pos, endPos);
    if (midi === null) return;

    // Snap into the key, then fold into the lane's octave range — a hum an
    // octave below the bass lane should still land on the right note.
    let snapped = snapMidiToScale(midi, keyIndex, scale);
    let name = midiToName(snapped);
    for (let shift = -2; shift <= 2 && !allowed.has(name); shift++) {
      name = midiToName(snapped + shift * 12);
    }
    if (!allowed.has(name)) return;

    for (let s = startStep; s < Math.max(startStep + 1, endStep); s++) notes[s] = name;
    noteCount++;
  });

  return { notes, noteCount };
}
