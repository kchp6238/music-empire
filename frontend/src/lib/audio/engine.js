import * as Tone from 'tone';
import { DRUM_INSTRUMENTS, EFFECT_TYPES, CHANNEL_KEYS, MELODIC_KEYS, CHORDAL_KEYS } from '../gameData/constants';

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

  // ---- expanded instrument roster (all pitched, one per new channel) ----

  // Electric guitar: a driven sawtooth MonoSynth pushed through overdrive.
  const elecDrive = new Tone.Distortion({ distortion: 0.36, wet: 0.85 });
  voices.elecGuitar = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.006, decay: 0.2, sustain: 0.6, release: 0.35 },
    filter: { type: 'lowpass', rolloff: -12, Q: 1 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4, baseFrequency: 500, octaves: 3 },
  });

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
  voices.piano.connect(pianoChorus);
  pianoChorus.connect(chanBusses.piano);
  voices.guitar.connect(chanBusses.guitar);
  voices.elecGuitar.chain(elecDrive, chanBusses.elecGuitar);
  voices.brass.chain(brassFilter, chanBusses.brass);
  voices.synthLead.connect(chanBusses.synthLead);
  voices.pad.chain(padFilter, chanBusses.pad);
  voices.strings.chain(stringsChorus, chanBusses.strings);

  return {
    voices, controls, chanBusses,
    fx: { compressor, limiter, pianoChorus, elecDrive, brassFilter, padFilter, stringsChorus },
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
  // One run map per pitched lane present in the pattern (older data may lack
  // the newer lanes entirely — skip those rather than crash).
  const runsByTrack = {};
  MELODIC_KEYS.forEach((k) => { runsByTrack[k] = computeRuns(pattern[k] || []); });
  const humanize = Boolean(fx?.humanize);

  const jTime = (time) => humanize ? time + (Math.random() - 0.5) * 0.012 : time;
  const jVel = (v) => humanize ? Math.max(0.05, Math.min(1, v * (1 + (Math.random() - 0.5) * 0.25))) : v;
  const velAt = (velArr, idx) => jVel((velArr?.[idx] ?? 100) / 127);

  const seq = new Tone.Sequence((time, idx) => {
    DRUM_INSTRUMENTS.forEach((di) => {
      if (pattern.drums[di.key][idx]) s[di.key].triggerAttackRelease('8n', jTime(time));
    });
    MELODIC_KEYS.forEach((k) => {
      const voice = s[k];
      const run = runsByTrack[k]?.[idx];
      if (!voice || !run) return;
      const vel = velAt(pattern[`${k}Velocity`], idx);
      if (PLUCK_KEYS.has(k)) {
        // PluckSynth (Karplus-Strong) self-decays — triggerAttack only, no
        // release phase to schedule, and "duration" wouldn't do anything.
        voice.triggerAttack(run.pitch, jTime(time), vel);
      } else if (CHORDAL_SET.has(k)) {
        // Pad/strings voice one melody line as an open fifth (root+5th+octave)
        // so it fills without a chord data model, and stays key-neutral (no
        // third) so it never clashes with a major or minor song.
        voice.triggerAttackRelease(openFifth(run.pitch), stepSeconds * run.length, jTime(time), vel);
      } else {
        voice.triggerAttackRelease(run.pitch, stepSeconds * run.length, jTime(time), vel);
      }
    });
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
    Object.values(fxNodes).forEach((n) => n?.dispose?.());
    fxNodes = null;
  }
  drumCtl = null;
}
