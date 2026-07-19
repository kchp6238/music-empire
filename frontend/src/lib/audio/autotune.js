/**
 * Offline autotune (pitch correction) for recorded vocal takes.
 *
 * Runs on a finished take rather than live: analysing the whole buffer gives
 * far better detection than a real-time worklet, and the studio's flow is
 * "record a take, then process it" anyway.
 *
 * Pipeline, per overlapping block:
 *   1. detect fundamental (autocorrelation)
 *   2. find the nearest allowed note in the chosen key/scale
 *   3. pitch-shift that block toward it (granular resample + overlap-add)
 *
 * Strength 1.0 snaps hard (the recognisable "T-Pain" sound); lower values
 * only nudge toward the target, which reads as gentle correction.
 */

const A4 = 440;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// semitone offsets from the root
export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

export const KEYS = NOTE_NAMES;

/** MIDI note number (float) for a frequency. A4 = 69. */
export function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / A4);
}

export function midiToFreq(midi) {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi) {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/**
 * Autocorrelation pitch detection. Returns Hz, or 0 when the block is too
 * quiet or too noisy to have a confident fundamental (silence/consonants).
 */
export function detectPitch(buf, sampleRate, { minHz = 70, maxHz = 1100 } = {}) {
  const n = buf.length;

  // RMS gate — don't try to tune silence or breath noise
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return 0;

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(n / 2));
  if (maxLag <= minLag) return 0;

  // Normalized square difference — more robust against octave errors than
  // plain autocorrelation, which readily locks onto 2x the true period.
  let bestLag = -1;
  let bestVal = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let energy = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += buf[i] * buf[i + lag];
      energy += buf[i + lag] * buf[i + lag];
    }
    const norm = energy > 0 ? corr / Math.sqrt(energy) : 0;
    if (norm > bestVal) { bestVal = norm; bestLag = lag; }
  }
  if (bestLag < 0) return 0;

  // confidence gate, scaled by block energy
  let selfEnergy = 0;
  for (let i = 0; i < n - bestLag; i++) selfEnergy += buf[i] * buf[i];
  const confidence = selfEnergy > 0 ? bestVal / Math.sqrt(selfEnergy) : 0;
  if (confidence < 0.5) return 0;

  // parabolic interpolation around the peak for sub-sample accuracy
  const lagAt = (l) => {
    let c = 0;
    for (let i = 0; i < n - l; i++) c += buf[i] * buf[i + l];
    return c;
  };
  const y0 = lagAt(bestLag - 1), y1 = lagAt(bestLag), y2 = lagAt(bestLag + 1);
  const denom = 2 * (2 * y1 - y0 - y2);
  const shift = denom !== 0 ? (y2 - y0) / denom : 0;
  const refined = bestLag + Math.max(-1, Math.min(1, shift));

  return sampleRate / refined;
}

/** Nearest MIDI note that belongs to the given key/scale. */
export function snapMidiToScale(midi, keyIndex, scaleName) {
  const intervals = SCALES[scaleName] || SCALES.chromatic;
  const octave = Math.floor((midi - keyIndex) / 12);
  let best = null;
  let bestDist = Infinity;
  // check the octave below/at/above so notes near an octave edge snap correctly
  for (let o = octave - 1; o <= octave + 1; o++) {
    for (const iv of intervals) {
      const cand = keyIndex + iv + o * 12;
      const d = Math.abs(cand - midi);
      if (d < bestDist) { bestDist = d; best = cand; }
    }
  }
  return best;
}

/** Linear-interpolated read of a fractional sample index. */
function sampleAt(input, pos) {
  if (pos < 0 || pos >= input.length - 1) return 0;
  const i0 = Math.floor(pos);
  const frac = pos - i0;
  return input[i0] + (input[i0 + 1] - input[i0]) * frac;
}

/**
 * Time-varying pitch shift via a two-tap crossfaded delay line.
 *
 * The read pointer lags the write pointer by a delay that grows at
 * (1 - ratio) per sample, so the effective read position is i*ratio — pitch
 * scales by `ratio` while the output stays sample-for-sample aligned with the
 * input, preserving the take's timing. A second tap half a buffer away is
 * crossfaded in so the delay can wrap without a click.
 *
 * Chosen over grain-per-block resampling because `ratio` changes continuously
 * as the singer's pitch drifts; block grains that each re-anchor to the input
 * timeline just resynthesize the original pitch on overlap-add.
 */
function pitchShiftVarying(input, ratioAt, bufLen = 2048) {
  const out = new Float32Array(input.length);
  const half = bufLen / 2;
  let phase = 0; // current delay in samples, kept within [0, bufLen)

  for (let i = 0; i < input.length; i++) {
    const d1 = phase;
    const d2 = (phase + half) % bufLen;

    // triangular fades: each tap is silent where its delay wraps
    const f1 = 1 - Math.abs((2 * d1) / bufLen - 1);
    const f2 = 1 - Math.abs((2 * d2) / bufLen - 1);
    const sum = f1 + f2;

    const s1 = sampleAt(input, i - d1);
    const s2 = sampleAt(input, i - d2);
    out[i] = sum > 0 ? (s1 * f1 + s2 * f2) / sum : 0;

    phase += 1 - ratioAt(i);
    if (phase >= bufLen) phase -= bufLen;
    else if (phase < 0) phase += bufLen;
  }
  return out;
}

/**
 * Autotune a mono Float32Array.
 * @returns {{data: Float32Array, stats: {corrected: number, blocks: number, avgCentsMoved: number}}}
 */
export function autotuneChannel(input, sampleRate, { strength = 1, keyIndex = 0, scale = 'major' } = {}) {
  const blockSize = 2048;
  const hop = blockSize / 4;

  // --- analysis pass 1: detect pitch per block ---
  const freqs = [];
  for (let pos = 0; pos + blockSize <= input.length; pos += hop) {
    freqs.push(detectPitch(input.subarray(pos, pos + blockSize), sampleRate));
  }

  // Median-filter the pitch track before snapping. Raw per-block detection
  // jitters by a few cents, which makes a note sitting near the midpoint
  // between two scale degrees flip targets block to block — that reads as
  // warbling. The median ignores single-block outliers so the target holds.
  const smoothed = freqs.map((f, i) => {
    if (f <= 0) return 0;
    const win = [freqs[i - 1], f, freqs[i + 1]].filter((x) => x > 0);
    win.sort((a, b) => a - b);
    return win[Math.floor(win.length / 2)];
  });

  // --- analysis pass 2: one correction ratio per block ---
  const ratios = [];
  let corrected = 0;
  let centsSum = 0;
  let heldTarget = null; // last chosen scale note, for hysteresis

  for (let i = 0; i < smoothed.length; i++) {
    const freq = smoothed[i];
    let ratio = 1;
    if (freq > 0) {
      const midi = freqToMidi(freq);
      let target = snapMidiToScale(midi, keyIndex, scale);
      // Hysteresis for genuine ties only: hold the previous target when it's
      // within 5 cents of being as close as the new pick. Wider thresholds
      // latch onto whichever note detection jitter happened to hit first and
      // then never let go, even when the other note is clearly nearer.
      if (heldTarget !== null && heldTarget !== target) {
        const dNew = Math.abs(target - midi);
        const dHeld = Math.abs(heldTarget - midi);
        if (dHeld - dNew < 0.05) target = heldTarget;
      }
      heldTarget = target;

      // strength interpolates between "leave alone" and "snap exactly"
      const correctedMidi = midi + (target - midi) * strength;
      ratio = midiToFreq(correctedMidi) / freq;
      const cents = Math.abs(correctedMidi - midi) * 100;
      if (cents > 1) { corrected++; centsSum += cents; }
    } else {
      heldTarget = null; // silence resets, so the next phrase picks fresh
    }
    ratios.push(ratio);
  }
  if (ratios.length === 0) ratios.push(1);

  // --- synthesis pass: ratio interpolated between block centres so the
  // correction glides instead of stepping (steps sound like clicks) ---
  const ratioAt = (i) => {
    const b = (i - blockSize / 2) / hop;
    if (b <= 0) return ratios[0];
    if (b >= ratios.length - 1) return ratios[ratios.length - 1];
    const i0 = Math.floor(b);
    const frac = b - i0;
    return ratios[i0] + (ratios[i0 + 1] - ratios[i0]) * frac;
  };

  return {
    data: pitchShiftVarying(input, ratioAt),
    stats: {
      blocks: ratios.length,
      corrected,
      avgCentsMoved: corrected > 0 ? centsSum / corrected : 0,
    },
  };
}

/** Autotune every channel of an AudioBuffer into a new AudioBuffer. */
export function autotuneAudioBuffer(audioCtx, audioBuffer, options) {
  const outBuf = audioCtx.createBuffer(
    audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate,
  );
  let stats = { blocks: 0, corrected: 0, avgCentsMoved: 0 };
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const res = autotuneChannel(audioBuffer.getChannelData(ch), audioBuffer.sampleRate, options);
    outBuf.getChannelData(ch).set(res.data);
    if (ch === 0) stats = res.stats;
  }
  return { buffer: outBuf, stats };
}

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob (the server accepts audio/wav). */
export function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * numCh * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeStr = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // format = PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numCh * bytesPerSample, true);
  view.setUint16(32, numCh * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/** Decode a recorded Blob, autotune it, and return a WAV Blob + stats. */
export async function autotuneBlob(blob, options) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    const { buffer, stats } = autotuneAudioBuffer(audioCtx, decoded, options);
    return { blob: audioBufferToWav(buffer), stats, durationSec: decoded.duration };
  } finally {
    audioCtx.close().catch(() => {});
  }
}
