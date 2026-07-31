import { Square, Disc3 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useGameStore } from '../../state/useGameStore';

/**
 * Global "now playing" strip pinned to the bottom, like a video/music player —
 * shows what's playing and a progress bar of how far in you are. Sits above the
 * phone tab bar. Hidden on the beatmaker, which has its own transport playhead.
 */
export function NowPlayingBar() {
  const { pathname } = useLocation();
  const isPlaying = useGameStore((s) => s.isPlaying);
  const currentStep = useGameStore((s) => s.currentStep);
  const total = useGameStore((s) => s.playingTotal);
  const label = useGameStore((s) => s.playingLabel);
  const stop = useGameStore((s) => s.stop);
  const seek = useGameStore((s) => s.seek);

  if (!isPlaying || pathname === '/beatmaker' || total <= 0) return null;

  const done = Math.min(1, Math.max(0, (currentStep + 1) / total));
  const pct = Math.round(done * 100);

  // Click anywhere on the bar to jump there, like a video scrubber.
  function scrub(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    seek(Math.min(total - 1, Math.floor(ratio * total)));
  }

  return (
    <div className="me-nowplaying">
      <div className="me-nowplaying-inner">
        <Disc3 size={16} className="text-accent shrink-0 me-spin" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-text truncate">{label || '재생 중'}</span>
            <span className="me-mono text-[10px] text-faint shrink-0">{pct}%</span>
          </div>
          <div className="me-np-track" onClick={scrub} style={{ cursor: 'pointer' }} title="클릭해서 원하는 위치로 이동">
            <div className="me-np-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button className="me-btn-ghost !px-2.5 !py-1.5 shrink-0" onClick={stop} aria-label="정지" title="정지">
          <Square size={13} />
        </button>
      </div>
    </div>
  );
}
