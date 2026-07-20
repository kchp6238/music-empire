import { Play, Square, Wand2 } from 'lucide-react';
import { buildCombinedPattern } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

/**
 * Bottom transport strip — global play/stop for the whole arrangement, tempo,
 * and the bar/beat readout, in the place a DAW puts them.
 */
export function TransportBar() {
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const setDraftField = useGameStore((s) => s.setDraftField);
  const fx = useGameStore((s) => s.fx);
  const setFx = useGameStore((s) => s.setFx);

  const playingFull = isPlaying && playingId === 'draft-full';
  const step = isPlaying && currentStep >= 0 ? currentStep : 0;
  // 16 steps to the bar, 4 to the beat — the grid the sequencer runs on.
  const bar = Math.floor(step / 16) + 1;
  const beat = Math.floor((step % 16) / 4) + 1;
  const tick = (step % 4) + 1;
  const canPlay = draft.arrangement.length > 0;

  return (
    <div className="me-daw border-t border-border flex items-center gap-5 px-5 py-2.5 sticky bottom-0 z-40">
      <button
        className="w-9 h-9 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0"
        style={{ background: playingFull ? 'var(--color-danger)' : 'var(--color-accent)', opacity: canPlay ? 1 : 0.35 }}
        disabled={!canPlay}
        title={canPlay ? (playingFull ? '정지' : '전체 곡 재생') : '곡 구조에 섹션을 추가하세요'}
        aria-label={playingFull ? '정지' : '전체 곡 재생'}
        onClick={() => (playingFull ? stop() : play(buildCombinedPattern(draft.sections, draft.arrangement), draft.bpm, 'draft-full'))}
      >
        {playingFull ? <Square size={14} color="#12101A" /> : <Play size={15} color="#12101A" fill="#12101A" />}
      </button>

      <div className="font-mono text-lg text-accent2 tabular-nums tracking-tight">
        {String(bar).padStart(2, '0')}.{beat}.{tick}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase text-faint">BPM</span>
        <input
          type="number" min={60} max={180} value={draft.bpm}
          onChange={(e) => setDraftField('bpm', Math.max(60, Math.min(180, Number(e.target.value) || 100)))}
          className="w-14 font-mono text-sm text-text px-1.5 py-1 rounded outline-none border border-border"
          style={{ background: 'var(--color-groove)' }}
          aria-label="BPM"
        />
      </div>

      <div className="font-mono text-[11px] text-faint">4 / 4</div>

      <button
        className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer text-[10px] font-mono"
        style={{
          borderColor: fx.humanize ? 'var(--color-purple)' : 'rgba(255,255,255,0.15)',
          color: fx.humanize ? 'var(--color-purple)' : 'var(--color-faint)',
          background: 'transparent',
        }}
        onClick={() => setFx('humanize', !fx.humanize)}
        title="타이밍과 세기를 미세하게 흔들어 사람이 연주한 느낌을 냅니다"
      >
        <Wand2 size={11} /> HUMANIZE
      </button>
    </div>
  );
}
