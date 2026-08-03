import * as Tone from 'tone';

// A short cinematic "lights up" cue for the entry screen: a low impact, a
// rising swell, and a triumphant major chord with a shimmer on the hit — the
// sound of walking out to a full house. Must be triggered from a user gesture
// (the tap-to-start), which lets Tone resume the AudioContext under autoplay
// rules. Everything is created on demand and disposed after, so it never
// touches the game's Tone.Transport.
let playing = false;

export async function playIntroCue() {
  if (playing) return;
  playing = true;
  try {
    await Tone.start();
  } catch { /* context may already be running */ }

  const now = Tone.now() + 0.03;

  // master: gentle reverb -> limiter so nothing clips
  const limiter = new Tone.Limiter(-1.5).toDestination();
  const verb = new Tone.Freeverb({ roomSize: 0.86, dampening: 2600, wet: 0.28 }).connect(limiter);

  // 1) low impact on the "lights on"
  const boom = new Tone.MembraneSynth({
    pitchDecay: 0.09, octaves: 6,
    envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.5 },
  }).connect(verb);
  boom.volume.value = -5;
  boom.triggerAttackRelease('C1', '2n', now);

  // 2) rising swell — white noise through a filter sweeping up over ~1.6s
  const riserFilter = new Tone.Filter({ type: 'bandpass', Q: 1.1, frequency: 260 }).connect(verb);
  const riser = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 1.55, decay: 0.1, sustain: 0.25, release: 0.7 },
  }).connect(riserFilter);
  riser.volume.value = -22;
  riser.triggerAttackRelease(1.6, now);
  riserFilter.frequency.setValueAtTime(260, now);
  riserFilter.frequency.exponentialRampToValueAtTime(6500, now + 1.6);

  // 3) triumphant chord swelling in at the peak
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
    envelope: { attack: 0.5, decay: 0.4, sustain: 0.75, release: 1.8 },
  }).connect(verb);
  pad.volume.value = -15;
  pad.triggerAttackRelease(['C3', 'G3', 'C4', 'E4', 'G4', 'B4'], 1.9, now + 1.5);

  // 4) bright metallic shimmer on the hit
  const bell = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.3, release: 0.5 },
    harmonicity: 5.1, modulationIndex: 18, resonance: 4200, octaves: 1.4,
  }).connect(verb);
  bell.volume.value = -28;
  bell.triggerAttackRelease('16n', now + 1.5);

  // dispose the whole graph after the tail
  setTimeout(() => {
    [boom, riser, riserFilter, pad, bell, verb, limiter].forEach((n) => { try { n.dispose(); } catch { /* ignore */ } });
    playing = false;
  }, 5500);
}
