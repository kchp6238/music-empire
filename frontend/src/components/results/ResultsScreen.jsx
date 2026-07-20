import { useNavigate } from 'react-router-dom';
import { Heart, Smile, Meh, Frown, Flame, Star, Users, RotateCcw } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { Fader } from '../shared/Fader';
import { TIER_COLOR, pickLine, tierKeyFromScore } from '../../lib/gameData/constants';
import { CoverThumb } from '../cover/CoverThumb';
import { won } from '../../lib/utils';
import { useGameStore } from '../../state/useGameStore';

const TIER_ICON = { love: Heart, good: Smile, meh: Meh, bad: Frown, awful: Frown };
const TIER_NAME_BY_KEY = { love: '대박', good: '성공', meh: '무난', bad: '부진', awful: '참패' };

const REVENUE_LABELS = {
  streaming: '스트리밍', performance: '공연', ad: '광고',
  fanclub: '팬클럽', album: '앨범 판매', license: '라이선스',
};

export function ResultsScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const lastResult = useGameStore((s) => s.lastResult);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const nextSong = useGameStore((s) => s.nextSong);

  if (!character || !lastResult) return null;

  function handleNextSong() {
    nextSong();
    navigate('/studio');
  }

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <CoverThumb songId={lastResult.songId} title={lastResult.songTitle} size={132} rounded={14} />
          </div>
          <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>"{lastResult.songTitle}" 발매 결과</div>
          <div className="me-display" style={{ fontSize: 56, fontWeight: 800, color: TIER_COLOR[lastResult.tier] }}>{Math.round(lastResult.overallScore)}</div>
          <div className="me-display" style={{ fontSize: 22, fontWeight: 700, color: TIER_COLOR[lastResult.tier] }}>{lastResult.tier}</div>
          <button
            className="me-btn-ghost" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => (isPlaying && playingId === lastResult.songId) ? stop() : play(lastResult.pattern, lastResult.bpm, lastResult.songId)}
          >
            {(isPlaying && playingId === lastResult.songId) ? '■ 정지' : '▶ 다시 듣기'}
          </button>
          {lastResult.sleeperHit && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#4FD1C5', fontSize: 13 }}>
              <Flame size={15} /> 역주행! 저노출에도 입소문으로 재조명받았다
            </div>
          )}
          {lastResult.geniusEvent && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#E8A33D', fontSize: 13 }}>
              <Star size={15} /> 영감의 순간 — 독창적인 시도가 터졌다
            </div>
          )}
        </div>

        <div className="me-panel" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>반응 믹서 콘솔</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
            <Fader label="도달률" value={lastResult.breakdown.reachRatio} color="#8B7FD1" />
            <Fader label="완청률" value={lastResult.breakdown.completionRate * 100} color="#4FD1C5" />
            <Fader label="반복재생" value={lastResult.breakdown.repeatPlayRate * 100} color="#E8A33D" />
            <Fader label="저장율" value={lastResult.breakdown.saveRate * 100} color="#E893A6" />
            <Fader label="공유율" value={lastResult.breakdown.shareRate * 100} color="#5FBF8F" />
            <Fader label="팬 매칭도" value={lastResult.breakdown.fanAffinityMatch} color="#C4576B" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>완성도</div>
            <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.craft)}</div>
          </div>
          <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>독창성</div>
            <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.originality)}</div>
          </div>
          <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>대중성</div>
            <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.accessibility)}</div>
          </div>
          <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>실험성</div>
            <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.experimental)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 24 }} className="me-mono">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>팬 변화</div>
            <div style={{ fontSize: 16, color: lastResult.fansDelta >= 0 ? '#4FD1C5' : '#C4576B' }}>{lastResult.fansDelta >= 0 ? '+' : ''}{lastResult.fansDelta}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>자금 변화</div>
            <div style={{ fontSize: 16, color: lastResult.moneyDelta >= 0 ? '#4FD1C5' : '#C4576B' }}>{lastResult.moneyDelta >= 0 ? '+' : ''}{won(lastResult.moneyDelta)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#8B8496' }}>명성 변화</div>
            <div style={{ fontSize: 16, color: lastResult.fameDelta >= 0 ? '#4FD1C5' : '#C4576B' }}>{lastResult.fameDelta >= 0 ? '+' : ''}{lastResult.fameDelta}</div>
          </div>
        </div>

        {lastResult.newlyUnlocked && lastResult.newlyUnlocked.length > 0 && (
          <div className="me-panel" style={{ marginBottom: 20, borderColor: '#E8A33D', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Star size={16} style={{ color: '#E8A33D' }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>업적 달성!</span>
            {lastResult.newlyUnlocked.map((a) => (
              <span key={a.id} className="me-mono" style={{ fontSize: 12, color: '#E8A33D', border: '1px solid #E8A33D', borderRadius: 999, padding: '3px 10px' }}>{a.name}</span>
            ))}
          </div>
        )}

        {lastResult.revenueBreakdown && (
          <div className="me-panel" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>수익 내역</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Object.keys(REVENUE_LABELS).map((k) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                  <span style={{ color: '#8B8496' }}>{REVENUE_LABELS[k]}</span>
                  <span className="me-mono" style={{ color: '#4FD1C5' }}>+{won(lastResult.revenueBreakdown[k] || 0)}</span>
                </div>
              ))}
            </div>
            {lastResult.revenueBreakdown.expenses > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#8B8496' }}>지출 (제작·보컬)</span>
                <span className="me-mono" style={{ color: '#C4576B' }}>−{won(lastResult.revenueBreakdown.expenses)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <span>합계</span>
              <span className="me-mono" style={{ color: lastResult.revenueBreakdown.net >= 0 ? '#4FD1C5' : '#C4576B' }}>
                {lastResult.revenueBreakdown.net >= 0 ? '+' : ''}{won(lastResult.revenueBreakdown.net)}
              </span>
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} style={{ color: '#8B7FD1' }} /> 팬 반응</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {lastResult.personaResults.map((r) => {
            const key = r.reached ? tierKeyFromScore(r.reactionScore) : null;
            const Icon = key ? TIER_ICON[key] : Meh;
            return (
              <div key={r.persona.id} className="me-panel" style={{ padding: 12, opacity: r.reached ? 1 : 0.45 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.persona.color }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.persona.name}</div>
                  <Icon size={14} style={{ marginLeft: 'auto', color: key ? TIER_COLOR[TIER_NAME_BY_KEY[key]] : '#8B8496' }} />
                </div>
                <div style={{ fontSize: 11, color: '#B8B2C4', lineHeight: 1.4 }}>
                  {r.reached ? pickLine(key) : '아직 이 곡을 발견하지 못했다'}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <button className="me-btn-primary" onClick={handleNextSong} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={16} /> 다음 곡 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
