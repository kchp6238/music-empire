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

export async function playPattern(pattern, bpm, mixer, fx, onStep) {
  await Tone.start();
  stopPattern();
  const s = getSynths(mixer, fx);
  Tone.Transport.bpm.value = bpm;
  const totalSteps = pattern.bass.length;
  const seq = new Tone.Sequence((time, idx) => {
    DRUM_INSTRUMENTS.forEach((di) => {
      if (pattern.drums[di.key][idx]) {
        if (di.key === 'kick') s.kick.triggerAttackRelease('C1', '8n', time);
        else if (di.key === 'tom') s.tom.triggerAttackRelease('G1', '8n', time);
        else s[di.key].triggerAttackRelease('8n', time);
      }
    });
    if (pattern.bass[idx]) s.bass.triggerAttackRelease(pattern.bass[idx], '8n', time);
    if (pattern.piano[idx]) s.piano.triggerAttackRelease(pattern.piano[idx], '8n', time);
    if (pattern.guitar[idx]) s.guitar.triggerAttackRelease(pattern.guitar[idx], '8n', time);
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
