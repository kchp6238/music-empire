import { useState } from 'react';
import { Disc3, Plus, X, Star } from 'lucide-react';
import { useGameStore } from '../../state/useGameStore';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { compactNum } from '../../lib/utils';

const KIND_LABEL = { ep: 'EP', lp: '정규' };

// Bundle released songs into an album/EP. Lives in the studio's right rail under
// the release history; picking 2+ released songs + a title track creates an
// album, which grants a one-shot fame/money/fans bonus (applied server-side).
export function AlbumsPanel() {
  const albums = useGameStore((s) => s.albums);
  const songs = useGameStore((s) => s.character?.songs || []);
  const createAlbum = useGameStore((s) => s.createAlbum);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState([]); // song ids, in pick order
  const [titleId, setTitleId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function reset() {
    setTitle(''); setPicked([]); setTitleId(null); setError(''); setResult(null); setBusy(false);
  }
  function close() { setOpen(false); reset(); }

  function toggle(id) {
    setPicked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(titleId)) setTitleId(next[0] ?? null);
      return next;
    });
  }

  async function submit() {
    setError('');
    if (!title.trim()) { setError('앨범 제목을 입력하세요'); return; }
    if (picked.length < 2) { setError('발매한 곡을 2개 이상 선택하세요'); return; }
    setBusy(true);
    try {
      const album = await createAlbum({ title: title.trim(), song_ids: picked, title_song_id: titleId || picked[0] });
      setResult(album);
    } catch (e) {
      setError(e.message || '앨범 발매에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="me-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Disc3 size={15} style={{ color: 'var(--sk-accent)' }} /> 앨범
        </div>
        <button
          className="me-btn-ghost" style={{ padding: '3px 9px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          onClick={() => { reset(); setOpen(true); }} disabled={songs.length < 2}
          title={songs.length < 2 ? '발매한 곡이 2개 이상 필요합니다' : '발매곡을 묶어 앨범 발매'}
        >
          <Plus size={12} /> 새 앨범
        </button>
      </div>

      {albums.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--color-faint)' }}>
          {songs.length < 2 ? '곡을 2개 이상 발매하면 앨범을 만들 수 있어요.' : '발매곡을 묶어 첫 앨범을 내보세요.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {albums.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,var(--sk-panel-a),var(--sk-panel-b))', border: '1px solid var(--sk-panel-brd)' }}>
                <Disc3 size={15} style={{ color: 'var(--sk-accent)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: 'var(--color-faint)' }}>{KIND_LABEL[a.kind] || a.kind} · {a.track_count}곡 · ▷ {compactNum(a.total_streams)}</div>
              </div>
              <span className="me-mono" style={{ color: TIER_COLOR[a.tier] || 'var(--color-muted)', fontSize: 11 }}>{a.tier} · {a.avg_score}</span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="me-modal-backdrop" onClick={close}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="me-display" style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Disc3 size={17} style={{ color: 'var(--sk-accent)' }} /> {result ? '앨범 발매 완료' : '새 앨범 발매'}
              </div>
              <button onClick={close} aria-label="닫기" className="me-btn-ghost" style={{ padding: 4 }}><X size={15} /></button>
            </div>

            {result ? (
              <div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  <b>{result.title}</b> — {KIND_LABEL[result.kind] || result.kind} · {result.track_count}곡 ·{' '}
                  <span style={{ color: TIER_COLOR[result.tier] }}>{result.tier} {result.avg_score}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <Stat label="명성" value={`+${result.fame_delta}`} color="var(--sk-accent)" />
                  <Stat label="팬" value={`+${compactNum(result.fans_delta)}`} color="#4FD1C5" />
                  <Stat label="수익" value={`+₩${compactNum(result.money_delta)}`} color="#5FBF8F" />
                </div>
                <button className="me-btn-primary w-full justify-center" onClick={close}>확인</button>
              </div>
            ) : (
              <div>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)} placeholder="앨범 제목"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-strong)', background: 'var(--sk-panel-b)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                />
                <div style={{ fontSize: 11, color: 'var(--color-muted)', margin: '8px 2px 6px' }}>
                  수록곡 선택 ({picked.length}) · ⭐ = 타이틀곡
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }} className="me-scroll">
                  {songs.map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <div key={s.id}
                        onClick={() => toggle(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${on ? 'var(--sk-accent)' : 'var(--color-border)'}`, background: on ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                      >
                        <span style={{ width: 16, height: 16, borderRadius: 4, flex: 'none', border: `1px solid ${on ? 'var(--sk-accent)' : 'var(--color-border-strong)'}`, background: on ? 'var(--sk-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--sk-pill-ink)' }}>{on ? '✓' : ''}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{s.title}</span>
                        <span className="me-mono" style={{ fontSize: 10, color: TIER_COLOR[s.tier] || 'var(--color-faint)' }}>{s.tier}</span>
                        {on && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setTitleId(s.id); }}
                            aria-label="타이틀곡으로"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: titleId === s.id ? 'var(--sk-accent)' : 'var(--color-faint)' }}
                          >
                            <Star size={14} fill={titleId === s.id ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {error && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}

                <div style={{ fontSize: 10, color: 'var(--color-faint)', margin: '10px 2px 12px' }}>
                  2~3곡은 EP, 4곡 이상은 정규 앨범이에요. 평균 점수가 앨범 등급이 됩니다.
                </div>
                <button className="me-btn-primary w-full justify-center" onClick={submit} disabled={busy || !title.trim() || picked.length < 2}>
                  {busy ? '발매 중…' : `앨범 발매 (${picked.length}곡)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 10, color: 'var(--color-faint)' }}>{label}</div>
      <div className="me-mono" style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
