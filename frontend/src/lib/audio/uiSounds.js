import * as Tone from 'tone';

/**
 * Short one-shot UI feedback sounds (step toggle, release success) — separate
 * from the song-playback engine (engine.js) since these fire independent of
 * Transport/sequence state and must never be affected by mixer/fx settings.
 */
let blip = null;
let chime = null;

function ensureNodes() {
  if (!blip) blip = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).toDestination();
  if (!chime) chime = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 } }).toDestination();
  blip.volume.value = -18;
  chime.volume.value = -10;
}

export async function playStepTick() {
  await Tone.start();
  ensureNodes();
  blip.triggerAttackRelease('C3', '32n');
}

export async function playSuccessChime() {
  await Tone.start();
  ensureNodes();
  const now = Tone.now();
  chime.triggerAttackRelease(['C5', 'E5', 'G5'], '8n', now);
  chime.triggerAttackRelease(['C6'], '8n', now + 0.12);
}
