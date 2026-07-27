/**
 * Turn a recorded voice Blob into a clean one-shot AudioBuffer for the vocal
 * instrument sampler. Leading silence is trimmed so the note starts on the
 * attack (a sampler pitch-shifts the whole buffer, so front silence would push
 * every played note late), and the tail is capped so one held key doesn't ring
 * for the entire original take. An AudioBuffer is just PCM — it carries no
 * context binding — so the throwaway decode context is safe to close before
 * the buffer is handed to Tone.
 */
export async function decodeVocalSample(blob, { maxSeconds = 2.5, silenceDb = -45 } = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const sr = buf.sampleRate;
    const mono = buf.getChannelData(0);
    const thresh = Math.pow(10, silenceDb / 20);

    let start = 0;
    let peak = 0;
    for (let i = 0; i < mono.length; i++) {
      const a = Math.abs(mono[i]);
      if (a > peak) peak = a;
      if (start === 0 && a > thresh) start = i;
    }
    // Back off a few ms so the very onset transient isn't clipped.
    start = Math.max(0, start - Math.floor(0.005 * sr));

    const end = Math.min(buf.length, start + Math.floor(maxSeconds * sr));
    const len = Math.max(1, end - start);
    const out = ctx.createBuffer(buf.numberOfChannels, len, sr);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const src = buf.getChannelData(ch);
      const dst = out.getChannelData(ch);
      for (let i = 0; i < len; i++) dst[i] = src[start + i];
    }
    // Short fade-out so a capped tail doesn't click when the note releases.
    const fade = Math.min(len, Math.floor(0.03 * sr));
    for (let ch = 0; ch < out.numberOfChannels; ch++) {
      const dst = out.getChannelData(ch);
      for (let i = 0; i < fade; i++) dst[len - 1 - i] *= i / fade;
    }
    return { buffer: out, duration: len / sr, peak };
  } finally {
    ctx.close();
  }
}
