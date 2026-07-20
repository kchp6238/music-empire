import * as Tone from 'tone';
import { DRUM_INSTRUMENTS, EFFECT_TYPES } from '../gameData/constants';

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

const DRUM_KEYS = DRUM_INSTRUMENTS.map((d) => d.key);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const semitoneRatio = (semitones) => 2 ** (semitones / 12);

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

  const pianoChorus = new Tone.Chorus({ frequency: 3.5, delayTime: 2.5, depth: 0.4 }).start();
  voices.piano = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.5, modulationIndex: 3.5,
    envelope: { attack: 0.006, decay: 0.6, sustain: 0.25, release: 0.8 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.4 },
  });

  // Karplus-Strong plucked-string synthesis — ships in Tone.js already, a
  // real timbre upgrade over a bare triangle oscillator for ~free.
  voices.guitar = new Tone.PluckSynth({ attackNoise: 1, dampening: 3500, resonance: 0.92 });

  // Master bus: everything feeds compressor -> limiter -> speakers, instead
  // of each voice going straight toDestination(). Glue/loudness only.
  const compressor = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.01, release: 0.2 });
  const limiter = new Tone.Limiter(-1);
  compressor.connect(limiter);
  limiter.toDestination();

  // One bus per mixer channel — the insertion point for that channel's
  // effects chain, and what makes per-channel processing possible at all.
  const chanBusses = {
    drums: new Tone.Channel().connect(compressor),
    bass: new Tone.Channel().connect(compressor),
    piano: new Tone.Channel().connect(compressor),
    guitar: new Tone.Channel().connect(compressor),
  };

  DRUM_KEYS.forEach((key) => voices[key].connect(chanBusses.drums));
  voices.bass.connect(chanBusses.bass);
  voices.piano.connect(pianoChorus);
  pianoChorus.connect(chanBusses.piano);
  voices.guitar.connect(chanBusses.guitar);

  return { voices, controls, chanBusses, fx: { compressor, limiter, pianoChorus } };
}

function ensureBuilt() {
  if (synths) return synths;
  const built = buildSynths();
  synths = built.voices;
  drumCtl = built.controls;
  busses = built.chanBusses;
  fxNodes = built.fx;
  channelFxNodes = { drums: {}, bass: {}, piano: {}, guitar: {} };

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

export async function playPattern(pattern, bpm, audio, onStep) {
  await Tone.start();
  stopPattern();
  const { mixer, fx, channelMix, channelFx, drumParams } = audio;
  mixerState = mixer;
  drumParamsState = drumParams || {};
  channelMixState = channelMix || {};
  const s = ensureBuilt();
  syncAudioState({ mixer, channelMix, channelFx, drumParams });

  Tone.Transport.bpm.value = bpm;
  const totalSteps = pattern.bass.length;
  const stepSeconds = Tone.Time('16n').toSeconds();
  const bassRuns = computeRuns(pattern.bass);
  const pianoRuns = computeRuns(pattern.piano);
  const guitarRuns = computeRuns(pattern.guitar);
  const humanize = Boolean(fx?.humanize);

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
  if (channelFxNodes) {
    Object.keys(channelFxNodes).forEach(disposeChannelFx);
    channelFxNodes = null;
  }
  channelFxSig = {};
  if (busses) { Object.values(busses).forEach((b) => b.dispose()); busses = null; }
  if (synths) { Object.values(synths).forEach((s) => s.dispose()); synths = null; }
  if (fxNodes) {
    fxNodes.compressor.dispose();
    fxNodes.limiter.dispose();
    fxNodes.pianoChorus.dispose();
    fxNodes = null;
  }
  drumCtl = null;
}
