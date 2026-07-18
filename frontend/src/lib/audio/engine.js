import * as Tone from 'tone';
import { DRUM_INSTRUMENTS } from '../gameData/constants';

/**
 * Single app-wide audio engine (module-level singleton, not a React ref) —
 * there is only ever one Tone.js context per session, so a component-scoped
 * ref would just add indirection. See docs/frontend-architecture.md §4.
 *
 * Instrument sound design (§1-A item 3 — "much more sophisticated synth
 * params" in lieu of sample-based instruments): drums are layered/filtered
 * composite voices instead of a single bare oscillator/noise burst each;
 * bass uses MonoSynth's real filter envelope; piano is a chorused PolySynth;
 * guitar is Tone's built-in Karplus-Strong PluckSynth. A master
 * compressor+limiter bus glues everything together. Per-channel EQ/sidechain
 * and a full mixing console are explicitly out of scope for this pass.
 */
let synths = null;
let fxNodes = null;
let sequence = null;

// Wraps a Tone.Channel (real volume/mute/connect/dispose) with a custom
// triggerAttackRelease built from one or more internal voices — lets a
// composite drum sound (e.g. kick = body + click transient) be driven and
// mixed exactly like a single Tone instrument everywhere else in this file.
function makeVoice(buildNodes) {
  const channel = new Tone.Channel();
  const { trigger, nodes } = buildNodes(channel);
  channel.triggerAttackRelease = trigger;
  const disposeChannel = channel.dispose.bind(channel);
  channel.dispose = () => { nodes.forEach((n) => n.dispose()); disposeChannel(); };
  return channel;
}

function buildKick(channel) {
  const body = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 5, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } }).connect(channel);
  const clickFilter = new Tone.Filter({ type: 'highpass', frequency: 3000 }).connect(channel);
  const click = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.006, sustain: 0 } }).connect(clickFilter);
  return {
    nodes: [body, click, clickFilter],
    trigger: (duration, time, velocity = 1) => {
      body.triggerAttackRelease('C1', duration, time, velocity);
      click.triggerAttackRelease('32n', time, velocity * 0.6);
    },
  };
}

function buildSnare(channel) {
  const bandFilter = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.6 }).connect(channel);
  const body = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(bandFilter);
  const tone = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(channel);
  return {
    nodes: [bandFilter, body, tone],
    trigger: (duration, time, velocity = 1) => {
      body.triggerAttackRelease(duration, time, velocity);
      tone.triggerAttackRelease('G2', duration, time, velocity * 0.5);
    },
  };
}

function buildHihat(channel, { frequency, decay }) {
  const hp = new Tone.Filter({ type: 'highpass', frequency }).connect(channel);
  const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay, sustain: 0 } }).connect(hp);
  return { nodes: [hp, noise], trigger: (duration, time, velocity = 1) => noise.triggerAttackRelease(duration, time, velocity) };
}

function buildClap(channel) {
  const bp = new Tone.Filter({ type: 'bandpass', frequency: 1100, Q: 0.9 }).connect(channel);
  const noise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(bp);
  return {
    nodes: [bp, noise],
    // real claps are a cluster of near-simultaneous hits, not one hit
    trigger: (duration, time, velocity = 1) => {
      noise.triggerAttackRelease(duration, time, velocity);
      noise.triggerAttackRelease(duration, time + 0.018, velocity * 0.85);
      noise.triggerAttackRelease(duration, time + 0.036, velocity * 0.7);
    },
  };
}

function buildTom(channel) {
  const body = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(channel);
  return { nodes: [body], trigger: (duration, time, velocity = 1) => body.triggerAttackRelease('G1', duration, time, velocity) };
}

function buildCrash(channel) {
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 6000, Q: 0.5 }).connect(channel);
  const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 1.2, sustain: 0 } }).connect(filter);
  return {
    nodes: [filter, noise],
    // filter sweeps open-to-closed over the decay for a shimmering tail
    trigger: (duration, time, velocity = 1) => {
      noise.triggerAttackRelease('1n', time, velocity);
      filter.frequency.setValueAtTime(6000, time);
      filter.frequency.exponentialRampToValueAtTime(700, time + 1.1);
    },
  };
}

function buildSynths(mixer, fx) {
  const kick = makeVoice(buildKick);
  const snare = makeVoice(buildSnare);
  const hihatClosed = makeVoice((ch) => buildHihat(ch, { frequency: 7000, decay: 0.045 }));
  const hihatOpen = makeVoice((ch) => buildHihat(ch, { frequency: 6000, decay: 0.28 }));
  const clap = makeVoice(buildClap);
  const tom = makeVoice(buildTom);
  const crash = makeVoice(buildCrash);

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.2 },
    filter: { type: 'lowpass', rolloff: -24, Q: 1.2 },
    filterEnvelope: { attack: 0.02, decay: 0.25, sustain: 0.35, release: 0.3, baseFrequency: 90, octaves: 3.5 },
  });

  const pianoChorus = new Tone.Chorus({ frequency: 3.5, delayTime: 2.5, depth: 0.4 }).start();
  const piano = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.5, modulationIndex: 3.5,
    envelope: { attack: 0.006, decay: 0.6, sustain: 0.25, release: 0.8 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.4 },
  });

  // Karplus-Strong plucked-string synthesis — ships in Tone.js already, a
  // real timbre upgrade over a bare triangle oscillator for ~free.
  const guitar = new Tone.PluckSynth({ attackNoise: 1, dampening: 3500, resonance: 0.92 });

  // Master bus: everything feeds compressor -> limiter -> speakers, instead
  // of each voice going straight toDestination(). Glue/loudness only — full
  // per-channel EQ/sidechain is out of scope for this pass.
  const compressor = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.01, release: 0.2 });
  const limiter = new Tone.Limiter(-1);
  compressor.connect(limiter);
  limiter.toDestination();

  const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000 }).connect(compressor);
  const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3 }).connect(compressor);
  const reverbSend = new Tone.Gain(0).connect(reverb);
  const delaySend = new Tone.Gain(0).connect(delay);

  const all = { kick, snare, hihatClosed, hihatOpen, clap, tom, crash, bass, piano, guitar };

  Object.entries(all).forEach(([key, synth]) => {
    const m = mixer[key];
    synth.volume.value = m ? (m.mute ? -60 : m.vol) : 0;
  });

  // Piano routes through its chorus effect before hitting the shared bus;
  // every other voice connects straight to the bus/sends.
  Object.entries(all).forEach(([key, synth]) => {
    if (key === 'piano') return;
    synth.connect(compressor);
    synth.connect(reverbSend);
    synth.connect(delaySend);
  });
  piano.connect(pianoChorus);
  pianoChorus.connect(compressor);
  pianoChorus.connect(reverbSend);
  pianoChorus.connect(delaySend);

  reverbSend.gain.value = (fx.reverbWet / 100) * 0.6;
  delaySend.gain.value = (fx.delayWet / 100) * 0.5;

  return { synths: all, fxNodes: { reverb, delay, reverbSend, delaySend, compressor, limiter, pianoChorus } };
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
      if (pattern.drums[di.key][idx]) s[di.key].triggerAttackRelease('8n', jTime(time));
    });
    const bassRun = bassRuns[idx];
    if (bassRun) s.bass.triggerAttackRelease(bassRun.pitch, stepSeconds * bassRun.length, jTime(time), velAt(pattern.bassVelocity, idx));
    const pianoRun = pianoRuns[idx];
    if (pianoRun) s.piano.triggerAttackRelease(pianoRun.pitch, stepSeconds * pianoRun.length, jTime(time), velAt(pattern.pianoVelocity, idx));
    const guitarRun = guitarRuns[idx];
    // PluckSynth (Karplus-Strong) self-decays — triggerAttack only, no
    // release phase to schedule, and "duration" wouldn't do anything anyway.
    if (guitarRun) s.guitar.triggerAttack(guitarRun.pitch, jTime(time), velAt(pattern.guitarVelocity, idx));
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
    fxNodes.compressor.dispose();
    fxNodes.limiter.dispose();
    fxNodes.pianoChorus.dispose();
    fxNodes = null;
  }
}
