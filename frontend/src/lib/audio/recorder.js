/**
 * Mic capture for the recording studio (GDD §6 "보컬 직접 녹음").
 *
 * Kept free of React so the studio screen only deals with start/stop and a
 * level number. MediaRecorder's container format varies by browser, so we
 * negotiate a supported mime type rather than assuming webm/opus.
 */

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

export function isRecordingSupported() {
  return typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof window.MediaRecorder !== 'undefined';
}

function pickMimeType() {
  for (const t of PREFERRED_MIME_TYPES) {
    if (window.MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return ''; // let the browser choose
}

/**
 * Starts recording. Returns a handle with stop() -> {blob, mimeType, durationSec, peak}.
 * onLevel (0..1) fires ~20x/sec so the UI can draw an input meter.
 * `peak` is the loudest input seen across the whole take — the studio uses it
 * to tell "mic captured nothing" apart from "playback problem", which is
 * otherwise indistinguishable from a silent result.
 * monitor: route the mic to the speakers so the singer hears themselves
 * (needs headphones — on speakers it will feed back).
 */
export async function startRecording({ onLevel, monitor = false } = {}) {
  if (!isRecordingSupported()) {
    throw new Error('이 브라우저는 녹음을 지원하지 않습니다');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    // Distinguish the common failures so the UI can tell the user what to fix.
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      throw new Error('마이크 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘에서 마이크를 허용해 주세요.');
    }
    if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
      throw new Error('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해 주세요.');
    }
    throw new Error(`마이크를 열 수 없습니다: ${e.message || e.name}`);
  }

  const mimeType = pickMimeType();
  const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  // Level metering off a separate AnalyserNode — independent of Tone.js's
  // context so monitoring can't be disturbed by transport start/stop.
  let audioCtx = null;
  let rafId = null;
  let takePeak = 0; // loudest sample seen for the whole take

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  if (monitor) source.connect(audioCtx.destination);

  const buf = new Uint8Array(analyser.frequencyBinCount);
  let last = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
    if (peak > takePeak) takePeak = peak;
    const now = performance.now();
    if (onLevel && now - last > 50) { last = now; onLevel(peak); }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  const startedAt = performance.now();
  recorder.start();

  return {
    async stop() {
      const done = new Promise((resolve) => { recorder.onstop = resolve; });
      if (recorder.state !== 'inactive') recorder.stop();
      await done;

      if (rafId) cancelAnimationFrame(rafId);
      if (audioCtx) await audioCtx.close().catch(() => {});
      stream.getTracks().forEach((t) => t.stop());

      const type = recorder.mimeType || mimeType || 'audio/webm';
      return {
        blob: new Blob(chunks, { type }),
        mimeType: type,
        peak: takePeak,
        durationSec: (performance.now() - startedAt) / 1000,
      };
    },
    cancel() {
      if (rafId) cancelAnimationFrame(rafId);
      if (audioCtx) audioCtx.close().catch(() => {});
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
