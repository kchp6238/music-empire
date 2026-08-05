import { useEffect, useState } from 'react';
import { Radio, Trophy, Heart, Pencil, X, Check } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { SceneHero } from '../shared/SceneHero';
import { useGameStore } from '../../state/useGameStore';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { compactNum } from '../../lib/utils';
import * as musicApi from '../../lib/api/music';
import { GlobalChart } from './GlobalChart';
import { RhythmGame } from './RhythmGame';

const RANK_STYLE = {
  1: { label: '🏆 1위', color: '#F5C46B' },
  2: { label: '2위', color: '#CBD3DE' },
  3: { label: '3위', color: '#D8A46B' },
};
function rankBadge(r, isWin) {
  if (isWin || r === 1) return RANK_STYLE[1];
  if (RANK_STYLE[r]) return RANK_STYLE[r];
  if (r) return { label: `${r}위`, color: '#8B8496' };
  return { label: '순위권 밖', color: '#6B6577' };
}

export function MusicScreen() {
  const character = useGameStore((s) => s.character);
  const loadCharacter = useGameStore((s) => s.loadCharacter);

  const [status, setStatus] = useState(null);
  const [songId, setSongId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [stage, setStage] = useState(null); // null | 'choice' | 'rhythm'
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [fanBusy, setFanBusy] = useState(false);
  const [fanResult, setFanResult] = useState(null);

  async function doRest() {
    setFanBusy(true); setError('');
    try {
      await musicApi.rest();
      await refresh();
      await loadCharacter();
    } catch (e) {
      setError(e.message || '휴식에 실패했어요');
    } finally { setFanBusy(false); }
  }

  async function doWorldTour() {
    setFanBusy(true); setError('');
    try {
      const res = await musicApi.worldTour();
      setFanResult({ kind: 'tour', label: '월드투어', earnings: res.earnings, fans_gain: res.fans_gain, fame_gain: res.fame_gain });
      await refresh();
      await loadCharacter();
    } catch (e) {
      setError(e.message || '해외 진출에 실패했어요');
    } finally { setFanBusy(false); }
  }

  async function doFanEvent(kind) {
    setFanBusy(true); setError('');
    try {
      const res = await musicApi.fanEvent(kind);
      setFanResult(res);
      await refresh();
      await loadCharacter();
    } catch (e) {
      setError(e.message || '팬 이벤트에 실패했습니다');
    } finally { setFanBusy(false); }
  }

  async function refresh() {
    try { setStatus(await musicApi.getMusicStatus()); } catch { /* ignore */ }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (status?.eligible_songs?.length && !songId) setSongId(status.eligible_songs[0].id);
  }, [status]);

  if (!character) return null;

  async function saveName() {
    const name = nameDraft.trim();
    if (!name) { setEditingName(false); return; }
    try {
      const fandom = await musicApi.setFandomName(name);
      setStatus((s) => ({ ...s, fandom }));
      setEditingName(false);
    } catch (e) { setError(e.message || '이름 저장 실패'); }
  }

  async function runPromote(performance = null) {
    setStage(null);
    if (!songId) return;
    setError(''); setBusy(true);
    try {
      const res = await musicApi.promoteSong(songId, performance);
      setResult({ ...res, performance });
      await refresh();
      await loadCharacter(); // reflect fame/fans/money on the top bar
    } catch (e) {
      setError(e.message || '음악방송 활동에 실패했습니다');
    } finally { setBusy(false); }
  }

  const fandom = status?.fandom;
  const fans = fandom?.fans_count ?? character.fans_count ?? 0;
  const nextAt = fandom?.next_at;
  const prevAt = 0;
  const pct = nextAt ? Math.min(100, Math.round(((fans - prevAt) / (nextAt - prevAt)) * 100)) : 100;
  const canPromote = status?.can_promote;
  const eligible = status?.eligible_songs || [];
  const results = status?.results || [];

  return (
    <div>
      <TopBar character={character} />
      <div className="max-w-[1080px] mx-auto px-4 md:px-6 pt-5">
        <SceneHero scene="stage" title="음악방송 & 팬덤" subtitle="곡을 음방에 올려 1위에 도전하고, 팬덤을 키우세요." />
      </div>

      <div className="max-w-[1080px] mx-auto px-4 md:px-6 pb-24 grid grid-cols-1 gap-5 md:[grid-template-columns:1fr_320px]">
        {/* left: music-show activity + global chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="me-panel">
          <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={18} style={{ color: 'var(--sk-accent)' }} /> 음악방송 활동
          </div>
          <div style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 16 }}>
            주 1회, 발매곡 하나를 음방에 올릴 수 있어요. 곡 완성도·명성·최근 발매일·팬 수가 순위를 좌우해요.
          </div>

          {eligible.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-faint)' }}>먼저 곡을 발매하세요. 발매곡이 있어야 음방에 출연할 수 있어요.</div>
          ) : !canPromote ? (
            <div className="me-card" style={{ cursor: 'default', textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📺</div>
              <div style={{ fontWeight: 700 }}>이번 주 음악방송 활동 완료</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>다음 주(하루 진행)에 다시 도전할 수 있어요.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>출연할 곡</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }} className="me-scroll">
                {eligible.map((s) => {
                  const on = songId === s.id;
                  const fresh = s.weeks_since_release <= 8;
                  return (
                    <div key={s.id} onClick={() => setSongId(s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--sk-accent)' : 'var(--color-border)'}`, background: on ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', flex: 'none', border: `2px solid ${on ? 'var(--sk-accent)' : 'var(--color-border-strong)'}`, background: on ? 'var(--sk-accent)' : 'transparent' }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{s.title}</span>
                      {fresh && <span style={{ fontSize: 10, color: '#5FBF8F', background: 'rgba(95,191,143,0.12)', padding: '2px 6px', borderRadius: 5 }}>신곡</span>}
                      <span className="me-mono" style={{ fontSize: 10, color: TIER_COLOR[s.tier] || 'var(--color-faint)' }}>{s.tier}</span>
                    </div>
                  );
                })}
              </div>
              {error && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
              <button className="me-btn-primary w-full justify-center" onClick={() => setStage('choice')} disabled={busy || !songId}>
                {busy ? '무대 오르는 중…' : '음악방송 출연 🎤'}
              </button>
            </>
          )}
          </div>
          <GlobalChart />
        </div>

        {/* right: condition + fandom + trophies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(() => {
            const cond = status?.condition ?? character.condition ?? 100;
            const cColor = cond >= 60 ? '#5FBF8F' : cond >= 30 ? 'var(--sk-accent)' : '#C4576B';
            return (
              <div className="me-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  <span>🔋 컨디션</span>
                  <span className="me-mono" style={{ color: cColor }}>{cond}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--sk-panel-b)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${cond}%`, background: cColor, borderRadius: 4, transition: 'width .2s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-faint)', marginBottom: 10 }}>
                  활동하면 닳고, 낮으면 음방 성적이 떨어져요. 휴식으로 회복 (2일).
                </div>
                <button className="me-btn-ghost w-full justify-center" disabled={fanBusy || cond >= 100} onClick={doRest}>😴 휴식</button>
              </div>
            );
          })()}

          <div className="me-panel">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Heart size={15} style={{ color: '#E893A6' }} /> 팬덤
            </div>
            {editingName ? (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="팬덤 이름"
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--color-border-strong)', background: 'var(--sk-panel-b)', color: 'var(--color-text)', outline: 'none' }} />
                <button className="me-btn-ghost" style={{ padding: 7 }} onClick={saveName} aria-label="저장"><Check size={15} /></button>
                <button className="me-btn-ghost" style={{ padding: 7 }} onClick={() => setEditingName(false)} aria-label="취소"><X size={15} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{fandom?.fandom_name || '이름 없음'}</div>
                <button className="me-btn-ghost" style={{ padding: '3px 7px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  onClick={() => { setNameDraft(fandom?.fandom_name || ''); setEditingName(true); }}>
                  <Pencil size={11} /> {fandom?.fandom_name ? '변경' : '이름 짓기'}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--sk-accent)', fontWeight: 700 }}>Lv.{fandom?.level} {fandom?.level_name}</span>
              <span className="me-mono" style={{ color: 'var(--color-muted)' }}><Heart size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {compactNum(fans)}</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'var(--sk-panel-b)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#E893A6,var(--sk-accent))', borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-faint)', marginTop: 6 }}>
              {nextAt ? `다음 등급까지 ${compactNum(Math.max(0, nextAt - fans))}명` : '최고 등급 달성!'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="me-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px 4px' }} disabled={fanBusy} onClick={() => doFanEvent('fanmeet')}>💗 팬미팅</button>
              <button className="me-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px 4px' }} disabled={fanBusy} onClick={() => doFanEvent('fansign')}>✍️ 팬사인회</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-faint)', marginTop: 6 }}>팬을 만나 수익·팬을 늘려요 (하루 진행).</div>
          </div>

          <div className="me-panel">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>🌍 해외 진출</div>
            {(() => {
              const eligible = (character.fame ?? 0) >= 70 && (character.fansCount ?? 0) >= 100000;
              return eligible ? (
                <>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 10 }}>월드투어로 대형 수익·명성·팬을 확보해요 (5일 소요).</div>
                  <button className="me-btn-primary w-full justify-center" disabled={fanBusy} onClick={doWorldTour}>월드투어 출발 ✈️</button>
                </>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--color-faint)' }}>
                  조건: 명성 70+ · 팬 10만+<br />
                  <span style={{ color: 'var(--color-muted)' }}>현재 명성 {Math.round(character.fame ?? 0)} · 팬 {compactNum(character.fansCount ?? 0)}</span>
                </div>
              );
            })()}
          </div>

          <div className="me-panel">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={15} style={{ color: '#F5C46B' }} /> 음방 기록
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)' }}>🏆 {status?.trophies ?? 0}</span>
            </div>
            {results.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--color-faint)' }}>아직 출연 기록이 없어요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' }} className="me-scroll">
                {results.map((r) => {
                  const b = rankBadge(r.rank, r.is_win);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ color: b.color, fontWeight: 700, fontSize: 11, minWidth: 54 }}>{b.label}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.song_title}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-faint)' }}>{r.show_name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* result modal */}
      {result && (
        <div className="me-modal-backdrop" onClick={() => setResult(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            {(() => { const b = rankBadge(result.result.rank, result.result.is_win); return (
              <>
                <div style={{ fontSize: 40, marginBottom: 4 }}>{result.result.is_win ? '🏆' : '🎤'}</div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{result.result.show_name}</div>
                <div className="me-display" style={{ fontSize: 24, fontWeight: 800, color: b.color, margin: '4px 0 2px' }}>{b.label}</div>
                <div style={{ fontSize: 13, marginBottom: result.performance != null ? 6 : 14 }}>{result.result.song_title}</div>
                {result.performance != null && (
                  <div style={{ fontSize: 12, marginBottom: 14, color: result.performance >= 0.75 ? '#4FD1C5' : result.performance >= 0.5 ? '#E8A33D' : '#C4576B' }}>
                    🎵 리듬 {Math.round(result.performance * 100)}% — {result.performance >= 0.75 ? '완벽한 무대! 보너스' : result.performance >= 0.5 ? '무난한 무대' : '삐끗한 무대… 감점'}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <Reward label="명성" value={`+${result.fame_delta}`} color="var(--sk-accent)" />
                  <Reward label="팬" value={`+${compactNum(result.fans_delta)}`} color="#E893A6" />
                  <Reward label="스트리밍" value={`+${compactNum(result.streams_delta)}`} color="#4FD1C5" />
                  <Reward label="수익" value={`+₩${compactNum(result.money_delta)}`} color="#5FBF8F" />
                </div>
                <button className="me-btn-primary w-full justify-center" onClick={() => setResult(null)}>확인</button>
              </>
            ); })()}
          </div>
        </div>
      )}

      {stage === 'choice' && (
        <div className="me-modal-backdrop" onClick={() => setStage(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>🎤</div>
            <div className="me-display" style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>무대에 오르기 전</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16 }}>리듬게임을 잘하면 순위·보상이 올라가고, 못하면 떨어져요. 안 하면 기본 성적으로 출연해요.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="me-btn-primary w-full justify-center" onClick={() => setStage('rhythm')}>🎮 리듬게임 도전</button>
              <button className="me-btn-ghost w-full justify-center" onClick={() => runPromote(null)}>🎤 그냥 출연 (기본 보상)</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'rhythm' && (
        <div className="me-modal-backdrop" onClick={() => { /* ignore backdrop during play */ }}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <RhythmGame
              bpm={character?.songs?.find((s) => s.id === songId)?.bpm ?? 120}
              onFinish={(perf) => runPromote(perf)}
              onCancel={() => runPromote(null)}
            />
          </div>
        </div>
      )}

      {fanResult && (
        <div className="me-modal-backdrop" onClick={() => setFanResult(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340, textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 2 }}>{fanResult.kind === 'fanmeet' ? '💗' : fanResult.kind === 'tour' ? '🌍' : '✍️'}</div>
            <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{fanResult.label} 성료!</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <Reward label="수익" value={`+₩${compactNum(fanResult.earnings)}`} color="#5FBF8F" />
              <Reward label="팬" value={`+${compactNum(fanResult.fans_gain)}`} color="#E893A6" />
              <Reward label="명성" value={`+${fanResult.fame_gain}`} color="var(--sk-accent)" />
            </div>
            <button className="me-btn-primary w-full justify-center" onClick={() => setFanResult(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Reward({ label, value, color }) {
  return (
    <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '9px 6px', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 10, color: 'var(--color-faint)' }}>{label}</div>
      <div className="me-mono" style={{ fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
