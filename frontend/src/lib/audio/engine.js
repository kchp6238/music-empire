import * as Tone from 'tone';
import { DRUM_INSTRUMENTS, EFFECT_TYPES, CHANNEL_KEYS, MELODIC_KEYS, CHORDAL_KEYS } from '../gameData/constants';
import { cellPitches } from '../patterns';

/**
 * Single app-wide audio engine (module-level singleton, not a React ref) —
 * there is only ever one Tone.js context per session, so a component-scoped
 * ref would just add indirection. See docs/frontend-architecture.md §4.
 *
 * Signal flow:
 *   voice -> channel bus -> master compressor -> limiter -> speakers
 *                        \-> [per-effect wet send -> effect node] -> compressor
 *
 * The four channel busses (drums/bass/piano/guitar) are what make per-channel
 * effect chains possible: an earlier version wired every voice into two
 * global reverb/delay sends, so "reverb on the drums only" was unexpressible.
 *
 * Drum voices additionally expose control handles so the DrumMachine plugin
 * can retune pitch/decay/gain live. Rebuilding a voice per knob tick would
 * pop, so nothing here is ever reconstructed on a param change — only on a
 * structural change (adding/removing an effect).
 */
let synths = null;         // { kick..crash, bass, piano, guitar } -> Tone nodes
let drumCtl = null;        // { kick..crash } -> { setPitch, setDecay }
let busses = null;         // { drums, bass, piano, guitar } -> Tone.Channel
let fxNodes = null;        // master chain + piano chorus
let channelFxNodes = null; // { channel: { effectId: { node, send } } }
let channelFxSig = {};     // { channel: chain shape } — guards needless rebuilds
let sequence = null;

// Latest store state, cached so any update path can recompute what it needs
// without the caller having to pass the whole audio state every time.
let mixerState = {};
let drumParamsState = {};
let channelMixState = {};

// The player's recorded vocal-instrument sample. Held at module scope (not in
// the serialized draft — it's never uploaded) so it survives an engine rebuild
// within the session; it's gone on reload, and the lane then falls back to the
// synthetic vocal voice until re-recorded.
let vocalSampleBuffer = null; // Tone.ToneAudioBuffer
let vocalBaseNote = 'C4';

const DRUM_KEYS = DRUM_INSTRUMENTS.map((d) => d.key);
// Self-decaying pluck voices take triggerAttack only; chordal voices get their
// single melody note fanned into an open fifth. Kept as Sets for O(1) lookup
// inside the per-step sequence callback.
const PLUCK_KEYS = new Set(['guitar']);
const CHORDAL_SET = new Set(CHORDAL_KEYS);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const semitoneRatio = (semitones) => 2 ** (semitones / 12);

// root -> [root, fifth, octave]; key-neutral so it works in major and minor.
const openFifth = (pitch) => {
  try {
    const root = Tone.Frequency(pitch);
    return [pitch, root.transpose(7).toNote(), root.transpose(12).toNote()];
  } catch { return [pitch]; }
};

// Wraps a Tone.Channel (real volume/mute/connect/dispose) with a custom
// triggerAttackRelease built from one or more internal voices — lets a
// composite drum sound (e.g. kick = body + click transient) be driven and
// mixed exactly like a single Tone instrument everywhere else in this file.
function makeVoice(buildNodes) {
  const channel = new Tone.Channel();
  const { trigger, nodes, control } = buildNodes(channel);
  channel.triggerAttackRelease = trigger;
  const disposeChannel = channel.dispose.bind(channel);
  channel.dispose = () => { nodes.forEach((n) => n.dispose()); disposeChannel(); };
  return { channel, control };
}

/* ---------- sampled (real-recording) voices -------------------------------
   Synthesis can't convincingly imitate an acoustic piano, a bowed violin or a
   plucked steel-string, so those play back real multisampled recordings via
   Tone.Sampler (it pitch-shifts the nearest sample per note). Samples stream
   from a CDN-hosted, freely-licensed instrument set; while they load, a synth
   fallback keeps the instrument audible so the first play is never silent. */
const SAMPLE_BASE = 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/';

// notes are given in file form ('Fs4'); the Sampler key wants Tone's '#' form.
function sampleUrls(notes) {
  const urls = {};
  notes.forEach((n) => { urls[n.replace('s', '#')] = `${n}.mp3`; });
  return urls;
}

// Same Tone.Channel wrapper contract as makeVoice: a real .volume/.connect node
// with triggerAttack(Release) that routes to the Sampler once its buffers are
// loaded, and to the fallback synth until then.
function makeSampledVoice(folder, notes, buildFallback) {
  const channel = new Tone.Channel();
  const sampler = new Tone.Sampler({
    urls: sampleUrls(notes),
    baseUrl: `${SAMPLE_BASE}${folder}/`,
    release: 1,
  }).connect(channel);
  const fallback = buildFallback().connect(channel);
  const active = () => (sampler.loaded ? sampler : fallback);
  channel.triggerAttackRelease = (pitch, dur, time, vel) => active().triggerAttackRelease(pitch, dur, time, vel);
  channel.triggerAttack = (pitch, time, vel) => active().triggerAttack(pitch, time, vel);
  const disposeChannel = channel.dispose.bind(channel);
  channel.dispose = () => { sampler.dispose(); fallback.dispose(); disposeChannel(); };
  return channel;
}

/* ---------- vocal instrument (record-your-own-voice sampler) --------------
   The player records a single sustained note; we map it to its base pitch in a
   Tone.Sampler, which pitch-shifts that one recording across the whole range so
   you can play melodies in your own voice. Before anything is recorded, a
   breathy "ah" synth stands in so the lane is never silent. */
function makeVocalVoice() {
  const channel = new Tone.Channel();
  const fallback = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine', partials: [1, 0.4, 0.25, 0.12] }, // vowel-ish
    envelope: { attack: 0.09, decay: 0.2, sustain: 0.85, release: 0.5 },
  }).connect(channel);
  let sampler = null; // built lazily once a take exists
  const active = () => (sampler && sampler.loaded ? sampler : fallback);
  channel.triggerAttackRelease = (pitch, dur, time, vel) => active().triggerAttackRelease(pitch, dur, time, vel);
  channel.triggerAttack = (pitch, time, vel) => active().triggerAttack(pitch, time, vel);
  // Swap in (or replace) the recorded sample. buffer is a Tone.ToneAudioBuffer.
  channel.setSample = (buffer, baseNote) => {
    if (sampler) sampler.dispose();
    sampler = new Tone.Sampler({ urls: { [baseNote]: buffer }, release: 0.6 }).connect(channel);
  };
  const disposeChannel = channel.dispose.bind(channel);
  channel.dispose = () => { if (sampler) sampler.dispose(); fallback.dispose(); disposeChannel(); };
  return channel;
}

/* A live "singing" voice: a glottal source through two formant bandpasses with
   vibrato — the same vowel-formant chain renderAiVocal() bakes to a WAV, but as
   a real-time monophonic instrument. Used to sing rival (NPC) song toplines so
   they play as songs, not bare beats. */
function makeFormantVocalVoice() {
  const channel = new Tone.Channel();
  const source = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.06, decay: 0.1, sustain: 0.9, release: 0.3 },
    filterEnvelope: { attack: 0.02, decay: 0.1, sustain: 1, baseFrequency: 200, octaves: 2 },
  });
  const f1 = new Tone.Filter({ type: 'bandpass', frequency: 800, Q: 6 });   // "ah" formants
  const f2 = new Tone.Filter({ type: 'bandpass', frequency: 1150, Q: 9 });
  const vib = new Tone.Vibrato({ frequency: 5.2, depth: 0.12 }).connect(channel);
  source.connect(f1); source.connect(f2);
  f1.connect(vib); f2.connect(vib);
  channel.triggerAttackRelease = (pitch, dur, time, vel) => source.triggerAttackRelease(pitch, dur, time, vel);
  channel.triggerAttack = (pitch, time, vel) => source.triggerAttack(pitch, time, vel);
  const disposeChannel = channel.dispose.bind(channel);
  channel.dispose = () => { source.dispose(); f1.dispose(); f2.dispose(); vib.dispose(); disposeChannel(); };
  return channel;
}

// Multisample note maps — a spread across each instrument's range so pitch
// shifting between neighbours stays subtle. (All verified present in the set.)
const SAMPLE_NOTES = {
  piano: ['C2', 'Fs2', 'C3', 'Fs3', 'C4', 'Fs4', 'C5', 'Fs5', 'C6', 'Fs6'],
  violin: ['G3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'],
  guitar: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4'],
  cello: ['C2', 'G2', 'C3', 'G3', 'C4', 'E4', 'G4', 'C5'],
  flute: ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'],
  clarinet: ['D3', 'F3', 'As3', 'D4', 'F4', 'As4', 'D5'],
  elecGuitar: ['C3', 'A3', 'C4', 'A4', 'C5'],
};

/* ---------- drum voices ---------------------------------------------------
   Each builder closes over a mutable `p` holding the live knob values, so the
   trigger closure reads the current pitch on every hit. MembraneSynth takes
   its note per-trigger rather than holding a frequency param, so a pitch turn
   lands on the *next* hit — same as every hardware drum machine. */

function buildKick() {
  const BASE_DECAY = 0.4;
  const p = { pitch: 0, decay: 1 };
  return (channel) => {
    const body = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 5, envelope: { attack: 0.001, decay: BASE_DECAY, sustain: 0 } }).connect(channel);
    const clickFilter = new Tone.Filter({ type: 'highpass', frequency: 3000 }).connect(channel);
    const click = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.006, sustain: 0 } }).connect(clickFilter);
    return {
      nodes: [body, click, clickFilter],
      control: {
        setPitch: (v) => { p.pitch = v; },
        setDecay: (mult) => { p.decay = mult; body.envelope.decay = BASE_DECAY * mult; },
      },
      trigger: (duration, time, velocity = 1) => {
        body.triggerAttackRelease(Tone.Frequency('C1').transpose(p.pitch).toFrequency(), duration, time, velocity);
        click.triggerAttackRelease('32n', time, velocity * 0.6);
      },
    };
  };
}

function buildSnare() {
  const BODY_DECAY = 0.16;
  const TONE_DECAY = 0.1;
  const p = { pitch: 0 };
  return (channel) => {
    const bandFilter = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.6 }).connect(channel);
    const body = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: BODY_DECAY, sustain: 0 } }).connect(bandFilter);
    const tone = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: TONE_DECAY, sustain: 0 } }).connect(channel);
    return {
      nodes: [bandFilter, body, tone],
      control: {
        // the noise body carries the character, so pitch moves its bandpass
        // alongside the tone layer rather than detuning only the tone
        setPitch: (v) => { p.pitch = v; bandFilter.frequency.value = 1800 * semitoneRatio(v); },
        setDecay: (mult) => { body.envelope.decay = BODY_DECAY * mult; tone.envelope.decay = TONE_DECAY * mult; },
      },
      trigger: (duration, time, velocity = 1) => {
        body.triggerAttackRelease(duration, time, velocity);
        tone.triggerAttackRelease(Tone.Frequency('G2').transpose(p.pitch).toFrequency(), duration, time, velocity * 0.5);
      },
    };
  };
}

function buildHihat({ frequency, decay }) {
  return (channel) => {
    const hp = new Tone.Filter({ type: 'highpass', frequency }).connect(channel);
    const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay, sustain: 0 } }).connect(hp);
    return {
      nodes: [hp, noise],
      control: {
        setPitch: (v) => { hp.frequency.value = frequency * semitoneRatio(v); },
        setDecay: (mult) => { noise.envelope.decay = decay * mult; },
      },
      trigger: (duration, time, velocity = 1) => noise.triggerAttackRelease(duration, time, velocity),
    };
  };
}

function buildClap() {
  const BASE_DECAY = 0.18;
  return (channel) => {
    const bp = new Tone.Filter({ type: 'bandpass', frequency: 1100, Q: 0.9 }).connect(channel);
    const noise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: BASE_DECAY, sustain: 0 } }).connect(bp);
    return {
      nodes: [bp, noise],
      control: {
        setPitch: (v) => { bp.frequency.value = 1100 * semitoneRatio(v); },
        setDecay: (mult) => { noise.envelope.decay = BASE_DECAY * mult; },
      },
      // real claps are a cluster of near-simultaneous hits, not one hit
      trigger: (duration, time, velocity = 1) => {
        noise.triggerAttackRelease(duration, time, velocity);
        noise.triggerAttackRelease(duration, time + 0.018, velocity * 0.85);
        noise.triggerAttackRelease(duration, time + 0.036, velocity * 0.7);
      },
    };
  };
}

function buildTom() {
  const BASE_DECAY = 0.3;
  const p = { pitch: 0 };
  return (channel) => {
    const body = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: BASE_DECAY, sustain: 0 } }).connect(channel);
    return {
      nodes: [body],
      control: {
        setPitch: (v) => { p.pitch = v; },
        setDecay: (mult) => { body.envelope.decay = BASE_DECAY * mult; },
      },
      trigger: (duration, time, velocity = 1) =>
        body.triggerAttackRelease(Tone.Frequency('G1').transpose(p.pitch).toFrequency(), duration, time, velocity),
    };
  };
}

function buildCrash() {
  const BASE_DECAY = 1.2;
  const SWEEP_FROM = 6000;
  const SWEEP_TO = 700;
  const SWEEP_SECONDS = 1.1;
  const p = { pitch: 0, decay: 1 };
  return (channel) => {
    const filter = new Tone.Filter({ type: 'bandpass', frequency: SWEEP_FROM, Q: 0.5 }).connect(channel);
    const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: BASE_DECAY, sustain: 0 } }).connect(filter);
    return {
      nodes: [filter, noise],
      control: {
        setPitch: (v) => { p.pitch = v; },
        setDecay: (mult) => { p.decay = mult; noise.envelope.decay = BASE_DECAY * mult; },
      },
      // filter sweeps open-to-closed over the decay for a shimmering tail;
      // pitch shifts both ends so the whole sweep transposes together
      trigger: (duration, time, velocity = 1) => {
        const ratio = semitoneRatio(p.pitch);
        noise.triggerAttackRelease('1n', time, velocity);
        filter.frequency.setValueAtTime(SWEEP_FROM * ratio, time);
        filter.frequency.exponentialRampToValueAtTime(SWEEP_TO * ratio, time + SWEEP_SECONDS * p.decay);
      },
    };
  };
}

/* ---------- per-channel effects ------------------------------------------ */

function buildEffectNode(effect) {
  if (effect.type === 'reverb') {
    return new Tone.Freeverb({
      // capped below 1.0: Freeverb self-oscillates into a runaway wash at 1
      roomSize: clamp((effect.size ?? 70) / 100, 0, 0.95),
      dampening: 500 + ((effect.damp ?? 45) / 100) * 6500,
    });
  }
  return new Tone.FeedbackDelay({
    delayTime: 0.05 + ((effect.time ?? 30) / 100) * 0.6,
    feedback: clamp((effect.feedback ?? 30) / 100, 0, 0.9),
  });
}

function applyEffectParam(node, type, param, value) {
  if (type === 'reverb') {
    if (param === 'size') node.roomSize.value = clamp(value / 100, 0, 0.95);
    if (param === 'damp') node.dampening = 500 + (value / 100) * 6500;
  } else {
    if (param === 'time') node.delayTime.value = 0.05 + (value / 100) * 0.6;
    if (param === 'feedback') node.feedback.value = clamp(value / 100, 0, 0.9);
  }
}

const wetGain = (effect) => ((effect.wet ?? 30) / 100) * 0.7;

function disposeChannelFx(channel) {
  const entries = channelFxNodes?.[channel];
  if (!entries) return;
  Object.values(entries).forEach(({ node, send }) => { send.dispose(); node.dispose(); });
  channelFxNodes[channel] = {};
  delete channelFxSig[channel];
}

// Only the chain's *shape* matters for rebuilding — param values are applied
// live by updateChannelEffectParam, so a knob turn must not invalidate this.
const chainSignature = (effects) => (effects || []).map((e) => `${e.id}:${e.type}`).join('|');

function wireChannelFx(channel, effects) {
  if (!busses || !fxNodes) return;
  const sig = chainSignature(effects);
  if (channelFxSig[channel] === sig) return;
  disposeChannelFx(channel);
  const bus = busses[channel];
  (effects || []).forEach((effect) => {
    if (!EFFECT_TYPES[effect.type]) return;
    const node = buildEffectNode(effect).connect(fxNodes.compressor);
    const send = new Tone.Gain(wetGain(effect)).connect(node);
    bus.connect(send);
    channelFxNodes[channel][effect.id] = { node, send, type: effect.type };
  });
  channelFxSig[channel] = sig;
}

/* ---------- graph construction ------------------------------------------- */

function voiceVolume(key) {
  const m = mixerState[key];
  if (!m) return 0;
  if (m.mute) return -60;
  // dB is additive: the mixer fader is the song balance, the DrumMachine's
  // Gain knob is a per-drum trim on top of it.
  const trim = DRUM_KEYS.includes(key) ? (drumParamsState[key]?.gain ?? 0) : 0;
  return m.vol + trim;
}

function buildSynths() {
  const drumBuilders = {
    kick: buildKick(),
    snare: buildSnare(),
    hihatClosed: buildHihat({ frequency: 7000, decay: 0.045 }),
    hihatOpen: buildHihat({ frequency: 6000, decay: 0.28 }),
    clap: buildClap(),
    tom: buildTom(),
    crash: buildCrash(),
  };

  const voices = {};
  const controls = {};
  Object.entries(drumBuilders).forEach(([key, builder]) => {
    const { channel, control } = makeVoice(builder);
    voices[key] = channel;
    controls[key] = control;
  });

  voices.bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.2 },
    filter: { type: 'lowpass', rolloff: -24, Q: 1.2 },
    filterEnvelope: { attack: 0.02, decay: 0.25, sustain: 0.35, release: 0.3, baseFrequency: 90, octaves: 3.5 },
  });

  // Grand piano: real multisampled recordings (Salamander). Fallback while the
  // samples stream in is the old FM-piano synth.
  voices.piano = makeSampledVoice('piano', SAMPLE_NOTES.piano, () => new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.5, modulationIndex: 3.5,
    envelope: { attack: 0.006, decay: 0.6, sustain: 0.25, release: 0.8 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.4 },
  }));

  // Acoustic guitar: real plucked-string recordings. Fallback is Karplus-Strong
  // PluckSynth. Triggered attack-only (see PLUCK_KEYS) so the sample rings out.
  voices.guitar = makeSampledVoice('guitar-acoustic', SAMPLE_NOTES.guitar,
    () => new Tone.PluckSynth({ attackNoise: 1, dampening: 3500, resonance: 0.92 }));

  // ---- expanded instrument roster (all pitched, one per new channel) ----

  // Electric guitar: real electric-guitar recordings, pushed through a light
  // overdrive for edge. Fallback while samples load is the sawtooth synth.
  const elecDrive = new Tone.Distortion({ distortion: 0.22, wet: 0.55 });
  voices.elecGuitar = makeSampledVoice('guitar-electric', SAMPLE_NOTES.elecGuitar, () => new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.006, decay: 0.2, sustain: 0.6, release: 0.35 },
    filter: { type: 'lowpass', rolloff: -12, Q: 1 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4, baseFrequency: 500, octaves: 3 },
  }));

  // Brass/wind: bright sawtooth ensemble with the slightly-slow attack that
  // reads as a horn section rather than a synth stab.
  voices.brass = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.06, decay: 0.2, sustain: 0.85, release: 0.3 },
  });
  const brassFilter = new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 0.5 });

  // Synth lead: square-wave mono line with a snappy filter envelope.
  voices.synthLead = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.2 },
    filter: { type: 'lowpass', rolloff: -24, Q: 2 },
    filterEnvelope: { attack: 0.02, decay: 0.12, sustain: 0.6, release: 0.3, baseFrequency: 650, octaves: 2.6 },
  });

  // Pad: slow, wide, low-passed — sits under everything as a bed.
  voices.pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.6, decay: 0.5, sustain: 0.9, release: 1.4 },
  });
  const padFilter = new Tone.Filter({ type: 'lowpass', frequency: 1400, Q: 0.4 });

  // Strings: AM voices + chorus for an ensemble shimmer, slow bowed attack.
  voices.strings = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 2,
    envelope: { attack: 0.3, decay: 0.3, sustain: 0.9, release: 0.9 },
  });
  const stringsChorus = new Tone.Chorus({ frequency: 1.6, delayTime: 3.5, depth: 0.6 }).start();

  // ---- keys family ----

  // Electric piano (Rhodes-ish): FM bell tone with a soft chorus wobble.
  voices.ePiano = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3, modulationIndex: 8,
    envelope: { attack: 0.005, decay: 1.2, sustain: 0.12, release: 1 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.05, release: 0.4 },
  });
  const ePianoChorus = new Tone.Chorus({ frequency: 2.2, delayTime: 3, depth: 0.5 }).start();

  // Harpsichord: bright plucked keys — fast, no sustain, a touch of highpass.
  voices.harpsichord = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.2 },
  });
  const harpsichordHP = new Tone.Filter({ type: 'highpass', frequency: 300 });

  // Organ: sustained, hollow triangle drawbar bed — full while a key is held.
  voices.organ = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.05, sustain: 1, release: 0.15 },
  });

  // ---- orchestral strings family ----

  // Solo violin: real bowed-string recordings. Fallback is the sawtooth synth.
  voices.violin = makeSampledVoice('violin', SAMPLE_NOTES.violin, () => new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, portamento: 0.02,
    envelope: { attack: 0.14, decay: 0.2, sustain: 0.9, release: 0.3 },
    filter: { type: 'lowpass', rolloff: -12, Q: 0.8 },
    filterEnvelope: { attack: 0.12, decay: 0.2, sustain: 0.8, release: 0.3, baseFrequency: 900, octaves: 2 },
  }));
  // Solo cello: real bowed-string recordings. Fallback is the sawtooth synth.
  voices.cello = makeSampledVoice('cello', SAMPLE_NOTES.cello, () => new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, portamento: 0.03,
    envelope: { attack: 0.12, decay: 0.2, sustain: 0.9, release: 0.4 },
    filter: { type: 'lowpass', rolloff: -12, Q: 0.8 },
    filterEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.4, baseFrequency: 320, octaves: 2 },
  }));
  // Harp: plucked, bright, long ringing decay.
  voices.harp = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2, modulationIndex: 2,
    envelope: { attack: 0.004, decay: 1.6, sustain: 0, release: 1.2 },
  });

  // ---- woodwind family ----

  // Flute: real flute recordings. Fallback is the breathy sine synth.
  voices.flute = makeSampledVoice('flute', SAMPLE_NOTES.flute, () => new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.08, decay: 0.1, sustain: 0.9, release: 0.25 },
    filter: { type: 'lowpass', Q: 0.5 },
    filterEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.2, baseFrequency: 1200, octaves: 1.5 },
  }));
  // Clarinet: real clarinet recordings. Fallback is the woody square synth.
  voices.clarinet = makeSampledVoice('clarinet', SAMPLE_NOTES.clarinet, () => new Tone.MonoSynth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.2 },
    filter: { type: 'lowpass', rolloff: -12, Q: 0.7 },
    filterEnvelope: { attack: 0.04, decay: 0.1, sustain: 0.7, release: 0.2, baseFrequency: 700, octaves: 1.8 },
  }));

  // ---- vocal instrument (the player's own recorded voice) ----
  voices.vocalInst = makeVocalVoice();
  if (vocalSampleBuffer) voices.vocalInst.setSample(vocalSampleBuffer, vocalBaseNote);

  // Formant "singing" voice for rival song toplines (pattern.vocal). Not a
  // channel instrument — it goes straight to the master glue.
  voices.vocal = makeFormantVocalVoice();

  // Master bus: everything feeds compressor -> limiter -> speakers, instead
  // of each voice going straight toDestination(). Glue/loudness only.
  const compressor = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.01, release: 0.2 });
  const limiter = new Tone.Limiter(-1);
  compressor.connect(limiter);
  limiter.toDestination();

  // One bus per mixer channel — the insertion point for that channel's
  // effects chain, and what makes per-channel processing possible at all.
  const chanBusses = Object.fromEntries(
    CHANNEL_KEYS.map((k) => [k, new Tone.Channel().connect(compressor)])
  );

  DRUM_KEYS.forEach((key) => voices[key].connect(chanBusses.drums));
  voices.bass.connect(chanBusses.bass);
  voices.piano.connect(chanBusses.piano);
  voices.guitar.connect(chanBusses.guitar);
  voices.elecGuitar.chain(elecDrive, chanBusses.elecGuitar);
  voices.brass.chain(brassFilter, chanBusses.brass);
  voices.synthLead.connect(chanBusses.synthLead);
  voices.pad.chain(padFilter, chanBusses.pad);
  voices.strings.chain(stringsChorus, chanBusses.strings);
  voices.ePiano.chain(ePianoChorus, chanBusses.ePiano);
  voices.harpsichord.chain(harpsichordHP, chanBusses.harpsichord);
  voices.organ.connect(chanBusses.organ);
  voices.violin.connect(chanBusses.violin);
  voices.cello.connect(chanBusses.cello);
  voices.harp.connect(chanBusses.harp);
  voices.flute.connect(chanBusses.flute);
  voices.clarinet.connect(chanBusses.clarinet);
  voices.vocalInst.connect(chanBusses.vocalInst);
  voices.vocal.connect(compressor);

  return {
    voices, controls, chanBusses,
    fx: {
      compressor, limiter, elecDrive, brassFilter, padFilter, stringsChorus,
      ePianoChorus, harpsichordHP,
    },
  };
}

function ensureBuilt() {
  if (synths) return synths;
  const built = buildSynths();
  synths = built.voices;
  drumCtl = built.controls;
  busses = built.chanBusses;
  fxNodes = built.fx;
  channelFxNodes = Object.fromEntries(CHANNEL_KEYS.map((k) => [k, {}]));

  Object.keys(synths).forEach((key) => { synths[key].volume.value = voiceVolume(key); });
  Object.entries(channelMixState).forEach(([ch, val]) => {
    if (busses[ch]) busses[ch].volume.value = val.mute ? -60 : val.vol;
  });
  DRUM_KEYS.forEach((key) => applyDrumControls(key, drumParamsState[key]));
  return synths;
}

function applyDrumControls(key, params) {
  const ctl = drumCtl?.[key];
  if (!ctl || !params) return;
  ctl.setPitch(params.pitch ?? 0);
  ctl.setDecay((params.decay ?? 100) / 100);
}

/* ---------- public API ---------------------------------------------------- */

/** Seed/refresh the engine's view of the whole audio state. Safe to call
 *  before the graph exists — the values are cached and applied at build. */
export function syncAudioState({ mixer, channelMix, channelFx, drumParams }) {
  if (mixer) mixerState = mixer;
  if (drumParams) drumParamsState = drumParams;
  if (channelMix) channelMixState = channelMix;
  if (!synths) return;
  updateMixer(mixerState);
  updateChannelMix(channelMixState);
  DRUM_KEYS.forEach((key) => applyDrumControls(key, drumParamsState[key]));
  if (channelFx) Object.entries(channelFx).forEach(([ch, list]) => wireChannelFx(ch, list));
}

/** The channel-rack fader — rides the whole bus, effects included. */
export function updateChannelMix(channelMix) {
  channelMixState = channelMix;
  if (!busses) return;
  Object.entries(channelMix).forEach(([ch, val]) => {
    if (busses[ch]) busses[ch].volume.value = val.mute ? -60 : val.vol;
  });
}

export function updateMixer(mixer) {
  mixerState = mixer;
  if (!synths) return;
  Object.keys(mixer).forEach((key) => {
    if (synths[key]) synths[key].volume.value = voiceVolume(key);
  });
}

/** Structural change (effect added/removed) — rebuilds that channel's effect
 *  nodes. Fine to rebuild here: it's a deliberate, infrequent click. */
export function updateChannelEffects(channel, effects) {
  if (!synths) return;
  wireChannelFx(channel, effects);
}

/** Knob turn on an existing effect — tweaks the live node in place. Must NOT
 *  rebuild: Freeverb/FeedbackDelay reset their internal buffers on
 *  construction, so rebuilding at drag rate produces audible clicks. */
export function updateChannelEffectParam(channel, effectId, param, value) {
  const entry = channelFxNodes?.[channel]?.[effectId];
  if (!entry) return;
  if (param === 'wet') entry.send.gain.value = wetGain({ wet: value });
  else applyEffectParam(entry.node, entry.type, param, value);
}

/** Pitch/gain/decay knob turn in the DrumMachine window. Never rebuilds. */
export function updateDrumParams(drumKey, params) {
  drumParamsState = { ...drumParamsState, [drumKey]: params };
  if (!synths) return;
  applyDrumControls(drumKey, params);
  if (synths[drumKey]) synths[drumKey].volume.value = voiceVolume(drumKey);
}

/** One-shot preview when a pad is clicked in the DrumMachine window. */
export async function auditionDrum(drumKey) {
  await Tone.start();
  const s = ensureBuilt();
  if (s[drumKey]) s[drumKey].triggerAttackRelease('8n', Tone.now());
}

/** One-shot preview of a pitched voice — what you hear when clicking a cell
 *  in the piano roll, so placing a note tells you what it sounds like. */
export async function auditionNote(channel, pitch, duration = '8n') {
  if (!pitch) return;
  await Tone.start();
  const s = ensureBuilt();
  const voice = s[channel];
  if (!voice) return;
  // Mirror playPattern's per-voice branches so the preview click sounds like
  // the real playback: pluck = attack only, pad/strings = open fifth.
  if (PLUCK_KEYS.has(channel)) voice.triggerAttack(pitch, Tone.now());
  else if (CHORDAL_SET.has(channel)) voice.triggerAttackRelease(openFifth(pitch), duration, Tone.now());
  else voice.triggerAttackRelease(pitch, duration, Tone.now());
}

export function stopPattern() {
  if (sequence) { sequence.stop(); sequence.dispose(); sequence = null; }
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

/** Install a freshly recorded vocal take as the "내 목소리" instrument. The
 *  decoded AudioBuffer is mapped to baseNote and pitch-shifted across the range
 *  by the Sampler. Kept in module state so it survives an engine rebuild. */
export async function loadVocalSample(audioBuffer, baseNote = 'C4') {
  await Tone.start();
  const buf = new Tone.ToneAudioBuffer(audioBuffer);
  vocalSampleBuffer = buf;
  vocalBaseNote = baseNote;
  const s = ensureBuilt();
  if (s.vocalInst?.setSample) s.vocalInst.setSample(buf, baseNote);
}

/** Whether a vocal take has been recorded this session (drives the UI badge). */
export function hasVocalSample() { return Boolean(vocalSampleBuffer); }

// Per step, the note runs that START there — one entry {pitch, length} per
// pitch, so a chord starts several at once and a held note counts its length in
// steps (one sustained trigger instead of machine-gunning every step).
// `retrig[i]` truthy forces every note at step i to be its own 1-step hit
// (띵띵띵 instead of 띵~~~).
function computeRuns(arr, retrig) {
  const cells = arr.map(cellPitches);
  const rt = (i) => (Array.isArray(retrig) ? !!retrig[i] : !!retrig);
  const startsAt = Array.from({ length: cells.length }, () => []);
  for (let i = 0; i < cells.length; i++) {
    for (const pitch of cells[i]) {
      // a run continues (no new trigger) only when the previous step held the
      // same pitch and neither step is set to retrigger
      if (!rt(i) && i > 0 && !rt(i - 1) && cells[i - 1].includes(pitch)) continue;
      let len = 1;
      if (!rt(i)) while (i + len < cells.length && !rt(i + len) && cells[i + len].includes(pitch)) len++;
      startsAt[i].push({ pitch, length: len });
    }
  }
  return startsAt;
}

export async function playPattern(pattern, bpm, audio, onStep, startStep = 0) {
  await Tone.start();
  stopPattern();
  const { mixer, fx, channelMix, channelFx, drumParams } = audio;
  mixerState = mixer;
  drumParamsState = drumParams || {};
  channelMixState = channelMix || {};
  const s = ensureBuilt();
  syncAudioState({ mixer, channelMix, channelFx, drumParams });

  const totalSteps = pattern.bass.length;
  const from = Math.max(0, Math.min(totalSteps - 1, Math.round(startStep) || 0));
  // Per-step BPM: pattern.stepBpms[i] overrides the song default for step i.
  // A Tone.Sequence subdivides in Transport ticks, so changing Transport.bpm at
  // a section boundary re-tempos every step after it — that's how per-section
  // BPM works without leaving the proven Sequence engine.
  const stepBpms = pattern.stepBpms && pattern.stepBpms.length === totalSteps ? pattern.stepBpms : null;
  const bpmAt = (i) => (stepBpms ? stepBpms[i] : bpm) || bpm || 100;
  const stepDur = (i) => 60 / bpmAt(i) / 4;
  Tone.Transport.bpm.value = bpmAt(from);

  // Swing delays the off-beat 16ths by up to half a step. Per-section swing
  // rides in stepSwing[] (like stepBpms); a scalar pattern.swing is the
  // fallback for older callers that pass one groove for the whole pattern.
  const stepSwing = pattern.stepSwing && pattern.stepSwing.length === totalSteps ? pattern.stepSwing : null;
  const swingAt = (i) => clamp((stepSwing ? stepSwing[i] : (pattern.swing ?? 0)), 0, 1) * 0.5;

  const runsByTrack = {};
  MELODIC_KEYS.forEach((k) => { runsByTrack[k] = computeRuns(pattern[k] || [], pattern[`${k}Retrig`]); });
  // A sung topline lane, outside the channel roster (rival songs carry one so
  // they play as songs rather than bare beats). Played by the formant voice.
  const vocalRuns = computeRuns(pattern.vocal || []);
  const humanize = Boolean(fx?.humanize);
  const jTime = (time) => humanize ? time + (Math.random() - 0.5) * 0.012 : time;
  const jVel = (v) => humanize ? Math.max(0.05, Math.min(1, v * (1 + (Math.random() - 0.5) * 0.25))) : v;
  const velAt = (velArr, idx) => jVel((velArr?.[idx] ?? 100) / 127);
  const runSeconds = (start, length) => {
    let d = 0;
    for (let j = start; j < start + length && j < totalSteps; j++) d += stepDur(j);
    return d;
  };

  const seq = new Tone.Sequence((time, idx) => {
    // Re-tempo at each section boundary (and on loop-around at idx 0).
    if (stepBpms) {
      const prev = idx === 0 ? stepBpms[totalSteps - 1] : stepBpms[idx - 1];
      if (idx === 0 || stepBpms[idx] !== prev) Tone.Transport.bpm.setValueAtTime(stepBpms[idx], time);
    }
    const sd = stepDur(idx);
    const t0 = jTime(time + (idx % 2 === 1 ? sd * swingAt(idx) : 0));
    DRUM_INSTRUMENTS.forEach((di) => {
      if (!pattern.drums[di.key][idx]) return;
      const dv = velAt(pattern.drumVel?.[di.key], idx);
      // Ratchet: a cell can fire 1–4 fast hits within its step (drum roll).
      const rat = Math.max(1, Math.min(4, pattern.drumRatchet?.[di.key]?.[idx] || 1));
      for (let r = 0; r < rat; r++) {
        s[di.key].triggerAttackRelease(sd / rat * 0.9, t0 + (r * sd) / rat, dv);
      }
    });
    MELODIC_KEYS.forEach((k) => {
      const voice = s[k];
      const starts = runsByTrack[k]?.[idx];
      if (!voice || !starts || !starts.length) return;
      const vel = velAt(pattern[`${k}Velocity`], idx);
      // Keep the single-note "open fifth" thickening on pad/strings, but when a
      // real chord is placed, play exactly the notes the player chose.
      const isChord = cellPitches(pattern[k]?.[idx]).length > 1;
      starts.forEach(({ pitch, length }) => {
        if (PLUCK_KEYS.has(k)) voice.triggerAttack(pitch, t0, vel);
        else if (CHORDAL_SET.has(k) && !isChord) voice.triggerAttackRelease(openFifth(pitch), runSeconds(idx, length), t0, vel);
        else voice.triggerAttackRelease(pitch, runSeconds(idx, length), t0, vel);
      });
    });
    (vocalRuns[idx] || []).forEach(({ pitch, length }) => {
      if (s.vocal) s.vocal.triggerAttackRelease(pitch, runSeconds(idx, length), t0, 0.85);
    });
    Tone.Draw.schedule(() => onStep(idx), time);
  }, Array.from({ length: totalSteps }, (_, i) => i), '16n');
  seq.start(0);
  // Seek: begin the transport partway in so playback starts at `from` (click a
  // progress bar / timeline to jump there), instead of always from the top.
  let offset = 0;
  for (let j = 0; j < from; j++) offset += stepDur(j);
  Tone.Transport.start(undefined, offset);
  sequence = seq;
}

export function disposeEngine() {
  stopPattern();
  if (channelFxNodes) {
    Object.keys(channelFxNodes).forEach(disposeChannelFx);
    channelFxNodes = null;
  }
  channelFxSig = {};
  if (busses) { Object.values(busses).forEach((b) => b.dispose()); busses = null; }
  if (synths) { Object.values(synths).forEach((s) => s.dispose()); synths = null; }
  if (fxNodes) {
    Object.values(fxNodes).forEach((n) => n?.dispose?.());
    fxNodes = null;
  }
  drumCtl = null;
}
