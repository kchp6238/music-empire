import { useEffect, useRef, useState } from 'react';
import { Wand2, X } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { KEYS, SCALES, AUTOTUNE_PRESETS, autotuneBlob } from '../../lib/audio/autotune';
import * as recordingsApi from '../../lib/api/recordings';

const SCALE_LABELS = {
  major: '메이저',
  minor: '마이너',
  pentatonic: '펜타토닉',
  blues: '블루스',
  dorian: '도리안',
  harmonicMinor: '하모닉 마이너',
  chromatic: '크로매틱 (모든 반음)',
};

const HARMONY_CHOICES = [
  { id: 'third', label: '3도', intervals: [3] },
  { id: 'fifth', label: '5도', intervals: [7] },
  { id: 'both', label: '3도+5도', intervals: [3, 7] },
  { id: 'octave', label: '옥타브', intervals: [12] },
];

export function AutotunePanel({ take, songId, onClose, onSaved }) {
  const [presetId, setPresetId] = useState('natural');
  const [strength, setStrength] = useState(100);
  const [keyIndex, setKeyIndex] = useState(0);
  const [scale, setScale] = useState('major');
  const [harmonyId, setHarmonyId] = useState('both');
  const [vibratoDepth, setVibratoDepth] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // {url, blob, stats, durationSec}
  const urlRef = useRef(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const preset = AUTOTUNE_PRESETS.find((p) => p.id === presetId) || AUTOTUNE_PRESETS[0];

  async function apply() {
    setBusy(true); setError(''); setResult(null);
    try {
      // Pull the original take's audio, then process entirely client-side.
      const srcUrl = await recordingsApi.fetchRecordingUrl(take.id);
      const srcBlob = await (await fetch(srcUrl)).blob();
      URL.revokeObjectURL(srcUrl);

      const options = { keyIndex, scale, strength: strength / 100, ...preset.options };
      if (preset.options.effect === 'harmony') {
        options.harmonyIntervals = HARMONY_CHOICES.find((h) => h.id === harmonyId).intervals;
      }
      if (preset.options.effect === 'vibrato') {
        options.vibratoDepth = vibratoDepth / 100;
      }

      const { blob, stats, durationSec } = await autotuneBlob(srcBlob, options);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setResult({ url: urlRef.current, blob, stats, durationSec });
    } catch (e) {
      setError(e.message || '오토튠 처리에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    setBusy(true); setError('');
    try {
      await recordingsApi.uploadRecording({
        blob: result.blob,
        mimeType: 'audio/wav',
        durationSec: result.durationSec,
        songId: take.song_id || songId,
        // Keep the source take's section so a processed/harmony copy lands on
        // the same part of the song and lines up in layered playback.
        section: take.section || null,
        title: `${take.title} (${preset.label})`,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="mt-2 border-purple/50">
      <div className="flex items-center mb-3">
        <span className="font-bold text-sm flex items-center gap-2">
          <Wand2 size={15} className="text-purple" /> 목소리 효과 — {take.title}
        </span>
        <Button size="sm" className="ml-auto" onClick={onClose} aria-label="닫기"><X size={13} /></Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
        {AUTOTUNE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPresetId(p.id); setResult(null); }}
            disabled={busy}
            className="rounded-lg border px-2 py-2 text-left cursor-pointer transition-colors"
            style={{
              borderColor: p.id === presetId ? 'var(--color-purple)' : 'var(--color-border)',
              background: p.id === presetId ? 'rgba(139,127,209,0.12)' : 'transparent',
            }}
            title={p.desc}
          >
            <div className="text-sm leading-none mb-1" aria-hidden>{p.icon}</div>
            <div className="text-[11px] font-semibold text-text leading-tight">{p.label}</div>
          </button>
        ))}
      </div>
      <div className="text-[11px] text-faint mb-3">{preset.desc}</div>

      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="text-xs text-muted">키</label>
        <Select value={keyIndex} onChange={(e) => setKeyIndex(Number(e.target.value))} disabled={busy}>
          {KEYS.map((k, i) => <option key={k} value={i}>{k}</option>)}
        </Select>
        <label className="text-xs text-muted">스케일</label>
        <Select value={scale} onChange={(e) => setScale(e.target.value)} disabled={busy}>
          {Object.keys(SCALES).map((s) => <option key={s} value={s}>{SCALE_LABELS[s] || s}</option>)}
        </Select>

        {preset.options.effect === 'harmony' && (
          <>
            <label className="text-xs text-muted">화음</label>
            <Select value={harmonyId} onChange={(e) => setHarmonyId(e.target.value)} disabled={busy}>
              {HARMONY_CHOICES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
            </Select>
          </>
        )}
      </div>

      {preset.options.effect === 'vibrato' && (
        <div className="mb-3">
          <div className="text-xs text-muted mb-1">떨림 세기 <span className="font-mono text-text">{vibratoDepth}%</span></div>
          <input type="range" className="me-slider w-full" min={5} max={100} value={vibratoDepth}
            onChange={(e) => setVibratoDepth(Number(e.target.value))} disabled={busy} />
        </div>
      )}

      {!preset.lockStrength && (
        <div className="mb-3">
          <div className="text-xs text-muted mb-1">
            보정 강도 <span className="font-mono text-text">{strength}%</span>
            <span className="text-faint ml-2">
              {strength >= 90 ? '— 음정을 정확히 맞춤' : strength >= 40 ? '— 자연스러운 교정' : '— 살짝만 다듬기'}
            </span>
          </div>
          <input type="range" className="me-slider w-full" min={0} max={100} value={strength}
            onChange={(e) => setStrength(Number(e.target.value))} disabled={busy} />
        </div>
      )}

      {error && <div className="text-danger text-xs mb-2">{error}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary" onClick={apply} disabled={busy}>
          {busy ? '처리 중…' : '적용해서 들어보기'}
        </Button>
        {result && (
          <Button variant="primary" onClick={save} disabled={busy}>새 테이크로 저장</Button>
        )}
      </div>

      {result && (
        <div className="mt-3">
          <div className="text-xs text-accent2 mb-2">
            {result.stats.corrected}/{result.stats.blocks} 구간 보정 · 평균 {result.stats.avgCentsMoved.toFixed(0)}센트 이동
          </div>
          {result.stats.corrected === 0 && (
            <div className="text-xs text-muted mb-2">
              보정할 음정이 감지되지 않았습니다. 무음이거나 음정이 이미 정확한 테이크일 수 있어요.
            </div>
          )}
          <audio controls src={result.url} className="w-full" />
          <div className="text-[11px] text-faint mt-1">먼저 들어보고 마음에 들면 저장하세요. 원본은 그대로 남습니다.</div>
        </div>
      )}
    </Panel>
  );
}
