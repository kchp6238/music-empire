import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Music2, SlidersHorizontal, Mic, Rocket, Users, Building2, PartyPopper, X,
} from 'lucide-react';
import { useSettingsStore } from '../../state/useSettingsStore';

// The intro walkthrough. Content-based (not element-spotlight) so it works the
// same on every screen and never breaks when the layout moves. Auto-shows once
// for a new save; reopenable any time from the ? button or settings.
const STEPS = [
  {
    icon: Sparkles, color: '#E8A33D', title: '뮤직 엠파이어에 오신 걸 환영해요',
    body: '당신은 이제 막 데뷔한 뮤지션이에요. 곡을 만들어 발매하고, 팬과 명성·자금을 키워 최고의 자리에 오르는 것이 목표예요. 정답은 없어요 — 자유롭게 만들어보세요.',
  },
  {
    icon: Music2, color: '#E8A33D', title: '① 스튜디오 — 곡의 방향 정하기',
    body: '제목, 장르(최대 2개), 분위기, BPM, 코드 진행, 보컬 방식을 정해요. 장르를 고르면 "기본 세팅"으로 어울리는 값을 한 번에 맞출 수 있어요. 장르와 곡의 완성도가 점수에 영향을 줍니다.',
  },
  {
    icon: SlidersHorizontal, color: '#4FD1C5', title: '② 비트메이커 — 비트 찍기',
    body: '드럼과 여러 악기로 비트를 찍어요. 구간(인트로·벌스…)마다 BPM과 스윙을 다르게 줄 수 있고, 드럼 칸을 우클릭하면 세기와 드럼 롤도 조절돼요. 내 목소리를 녹음해 악기로 연주할 수도 있어요.',
  },
  {
    icon: Mic, color: '#E893A6', title: '③ 녹음실 — 가사와 보컬',
    body: '가사를 쓰고 직접 노래를 녹음하거나, AI 보컬을 넣을 수 있어요. 구간별로 따로 녹음해 하모니까지 쌓을 수 있어요. 보컬은 선택이지만 곡을 훨씬 풍성하게 만들어줍니다.',
  },
  {
    icon: Rocket, color: '#8B7FD1', title: '④ 발매 — 점수·수익·팬',
    body: '완성한 곡을 발매하면 점수와 등급, 수익, 늘어난 팬 수가 정해져요. 발매하면 게임 속 시간이 흐르고, 소식·차트가 갱신되며 가끔 선택형 이벤트가 찾아옵니다.',
  },
  {
    icon: Users, color: '#4FD1C5', title: '커뮤니티 · 소식 · 시상식',
    body: '차트에서 내 순위를, 소식 탭에서 라이벌들의 활동과 업계 뉴스를 확인해요. 연말에는 신인상·올해의 곡·대상 같은 시상식도 열려요. 마음에 드는 아티스트는 팔로우할 수 있어요.',
  },
  {
    icon: Building2, color: '#E8A33D', title: '회사 · 협업 · 온라인',
    body: '회사를 세워 수익을 키우고, 다른 아티스트와 협업해 함께 곡을 만들 수 있어요. 온라인에서는 같은 세계의 다른 유저들과 시간을 공유하며 경쟁합니다.',
  },
  {
    icon: PartyPopper, color: '#E893A6', title: '이제 시작해볼까요?',
    body: '언제든 오른쪽 위 ? 버튼으로 이 가이드를, ⚙ 버튼으로 설정(음량·효과음·애니메이션)을 열 수 있어요. 첫 곡을 만들러 가봐요!',
  },
];

export function GuideOverlay() {
  const guideOpen = useSettingsStore((s) => s.guideOpen);
  const closeGuide = useSettingsStore((s) => s.closeGuide);
  const [step, setStep] = useState(0);

  if (!guideOpen) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;
  const finish = () => { setStep(0); closeGuide(); };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,8,16,0.72)', backdropFilter: 'blur(3px)' }}
      onClick={finish}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="me-panel w-full max-w-[460px] relative"
        style={{ padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={finish}
          aria-label="가이드 닫기"
          className="absolute top-3 right-3 text-faint hover:text-text cursor-pointer bg-transparent border-0"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center mb-4">
          <div className="rounded-2xl flex items-center justify-center"
            style={{ width: 56, height: 56, background: `${s.color}1f`, border: `1px solid ${s.color}55` }}>
            <Icon size={28} style={{ color: s.color }} />
          </div>
        </div>

        <div className="me-display text-center font-extrabold text-lg mb-2">{s.title}</div>
        <div className="text-[13px] text-muted leading-relaxed text-center mb-5" style={{ minHeight: 88 }}>
          {s.body}
        </div>

        {/* progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`${i + 1}단계로`}
              className="rounded-full cursor-pointer border-0 transition-all"
              style={{
                width: i === step ? 20 : 7, height: 7,
                background: i === step ? s.color : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-[12px] text-faint hover:text-muted cursor-pointer bg-transparent border-0 px-1"
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button className="me-btn-ghost" onClick={() => setStep((v) => v - 1)}>이전</button>
            )}
            {isLast ? (
              <button className="me-btn-primary" onClick={finish}>시작하기</button>
            ) : (
              <button className="me-btn-primary" onClick={() => setStep((v) => v + 1)}>
                다음 <span className="opacity-70">({step + 1}/{STEPS.length})</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
