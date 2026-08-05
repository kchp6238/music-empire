import { useState } from 'react';
import { Clapperboard, X } from 'lucide-react';
import { useGameStore } from '../../state/useGameStore';
import { won, compactNum } from '../../lib/utils';

const MV_TIERS = [
  { key: 'lowbudget', label: '저예산 MV', cost: 1_000_000, desc: '가볍게 화제몰이' },
  { key: 'standard', label: '일반 MV', cost: 5_000_000, desc: '표준 뮤직비디오' },
  { key: 'blockbuster', label: '블록버스터 MV', cost: 20_000_000, desc: '대형 제작 · 최대 화력' },
];

// A per-song "MV" control in the release history. If the song already has a
// video it shows a small badge; otherwise it opens a budget picker that
// produces the MV (boosting views/fame/fans).
export function MusicVideoButton({ song }) {
  const makeMusicVideo = useGameStore((s) => s.makeMusicVideo);
  const money = useGameStore((s) => s.character?.money ?? 0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (song.mvTier) {
    return <span title="뮤직비디오 제작 완료" style={{ fontSize: 10, color: '#B794F4', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Clapperboard size={11} /> MV</span>;
  }

  async function make(tier) {
    setError(''); setBusy(true);
    try {
      setResult(await makeMusicVideo(song.id, tier));
    } catch (e) {
      setError(e.message || 'MV 제작에 실패했습니다');
    } finally { setBusy(false); }
  }
  function close() { setOpen(false); setError(''); setResult(null); }

  return (
    <>
      <button
        className="me-btn-ghost" style={{ padding: '2px 7px', fontSize: 10, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}
        onClick={() => setOpen(true)} title="뮤직비디오 제작"
      >
        <Clapperboard size={11} /> MV
      </button>

      {open && (
        <div className="me-modal-backdrop" onClick={close}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360, position: 'relative' }}>
            <button onClick={close} aria-label="닫기" className="me-btn-ghost" style={{ position: 'absolute', top: 10, right: 10, padding: 4 }}><X size={15} /></button>

            {result ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34 }}>🎬</div>
                <div className="me-display" style={{ fontSize: 17, fontWeight: 800 }}>{result.label} 공개!</div>
                <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 14 }}>{result.song_title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <Cell label="조회수" value={`+${compactNum(result.views_boost)}`} color="#4FD1C5" />
                  <Cell label="광고 수익" value={`+${won(result.ad_revenue)}`} color="#5FBF8F" />
                  <Cell label="명성" value={`+${result.fame_gain}`} color="var(--sk-accent)" />
                  <Cell label="팬" value={`+${compactNum(result.fans_gain)}`} color="#E893A6" />
                </div>
                <button className="me-btn-primary w-full justify-center" onClick={close}>확인</button>
              </div>
            ) : (
              <>
                <div className="me-display" style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>뮤직비디오 제작</div>
                <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 14 }}>{song.title} — 예산이 클수록 화제·조회수가 커져요.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {MV_TIERS.map((t) => {
                    const afford = money >= t.cost;
                    return (
                      <button key={t.key} className="me-card" disabled={busy || !afford}
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: afford ? 1 : 0.45, cursor: afford && !busy ? 'pointer' : 'not-allowed' }}
                        onClick={() => afford && make(t.key)}>
                        <span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</span>
                          <span style={{ display: 'block', fontSize: 11, color: '#8B8496' }}>{t.desc}</span>
                        </span>
                        <span className="me-mono" style={{ fontSize: 12, color: afford ? 'var(--sk-accent)' : '#C4576B' }}>{won(t.cost)}</span>
                      </button>
                    );
                  })}
                </div>
                {error && <div style={{ color: '#C4576B', fontSize: 12, marginTop: 10 }}>{error}</div>}
                {busy && <div style={{ fontSize: 12, color: '#8B8496', marginTop: 10, textAlign: 'center' }}>제작 중…</div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Cell({ label, value, color }) {
  return (
    <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '9px 6px', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 10, color: '#6B6577' }}>{label}</div>
      <div className="me-mono" style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
