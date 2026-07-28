import { motion } from 'framer-motion';
import { Settings, Volume2, VolumeX, X, BookOpen } from 'lucide-react';
import { useSettingsStore } from '../../state/useSettingsStore';

// A labelled on/off switch styled to match the app's pill/toggle look.
function Toggle({ on, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <div className="text-[13px] text-text">{label}</div>
        {hint && <div className="text-[10px] text-faint mt-0.5">{hint}</div>}
      </div>
      <button
        role="switch" aria-checked={on} aria-label={label}
        onClick={() => onChange(!on)}
        className="relative shrink-0 cursor-pointer border-0 rounded-full transition-colors"
        style={{ width: 42, height: 24, background: on ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)' }}
      >
        <span className="absolute top-0.5 rounded-full transition-all"
          style={{ width: 20, height: 20, background: '#12101A', left: on ? 20 : 2 }} />
      </button>
    </div>
  );
}

export function SettingsModal() {
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const uiSounds = useSettingsStore((s) => s.uiSounds);
  const setUiSounds = useSettingsStore((s) => s.setUiSounds);
  const animations = useSettingsStore((s) => s.animations);
  const setAnimations = useSettingsStore((s) => s.setAnimations);
  const openGuide = useSettingsStore((s) => s.openGuide);

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,8,16,0.72)', backdropFilter: 'blur(3px)' }}
      onClick={closeSettings}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="me-panel w-full max-w-[420px] relative"
        style={{ padding: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeSettings}
          aria-label="설정 닫기"
          className="absolute top-3 right-3 text-faint hover:text-text cursor-pointer bg-transparent border-0"
        >
          <X size={16} />
        </button>

        <div className="me-display font-extrabold text-lg mb-4 flex items-center gap-2">
          <Settings size={18} style={{ color: '#E8A33D' }} /> 설정
        </div>

        {/* master volume */}
        <div className="py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] text-text flex items-center gap-1.5">
              {masterVolume === 0 ? <VolumeX size={14} className="text-faint" /> : <Volume2 size={14} style={{ color: '#4FD1C5' }} />}
              마스터 음량
            </div>
            <span className="me-mono text-[11px] text-faint">{masterVolume}%</span>
          </div>
          <input
            type="range" className="me-slider w-full" min={0} max={100} value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))} aria-label="마스터 음량"
          />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="my-1" />

        <Toggle on={uiSounds} onChange={setUiSounds}
          label="UI 효과음" hint="비트를 찍거나 발매할 때 나는 짧은 효과음" />
        <Toggle on={animations} onChange={setAnimations}
          label="화면 전환 애니메이션" hint="끄면 화면이 즉시 바뀝니다 (모션 최소화)" />

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="my-2" />

        <button
          className="me-btn-ghost w-full justify-center inline-flex items-center gap-2"
          onClick={() => { closeSettings(); openGuide(); }}
        >
          <BookOpen size={14} /> 게임 가이드 다시 보기
        </button>

        <div className="text-[10px] text-faint text-center mt-3">
          설정은 이 브라우저에만 저장됩니다.
        </div>
      </motion.div>
    </div>
  );
}
