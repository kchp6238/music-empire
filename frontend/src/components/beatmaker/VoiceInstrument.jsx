import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Check, Play } from 'lucide-react';
import { PluginWindow } from './PluginWindow';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { startRecording, isRecordingSupported } from '../../lib/audio/recorder';
import { decodeVocalSample } from '../../lib/audio/vocalSample';
import { auditionNote } from '../../lib/audio/engine';
import { VOCAL_INST_PITCHES } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

// A few octaves of options, but default to a comfortable mid pitch most people
// can sing. The base note only needs to be roughly the note you sang — the
// sampler shifts from there — so this is a "sing about this pitch" guide.
const BASE_NOTE_CHOICES = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'];

/**
 * Record one sustained vowel ("아~") and turn it into a playable instrument:
 * the take is mapped to a base note in a sampler, then pitch-shifted across the
 * range so you can write melodies in your own voice. The sample is never
 * uploaded — it lives in the audio engine for this session only.
 */
export function VoiceInstrument({ onClose }) {
  const loadVocalInstrument = useGameStore((s) => s.loadVocalInstrument);
  const selectChannel = useGameStore((s) => s.selectChannel);
  const vocalSampleInfo = useGameStore((s) => s.vocalSampleInfo);

  const [baseNote, setBaseNote] = useState(vocalSampleInfo?.baseNote || 'C4');
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(Boolean(vocalSampleInfo));

  const handleRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleRef.current?.cancel?.();
  }, []);

  async function onStart() {
    setError(''); setElapsed(0);
    if (!isRecordingSupported()) { setError('이 브라우저는 녹음을 지원하지 않습니다'); return; }
    // Play the target pitch first so the singer can match it, then record.
    try { await auditionNote('piano', baseNote, '2n'); } catch { /* non-fatal */ }
    try {
      handleRef.current = await startRecording({ onLevel: setLevel, raw: true });
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed((e) => e + 0.25), 250);
    } catch (e) {
      setError(e.message || '마이크를 열 수 없습니다');
    }
  }

  async function onStop() {
    if (!handleRef.current) return;
    setBusy(true);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      const { blob, peak } = await handleRef.current.stop();
      handleRef.current = null;
      setRecording(false);
      setLevel(0);
      if (peak < 0.02) {
        setError('소리가 거의 잡히지 않았어요. 마이크에 가까이서 "아~" 하고 길게 내보세요.');
        return;
      }
      const { buffer, peak: samplePeak } = await decodeVocalSample(blob);
      if (samplePeak < 0.02) { setError('음이 너무 작아요. 조금 더 크게 불러주세요.'); return; }
      await loadVocalInstrument(buffer, baseNote, buffer.duration);
      setReady(true);
    } catch (e) {
      setError(e.message || '녹음을 처리하지 못했습니다');
    } finally {
      setBusy(false);
    }
  }

  function previewScale() {
    // Play a little run so the player hears their voice pitched around.
    const notes = ['C4', 'E4', 'G4', 'C5'];
    notes.forEach((n, i) => setTimeout(() => auditionNote('vocalInst', n, '8n'), i * 260));
  }

  function useIt() {
    selectChannel('vocalInst');
    onClose();
  }

  return (
    <PluginWindow title="내 목소리 악기" accent="#F08AB0" initial={{ x: 220, y: 120 }} onClose={onClose}>
      <div style={{ width: 360 }}>
        <div className="text-[11px] text-muted mb-3 leading-relaxed">
          한 음을 <span className="text-text font-semibold">"아~"</span> 하고 2~3초 길게 부르면,
          그 목소리가 <span className="text-text">악기</span>가 되어 피아노롤에서 멜로디로 연주됩니다.
        </div>

        <div className="flex items-center gap-2 mb-3">
          <label className="text-[10px] text-muted">부를 음(기준)</label>
          <Select value={baseNote} onChange={(e) => setBaseNote(e.target.value)} disabled={recording}>
            {BASE_NOTE_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <button
            className="text-[10px] px-2 py-1 rounded border cursor-pointer inline-flex items-center gap-1"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'transparent' }}
            onClick={() => auditionNote('piano', baseNote, '2n')}
            disabled={recording}
            title="이 음을 듣고 따라 불러보세요"
          >
            <Play size={10} /> 음 듣기
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          {!recording ? (
            <Button variant="primary" size="sm" onClick={onStart} disabled={busy}>
              <Mic size={13} /> {ready ? '다시 녹음' : '녹음 시작'}
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={onStop}>
              <Square size={13} /> 정지 & 만들기
            </Button>
          )}
          {recording && (
            <>
              <div className="font-mono text-xs text-danger">{elapsed.toFixed(1)}s</div>
              <div className="flex-1 h-1.5 rounded" style={{ background: 'var(--color-groove)' }}>
                <div className="h-full rounded transition-[width]" style={{
                  width: `${Math.min(100, level * 140)}%`,
                  background: level > 0.85 ? 'var(--color-danger)' : '#F08AB0',
                }} />
              </div>
            </>
          )}
          {busy && !recording && <span className="text-[11px] text-muted">만드는 중…</span>}
        </div>

        {error && <div className="text-danger text-[11px] mb-2">{error}</div>}

        {ready && !recording && (
          <div className="me-daw-groove p-2.5 mb-3">
            <div className="text-[11px] text-accent2 mb-2">
              ✓ 목소리 악기가 준비됐어요{vocalSampleInfo?.duration ? ` (${vocalSampleInfo.duration.toFixed(1)}초)` : ''}.
              채널 랙의 <span style={{ color: '#F08AB0' }}>🎤 내 목소리</span>에서 멜로디를 찍어보세요.
            </div>
            <button
              className="text-[10px] px-2 py-1 rounded border cursor-pointer inline-flex items-center gap-1"
              style={{ borderColor: 'rgba(240,138,176,0.5)', color: '#F08AB0', background: 'transparent' }}
              onClick={previewScale}
            >
              <Play size={10} /> 미리 들어보기 (도·미·솔·도)
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={useIt} disabled={!ready}>
            <Check size={13} /> 이 악기 쓰기
          </Button>
          <Button size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </PluginWindow>
  );
}
