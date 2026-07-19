import { useEffect, useRef, useState } from 'react';
import { Wand2, X } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { KEYS, SCALES, autotuneBlob } from '../../lib/audio/autotune';
import * as recordingsApi from '../../lib/api/recordings';

const SCALE_LABELS = {
  major: '메이저',
  minor: '마이너',
  pentatonic: '펜타토닉',
  chromatic: '크로매틱 (모든 반음)',
};

export function AutotunePanel({ take, songId, onClose, onSaved }) {
  const [strength, setStrength] = useState(100);
  const [keyIndex, setKeyIndex] = useState(0);
  const [scale, setScale] = useState('major');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // {url, blob, stats, durationSec}
  const urlRef = useRef(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function apply() {
    setBusy(true); setError(''); setResult(null);
    try {
      // Pull the original take's audio, then process entirely client-side.
      const srcUrl = await recordingsApi.fetchRecordingUrl(take.id);
      const srcBlob = await (await fetch(srcUrl)).blob();
      URL.revokeObjectURL(srcUrl);

      const { blob, stats, durationSec } = await autotuneBlob(srcBlob, {
        strength: strength / 100, keyIndex, scale,
      });
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
        title: `${take.title} (오토튠)`,
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
          <Wand2 size={15} className="text-purple" /> 오토튠 — {take.title}
        </span>
        <Button size="sm" className="ml-auto" onClick={onClose} aria-label="닫기"><X size={13} /></Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="text-xs text-muted">키</label>
        <Select value={keyIndex} onChange={(e) => setKeyIndex(Number(e.target.value))} disabled={busy}>
          {KEYS.map((k, i) => <option key={k} value={i}>{k}</option>)}
        </Select>
        <label className="text-xs text-muted">스케일</label>
        <Select value={scale} onChange={(e) => setScale(e.target.value)} disabled={busy}>
          {Object.keys(SCALES).map((s) => <option key={s} value={s}>{SCALE_LABELS[s] || s}</option>)}
        </Select>
      </div>

      <div className="mb-3">
        <div className="text-xs text-muted mb-1">
          보정 강도 <span className="font-mono text-text">{strength}%</span>
          <span className="text-faint ml-2">
            {strength >= 90 ? '— 딱 떨어지는 기계음(하드 튠)' : strength >= 40 ? '— 자연스러운 교정' : '— 살짝만 다듬기'}
          </span>
        </div>
        <input type="range" className="me-slider w-full" min={0} max={100} value={strength}
          onChange={(e) => setStrength(Number(e.target.value))} disabled={busy} />
      </div>

      {error && <div className="text-danger text-xs mb-2">{error}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary" onClick={apply} disabled={busy}>
          {busy ? '처리 중…' : '오토튠 적용'}
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
