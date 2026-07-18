import * as Tone from 'tone';
import { DRUM_INSTRUMENTS } from '../gameData/constants';

/**
 * Single app-wide audio engine (module-level singleton, not a React ref) —
 * there is only ever one Tone.js context per session, so a component-scoped
 * ref would just add indirection. See docs/frontend-architecture.md §4.
 */
let synths = null;
let fxNodes = null;
let sequence = null;

function buildSynths(mixer, fx) {
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } });
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } });
  const hihatClosed = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } });
  const hihatOpen = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } });
  const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } });
  const tom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } });
  const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.8, sustain: 0 } });
  const bass = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.2 } });
  const piano = new Tone.FMSynth({ harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 0.6 }, modulation: { type: 'sine' } });
  const guitar = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.05, release: 0.1 } });

  const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000 }).toDestination();
  const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3 }).toDestination();
  const reverbSend = new Tone.Gain(0).connect(reverb);
  const delaySend = new Tone.Gain(0).connect(delay);

  const all = { kick, snare, hihatClosed, hihatOpen, clap, tom, crash, bass, piano, guitar };
  Object.entries(all).forEach(([key, synth]) => {
    synth.toDestination();
    synth.connect(reverbSend);
    synth.connect(delaySend);
    const m = mixer[key];
    synth.volume.value = m ? (m.mute ? -60 : m.vol) : 0;
  });

  reverbSend.gain.value = (fx.reverbWet / 100) * 0.6;
  delaySend.gain.value = (fx.delayWet / 100) * 0.5;

  return { synths: all, fxNodes: { reverb, delay, reverbSend, delaySend } };
}

function getSynths(mixer, fx) {
  if (!synths) {
    const built = buildSynths(mixer, fx);
    synths = built.synths;
    fxNodes = built.fxNodes;
  }
  return synths;
}

export function updateMixer(mixer) {
  if (!synths) return;
  Object.entries(mixer).forEach(([key, val]) => {
    if (synths[key]) synths[key].volume.value = val.mute ? -60 : val.vol;
  });
}

export function updateFx(fx) {
  if (!fxNodes) return;
  fxNodes.reverbSend.gain.value = (fx.reverbWet / 100) * 0.6;
  fxNodes.delaySend.gain.value = (fx.delayWet / 100) * 0.5;
}

export function stopPattern() {
  if (sequence) { sequence.stop(); sequence.dispose(); sequence = null; }
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

// Collapses consecutive equal-pitch steps into runs, keyed by their start
// index — one held note (length = run length) instead of retriggering every
// step. This is what makes a "painted" multi-step note in the piano roll
// actually sound sustained instead of machine-gunned.
function computeRuns(arr) {
  const byStart = {};
  let i = 0;
  while (i < arr.length) {
    if (!arr[i]) { i++; continue; }
    const pitch = arr[i];
    let j = i + 1;
    while (j < arr.length && arr[j] === pitch) j++;
    byStart[i] = { length: j - i, pitch };
    i = j;
  }
  return byStart;
}

export async function playPattern(pattern, bpm, mixer, fx, onStep) {
  await Tone.start();
  stopPattern();
  const s = getSynths(mixer, fx);
  Tone.Transport.bpm.value = bpm;
  const totalSteps = pattern.bass.length;
  const stepSeconds = Tone.Time('16n').toSeconds();
  const bassRuns = computeRuns(pattern.bass);
  const pianoRuns = computeRuns(pattern.piano);
  const guitarRuns = computeRuns(pattern.guitar);
  const humanize = Boolean(fx.humanize);

  const jTime = (time) => humanize ? time + (Math.random() - 0.5) * 0.012 : time;
  const jVel = (v) => humanize ? Math.max(0.05, Math.min(1, v * (1 + (Math.random() - 0.5) * 0.25))) : v;
  const velAt = (velArr, idx) => jVel((velArr?.[idx] ?? 100) / 127);

  const seq = new Tone.Sequence((time, idx) => {
    DRUM_INSTRUMENTS.forEach((di) => {
      if (pattern.drums[di.key][idx]) {
        const t = jTime(time);
        if (di.key === 'kick') s.kick.triggerAttackRelease('C1', '8n', t);
        else if (di.key === 'tom') s.tom.triggerAttackRelease('G1', '8n', t);
        else s[di.key].triggerAttackRelease('8n', t);
      }
    });
    const bassRun = bassRuns[idx];
    if (bassRun) s.bass.triggerAttackRelease(bassRun.pitch, stepSeconds * bassRun.length, jTime(time), velAt(pattern.bassVelocity, idx));
    const pianoRun = pianoRuns[idx];
    if (pianoRun) s.piano.triggerAttackRelease(pianoRun.pitch, stepSeconds * pianoRun.length, jTime(time), velAt(pattern.pianoVelocity, idx));
    const guitarRun = guitarRuns[idx];
    if (guitarRun) s.guitar.triggerAttackRelease(guitarRun.pitch, stepSeconds * guitarRun.length, jTime(time), velAt(pattern.guitarVelocity, idx));
    Tone.Draw.schedule(() => onStep(idx), time);
  }, Array.from({ length: totalSteps }, (_, i) => i), '16n');
  seq.start(0);
  Tone.Transport.start();
  sequence = seq;
}

export function disposeEngine() {
  stopPattern();
  if (synths) { Object.values(synths).forEach((s) => s.dispose()); synths = null; }
  if (fxNodes) {
    fxNodes.reverb.dispose();
    fxNodes.delay.dispose();
    fxNodes.reverbSend.dispose();
    fxNodes.delaySend.dispose();
    fxNodes = null;
  }
}
