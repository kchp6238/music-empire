import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Check } from 'lucide-react';
import { PluginWindow } from './PluginWindow';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { startRecording, isRecordingSupported } from '../../lib/audio/recorder';
import { decodeToMono, transcribeDrums, transcribeMelody } from '../../lib/audio/transcribe';
import { KEYS, SCALES } from '../../lib/audio/autotune';
import {
  DRUM_INSTRUMENTS, CHANNELS, MELODIC_BY_KEY,
} from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

const PITCHES_BY_TRACK = Object.fromEntries(
  Object.entries(MELODIC_BY_KEY).map(([k, t]) => [k, t.pitches])
);
const DRUM_LABEL = Object.fromEntries(DRUM_INSTRUMENTS.map((d) => [d.key, `${d.icon} ${d.label}`]));

/**
 * Record a voice and turn it into pattern data — beatbox for drums, hum for a
 * melody. The take is never uploaded; it's decoded and analysed in the
 * browser, then thrown away once the notes are placed.
 */
export function VoiceToPattern({ onClose }) {
  const draft = useGameStore((s) => s.draft);
  const selectChannel = useGameStore((s) => s.selectChannel);
  const applyDrumTranscription = useGameStore((s) => s.applyDrumTranscription);
  const applyMelodyTranscription = useGameStore((s) => s.applyMelodyTranscription);

  const [mode, setMode] = useState('drums'); // 'drums' | 'bass' | 'piano' | 'guitar'
  const [keyIndex, setKeyIndex] = useState(0);
  const [scale, setScale] = useState('major');
  const [sensitivity, setSensitivity] = useState(100);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { kind, hits|notes, count, peak }

  const handleRef = useRef(null);
  const timerRef = useRef(null);
  const takeRef = useRef(null); // { mono, sampleRate } — kept so re-analysis
                                // with a different sensitivity is instant

  const section = draft.sections[draft.editingSection];
  const steps = section.length;
  // 16 steps to the bar at 4 sixteenths per beat
  const takeSeconds = (steps / 4) * (60 / draft.bpm);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleRef.current?.cancel?.();
  }, []);

  function analyse(mono, sampleRate) {
    const opts = { bpm: draft.bpm, steps, sensitivity: 2 - sensitivity / 100 };
    if (mode === 'drums') {
      const { hits, onsetCount } = transcribeDrums(mono, sampleRate, opts);
      const placed = Object.values(hits).reduce((a, arr) => a + arr.length, 0);
      return { kind: 'drums', hits, count: placed, onsetCount };
    }
    const { notes, noteCount } = transcribeMelody(mono, sampleRate, {
      ...opts, keyIndex, scale, pitches: PITCHES_BY_TRACK[mode],
    });
    return { kind: 'melody', notes, count: noteCount, onsetCount: noteCount };
  }

  async function onStart() {
    setError(''); setResult(null); setElapsed(0);
    if (!isRecordingSupported()) { setError('이 브라우저는 녹음을 지원하지 않습니다'); return; }
    try {
      // raw: the browser's auto-gain flattens exactly the loudness envelope
      // the onset detector reads, so it has to be off for this.
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
        setError('소리가 거의 잡히지 않았습니다. 마이크에 더 가까이서 크게 내보세요.');
        return;
      }
      const { data, sampleRate } = await decodeToMono(blob);
      takeRef.current = { mono: data, sampleRate };
      setResult({ ...analyse(data, sampleRate), peak });
    } catch (e) {
      setError(e.message || '녹음을 분석하지 못했습니다');
    } finally {
      setBusy(false);
    }
  }

  // Re-analysing the take we already have is instant, so the sensitivity
  // slider can be a live control rather than "record it again".
  function reanalyse(nextSensitivity) {
    setSensitivity(nextSensitivity);
    if (!takeRef.current || recording) return;
    const { mono, sampleRate } = takeRef.current;
    const opts = { bpm: draft.bpm, steps, sensitivity: 2 - nextSensitivity / 100 };
    if (mode === 'drums') {
      const { hits, onsetCount } = transcribeDrums(mono, sampleRate, opts);
      const placed = Object.values(hits).reduce((a, arr) => a + arr.length, 0);
      setResult((r) => ({ ...r, kind: 'drums', hits, count: placed, onsetCount }));
    } else {
      const { notes, noteCount } = transcribeMelody(mono, sampleRate, {
        ...opts, keyIndex, scale, pitches: PITCHES_BY_TRACK[mode],
      });
      setResult((r) => ({ ...r, kind: 'melody', notes, count: noteCount, onsetCount: noteCount }));
    }
  }

  function apply() {
    if (!result) return;
    if (result.kind === 'drums') applyDrumTranscription(result.hits);
    else applyMelodyTranscription(mode, result.notes);
    selectChannel(mode === 'drums' ? 'drums' : mode);
    onClose();
  }

  const modeLabel = mode === 'drums'
    ? '입으로 "둥 츠 둥둥 츠" 처럼 리듬을 내보세요'
    : '"라~ 라~" 하고 멜로디를 흥얼거려보세요';

  return (
    <PluginWindow title="목소리로 찍기" accent="#E893A6" initial={{ x: 200, y: 110 }} onClose={onClose}>
      <div style={{ width: 380 }}>
        <div className="grid grid-cols-4 gap-1 mb-3">
          <button
            onClick={() => { setMode('drums'); setResult(null); }}
            className="rounded border px-2 py-1.5 text-[10px] cursor-pointer"
            style={{
              borderColor: mode === 'drums' ? 'var(--color-accent)' : 'var(--color-border)',
              color: mode === 'drums' ? 'var(--color-accent)' : 'var(--color-muted)', background: 'transparent',
            }}
          >🥁 비트박스</button>
          {CHANNELS.filter((c) => c.key !== 'drums').map((c) => (
            <button
              key={c.key}
              onClick={() => { setMode(c.key); setResult(null); }}
              className="rounded border px-2 py-1.5 text-[10px] cursor-pointer"
              style={{
                borderColor: mode === c.key ? c.color : 'var(--color-border)',
                color: mode === c.key ? c.color : 'var(--color-muted)', background: 'transparent',
              }}
            >{c.icon} {MELODIC_BY_KEY[c.key]?.label || c.label}</button>
          ))}
        </div>

        <div className="text-[11px] text-muted mb-3">
          {modeLabel} · <span className="font-mono text-text">{draft.editingSection}</span> 구간에 들어갑니다
          （{draft.bpm} BPM 기준 약 {takeSeconds.toFixed(1)}초）
        </div>

        {mode !== 'drums' && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <label className="text-[10px] text-muted">키</label>
            <Select value={keyIndex} onChange={(e) => setKeyIndex(Number(e.target.value))} disabled={recording}>
              {KEYS.map((k, i) => <option key={k} value={i}>{k}</option>)}
            </Select>
            <label className="text-[10px] text-muted">스케일</label>
            <Select value={scale} onChange={(e) => setScale(e.target.value)} disabled={recording}>
              {Object.keys(SCALES).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          {!recording ? (
            <Button variant="primary" size="sm" onClick={onStart} disabled={busy}>
              <Mic size={13} /> 녹음 시작
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={onStop}>
              <Square size={13} /> 정지
            </Button>
          )}
          {recording && (
            <>
              <div className="font-mono text-xs text-danger">{elapsed.toFixed(1)}s</div>
              <div className="flex-1 h-1.5 rounded" style={{ background: 'var(--color-groove)' }}>
                <div className="h-full rounded transition-[width]" style={{
                  width: `${Math.min(100, level * 140)}%`,
                  background: level > 0.8 ? 'var(--color-danger)' : 'var(--color-accent2)',
                }} />
              </div>
            </>
          )}
          {busy && !recording && <span className="text-[11px] text-muted">분석 중…</span>}
        </div>

        {error && <div className="text-danger text-[11px] mb-2">{error}</div>}

        {result && (
          <div className="me-daw-groove p-2.5 mb-3">
            {result.count === 0 ? (
              <div className="text-[11px] text-muted">
                소리는 잡혔는데 음을 잡아내지 못했어요. 감도를 올리거나 조금 더 또렷하게 내보세요.
              </div>
            ) : (
              <>
                <div className="text-[11px] text-accent2 mb-2">
                  {result.onsetCount}번의 소리를 잡아 {result.count}개를 배치했습니다
                </div>
                {result.kind === 'drums' ? (
                  <div className="flex flex-col gap-1">
                    {Object.entries(result.hits).filter(([, arr]) => arr.length).map(([k, arr]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted w-20 shrink-0">{DRUM_LABEL[k]}</span>
                        <div className="flex gap-[2px]">
                          {Array.from({ length: steps }, (_, i) => (
                            <span key={i} className="rounded-[1px]" style={{
                              width: 6, height: 8,
                              background: arr.includes(i) ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                            }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono text-[10px] text-muted break-all leading-relaxed">
                    {result.notes.map((n, i) => (n ? n : '·')).join(' ')}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {result && (
          <div className="mb-3">
            <div className="text-[10px] text-muted mb-1">
              감도 <span className="font-mono text-text">{sensitivity}</span>
              <span className="text-faint ml-1">— 놓친 소리가 있으면 올리고, 너무 많이 찍히면 내리세요</span>
            </div>
            <input type="range" className="me-slider w-full" min={40} max={160} value={sensitivity}
              onChange={(e) => reanalyse(Number(e.target.value))} />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={apply} disabled={!result || result.count === 0}>
            <Check size={13} /> 이대로 넣기
          </Button>
          <Button size="sm" onClick={onClose}>취소</Button>
        </div>
      </div>
    </PluginWindow>
  );
}
