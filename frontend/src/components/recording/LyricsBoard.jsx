import { useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { SECTION_COLORS } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

/**
 * The lyric sheet, laid out in arrangement order so you can sing the song
 * top to bottom while recording.
 *
 * While the backing track runs, the section currently playing is highlighted
 * and scrolled into view — the same currentStep the beatmaker's playhead uses,
 * mapped back to a section by walking cumulative section lengths. That turns a
 * static note into something you can actually follow at tempo.
 *
 * Editing stays available between takes but is locked during recording: the
 * take is already rolling, and reaching for the keyboard mid-verse only ever
 * produces a ruined take.
 */
export function LyricsBoard({ locked }) {
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const setLyricsFor = useGameStore((s) => s.setLyricsFor);

  const activeRef = useRef(null);

  const { arrangement, sections } = draft;
  const backingRunning = isPlaying && playingId === 'recording-backing' && currentStep >= 0;

  // Which arrangement slot the playhead is inside. Sections repeat, so this
  // is by position in the arrangement, not by section name.
  let activeIndex = -1;
  if (backingRunning) {
    let cursor = 0;
    for (let i = 0; i < arrangement.length; i++) {
      const len = sections[arrangement[i]]?.length ?? 0;
      if (currentStep < cursor + len) { activeIndex = i; break; }
      cursor += len;
    }
  }

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (arrangement.length === 0) {
    return (
      <Panel className="mb-5">
        <div className="font-bold text-sm flex items-center gap-2 mb-2">
          <FileText size={15} className="text-pink" /> 가사
        </div>
        <div className="text-xs text-muted">
          비트메이커에서 곡 구조(인트로·벌스·코러스…)를 먼저 만들면, 여기에 순서대로 가사를 적을 수 있어요.
        </div>
      </Panel>
    );
  }

  const hasAnyLyrics = arrangement.some((k) => sections[k]?.lyrics?.trim());
  // Counted the way scoring counts it: per arrangement slot, so a repeated
  // chorus contributes its words each time it plays.
  const wordCount = arrangement.reduce((n, k) => {
    const t = sections[k]?.lyrics?.trim();
    return n + (t ? t.split(/\s+/).length : 0);
  }, 0);

  return (
    <Panel className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        <FileText size={15} className="text-pink" />
        <span className="font-bold text-sm flex-1">가사</span>
        {backingRunning
          ? <span className="text-[10px] font-mono text-accent2">반주 따라가는 중</span>
          : wordCount > 0 && <span className="text-[10px] font-mono text-faint">{wordCount}단어</span>}
      </div>
      <div className="text-[11px] text-muted mb-3">
        {locked
          ? '녹음 중에는 수정할 수 없어요. 지금 부르는 구간이 밝게 표시됩니다.'
          : '곡 순서대로 적어보세요. 가사는 발매 시 완성도에 소폭 반영됩니다.'}
      </div>

      {!hasAnyLyrics && (
        <div className="text-xs text-faint mb-3">아직 가사가 없습니다. 아래에 적어보세요.</div>
      )}

      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto me-scroll pr-1">
        {arrangement.map((key, idx) => {
          const active = idx === activeIndex;
          const color = SECTION_COLORS[key];
          return (
            <div
              key={`${key}-${idx}`}
              ref={active ? activeRef : null}
              className="rounded-lg border transition-colors"
              style={{
                borderColor: active ? color : 'var(--color-border)',
                background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-2 px-3 pt-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[11px] font-semibold" style={{ color: active ? color : 'var(--color-muted)' }}>
                  {idx + 1}. {key}
                </span>
              </div>
              <div className="me-notebook m-2 mt-1.5" style={{ padding: '10px 10px 10px 32px' }}>
                <textarea
                  value={sections[key]?.lyrics || ''}
                  onChange={(e) => setLyricsFor(key, e.target.value)}
                  readOnly={locked}
                  placeholder={locked ? '' : `${key} 가사를 적어보세요...`}
                  style={{ minHeight: 84, fontSize: 16, lineHeight: '28px', opacity: active || activeIndex < 0 ? 1 : 0.5 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
