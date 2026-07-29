import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Music2, SlidersHorizontal, Wand2, Mic, Rocket, Newspaper,
  Users, Building2, Smartphone, PartyPopper, X,
} from 'lucide-react';
import { useSettingsStore } from '../../state/useSettingsStore';

// The intro walkthrough. Content-based (not element-spotlight) so it works the
// same on every screen and never breaks when the layout moves. Auto-shows once
// for a new save; reopenable any time from the ? button or settings. Each step
// has a short intro (`body`) plus concrete how-to `tips`.
const STEPS = [
  {
    icon: Sparkles, color: '#E8A33D', title: '뮤직 엠파이어에 오신 걸 환영해요',
    body: '당신은 이제 막 데뷔한 뮤지션이에요. 곡을 만들어 발매하고, 팬·명성·자금을 키워 정상에 오르는 오픈형 음악 인생 시뮬레이션이에요.',
    tips: [
      '핵심 흐름: 스튜디오에서 곡 방향 정하기 → 비트메이커에서 완성 → (선택) 녹음실에서 보컬 → 발매!',
      '발매하면 점수·등급·수익·팬이 정해지고 게임 속 시간이 흘러요.',
      '정답은 없어요. 취향대로 자유롭게 만들면 됩니다.',
    ],
  },
  {
    icon: Music2, color: '#E8A33D', title: '① 스튜디오 — 곡의 방향 정하기',
    body: '곡의 뼈대가 되는 기본 정보를 정하는 곳이에요. 발매 후에는 바꿀 수 없으니 방향을 잡고 시작하세요.',
    tips: [
      '제목 · 장르(최대 2개) · 분위기(최대 2개) · BPM · 코드 진행을 선택.',
      '🎚 "장르 기본 세팅" 버튼: 고른 장르에 어울리는 BPM·분위기·코드를 한 번에 맞춰줘요.',
      '제작 모드 — 초보자(간단하게) / 전문가(자유도 높게).',
      '보컬 방식 — 직접 녹음 / AI 보컬 / NPC 가수 고용(자금 필요).',
    ],
  },
  {
    icon: SlidersHorizontal, color: '#4FD1C5', title: '② 비트메이커 — 화면 익히기',
    body: '실제로 소리를 찍어 곡을 완성하는 작업실이에요. 화면은 크게 세 부분으로 나뉘어요.',
    tips: [
      '왼쪽 채널 랙: 드럼·건반·기타·현악·관악·신스·보컬 등 악기를 골라요.',
      '가운데 그리드: 드럼은 칸을 눌러 켜고, 멜로디 악기는 피아노롤에 음을 찍어요.',
      '위쪽 타임라인: 인트로·벌스·코러스 같은 구간을 곡 구조로 배치해요.',
      '오른쪽 라이브러리: 프리셋 비트를 한 번에 깔 수 있어요.',
    ],
  },
  {
    icon: Wand2, color: '#4FD1C5', title: '② 비트메이커 — 표현력 살리기',
    body: '단순 반복을 넘어 곡에 생동감을 주는 기능들이에요. 익히면 곡의 완성도가 확 올라가요.',
    tips: [
      '구간마다 BPM·스윙(그루브)을 다르게 줄 수 있어요.',
      '드럼 칸을 우클릭 → 세기(볼륨)와 드럼 롤(빠른 연타)을 조절.',
      '"목소리로 찍기": 입으로 "둥 츠 둥" 리듬이나 멜로디를 흥얼거리면 자동으로 찍혀요.',
      '"내 목소리 악기": 한 음을 녹음하면 그 목소리로 멜로디를 연주할 수 있어요.',
      'HUMANIZE를 켜면 사람이 연주한 듯 미세하게 흔들려요.',
    ],
  },
  {
    icon: Mic, color: '#E893A6', title: '③ 녹음실 — 가사와 보컬',
    body: '곡에 목소리를 입히는 곳이에요. 보컬은 선택이지만 곡을 훨씬 풍성하게 만들어줘요.',
    tips: [
      '구간별로 가사를 쓰고, 마이크로 직접 부르거나 AI 보컬을 넣어요.',
      '구간마다 따로 녹음해 여러 겹으로 하모니를 쌓을 수 있어요.',
      '오토튠으로 음정을 다듬을 수 있어요.',
    ],
  },
  {
    icon: Rocket, color: '#8B7FD1', title: '④ 발매 — 점수·수익·팬',
    body: '곡이 준비되면 발매해요. 제목·장르·분위기·곡 구조가 있고 최소 6칸 이상 찍으면 발매할 수 있어요.',
    tips: [
      '점수는 완성도·독창성·대중성·실험성 4가지로 매겨져 종합 점수와 등급이 나와요.',
      '장르와 곡이 잘 어울릴수록(장르 적합도) 가산점이 붙어요.',
      '팬·명성이 많을수록 더 많은 사람에게 닿아 수익·팬이 늘어요. 지출도 있으니 밸런스가 중요해요.',
    ],
  },
  {
    icon: Newspaper, color: '#E8A33D', title: '시간 · 소식 · 이벤트',
    body: '곡을 내거나 훈련하는 등 행동을 하면 게임 속 날짜가 흘러가요. 그에 따라 세상도 움직여요.',
    tips: [
      '소식 탭(또는 폰 뉴스): 라이벌 신곡·차트 변동·업계 뉴스를 확인.',
      '선택형 이벤트: 광고·피처링·투자 제안 등, 선택에 따라 돈·팬·명성이 변해요.',
      '연말에는 신인상·올해의 곡·올해의 음반·대상 시상식이 열려요.',
    ],
  },
  {
    icon: Users, color: '#4FD1C5', title: '커뮤니티 · 차트',
    body: '내가 만든 세계의 다른 아티스트들과 함께 어울리는 공간이에요.',
    tips: [
      '차트에서 내 순위를 확인하고 곡을 미리 들어볼 수 있어요.',
      '아티스트를 검색·팔로우하고, 프로필에서 능력치와 활동을 볼 수 있어요.',
    ],
  },
  {
    icon: Building2, color: '#E8A33D', title: '회사 · 협업 · 온라인',
    body: '혼자를 넘어 규모를 키우는 방법들이에요.',
    tips: [
      '회사를 세우고 연습생·그룹을 키워 수익을 확장해요.',
      '다른 아티스트와 협업해 함께 곡을 만들 수 있어요.',
      '온라인에서는 같은 세계의 다른 유저들과 시간을 공유하며 경쟁해요.',
    ],
  },
  {
    icon: Smartphone, color: '#E893A6', title: '📱 인게임 폰',
    body: '오른쪽 아래 폰 버튼을 누르면 어디서든 열리는 스마트폰이에요. 여러 앱이 들어 있어요.',
    tips: [
      '뮤즈그램(SNS): 사진·근황을 올리고 좋아요·댓글을 주고받아요. 곡을 홍보하면 조회수·팬이 올라요.',
      '메시지(DM): 소속사 매니저·라이벌과 대화해요. 안 읽은 메시지는 폰 버튼에 배지로 표시돼요.',
      '뉴스·차트 앱도 폰 안에서 바로 볼 수 있어요.',
    ],
  },
  {
    icon: PartyPopper, color: '#E893A6', title: '이제 시작해볼까요?',
    body: '기본은 다 익혔어요! 막히면 언제든 다시 열어볼 수 있으니 편하게 만들어보세요.',
    tips: [
      '오른쪽 위 ? 버튼: 이 가이드를 다시 볼 수 있어요.',
      '⚙ 버튼: 음량·효과음·화면 전환 애니메이션을 설정해요.',
      '자, 첫 곡을 만들러 가봐요! 🎶',
    ],
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
        className="me-panel w-full max-w-[460px] relative flex flex-col"
        style={{ padding: 24, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={finish}
          aria-label="가이드 닫기"
          className="absolute top-3 right-3 text-faint hover:text-text cursor-pointer bg-transparent border-0 z-10"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center mb-4 shrink-0">
          <div className="rounded-2xl flex items-center justify-center"
            style={{ width: 56, height: 56, background: `${s.color}1f`, border: `1px solid ${s.color}55` }}>
            <Icon size={28} style={{ color: s.color }} />
          </div>
        </div>

        <div className="me-display text-center font-extrabold text-lg mb-2 shrink-0">{s.title}</div>

        {/* scrollable content so long steps never overflow the card */}
        <div className="overflow-y-auto me-scroll flex-1 min-h-0 mb-4" style={{ minHeight: 150 }}>
          <div className="text-[13px] text-muted leading-relaxed text-center mb-3">{s.body}</div>
          {s.tips && (
            <ul className="flex flex-col gap-2 px-1">
              {s.tips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-text/90 leading-relaxed">
                  <span className="shrink-0 mt-[6px] rounded-full" style={{ width: 5, height: 5, background: s.color }} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* progress dots */}
        <div className="flex justify-center gap-1.5 mb-4 shrink-0 flex-wrap">
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

        <div className="flex items-center justify-between gap-3 shrink-0">
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
