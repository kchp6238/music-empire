import { useEffect, useState } from 'react';
import { Users, Sparkles, Disc3, Ticket, Megaphone, Wallet, X } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as companyApi from '../../lib/api/company';
import { useGameStore } from '../../state/useGameStore';
import { SceneHero } from '../shared/SceneHero';
import { won } from '../../lib/utils';

const DEBUT_MIN_STAGE = 3;
const RECRUIT_COST = 1500000;
const TRAINEE_TRAIN_COST = 500000;

// What a debuted group can be sent to do (mirrors company_service.GROUP_ACTIVITIES).
const ACTIVITIES = [
  { kind: 'comeback', label: '컴백', cost: 2000000, icon: Disc3 },
  { kind: 'tour', label: '투어', cost: 1000000, icon: Ticket },
  { kind: 'cf', label: '광고', cost: 0, icon: Megaphone },
];

/** One founding-condition row: current value vs. the target, with a met/unmet
 *  marker so the player can see how far off they are. */
function ReqRow({ label, have, need, fmt = (v) => v }) {
  const met = have >= need;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 16, textAlign: 'center', color: met ? '#5FBF8F' : '#6B6577' }}>{met ? '✓' : '·'}</span>
      <span style={{ color: '#8B8496', minWidth: 92 }}>{label}</span>
      <span className="me-mono" style={{ color: met ? '#5FBF8F' : '#EDE9F0' }}>{fmt(have)}</span>
      <span style={{ color: '#6B6577' }}>/ {fmt(need)}</span>
    </div>
  );
}

export function CompanyScreen() {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);

  const [company, setCompany] = useState(undefined); // undefined = loading, null = none
  const [req, setReq] = useState(null); // founding requirements + progress
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [actResult, setActResult] = useState(null);

  async function doActivity(groupId, kind) {
    setBusy(true); setError('');
    try {
      const res = await companyApi.groupActivity(groupId, kind);
      setCompany(res.company);
      await refreshCharacter();
      setActResult(res.result);
    } catch (e) {
      setError(e.message || '활동에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    try {
      const c = await companyApi.getMyCompany();
      setCompany(c);
      if (c === null) setReq(await companyApi.getFoundRequirements());
    } catch (e) {
      setError(e.message || '회사 정보를 불러오지 못했습니다');
    }
  }
  useEffect(() => { load(); }, []);

  async function run(fn) {
    setBusy(true); setError('');
    try {
      const updated = await fn();
      if (updated !== undefined) setCompany(updated);
      await refreshCharacter();
    } catch (e) {
      setError(e.message || '작업에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
        <SceneHero scene="office" title="회사" subtitle="연습생을 모집·육성해 그룹으로 데뷔시키세요." />
        {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 14 }}>{error}</div>}

        {company === undefined && <div style={{ fontSize: 12, color: '#6B6577' }}>불러오는 중...</div>}

        {company === null && (
          <div className="me-panel">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>회사 설립</div>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 14 }}>
              무명이 바로 회사를 차릴 순 없어요. 아래 조건을 모두 채워야 설립할 수 있습니다.
            </div>

            {req && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <ReqRow label="설립 자본" have={req.money} need={req.cost} fmt={won} />
                <ReqRow label="명성" have={req.fame} need={req.min_fame} />
                <ReqRow label="팬" have={req.fans} need={req.min_fans} fmt={(v) => v.toLocaleString('ko-KR')} />
                <ReqRow label={`히트곡 (${req.hit_score}점+)`} have={req.hits} need={req.min_hits} fmt={(v) => `${v}곡`} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="회사명"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none' }}
              />
              <button
                className="me-btn-primary" disabled={busy || (req && !req.eligible)}
                title={req && !req.eligible ? '설립 조건을 아직 충족하지 못했어요' : ''}
                onClick={() => run(async () => { const c = await companyApi.foundCompany(companyName); setReq(null); return c; })}
              >설립하기</button>
            </div>
          </div>
        )}

        {company && (
          <>
            <div className="me-panel" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="me-display" style={{ fontSize: 18, fontWeight: 700 }}>{company.name}</div>
              <button className="me-btn-ghost" disabled={busy} onClick={() => run(() => companyApi.recruitTrainee())}>+ 연습생 모집 ({won(RECRUIT_COST)})</button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#8B8496' }}><Users size={14} /> 연습생</div>
            {company.trainees.length === 0 && <div style={{ fontSize: 12, color: '#6B6577', marginBottom: 20 }}>아직 연습생이 없습니다.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
              {company.trainees.map((t) => {
                const avg = Math.round(Object.values(t.stats).reduce((a, b) => a + b, 0) / Object.values(t.stats).length);
                const debutReady = t.curriculum_stage >= DEBUT_MIN_STAGE && !t.group_id;
                const canSelect = debutReady;
                const isSelected = selected.includes(t.id);
                return (
                  <div key={t.id} className="me-panel" style={{ padding: 12, borderColor: isSelected ? '#4FD1C5' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
                      <span className="me-mono" style={{ fontSize: 11, color: '#8B8496' }}>단계 {t.curriculum_stage}/5 · 평균 {avg}</span>
                    </div>
                    {t.group_id ? (
                      <div style={{ fontSize: 11, color: '#5FBF8F' }}>데뷔 완료</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} disabled={busy || t.curriculum_stage >= 5} onClick={() => run(() => companyApi.trainTrainee(t.id))}>트레이닝 ({won(TRAINEE_TRAIN_COST)})</button>
                        {canSelect && (
                          <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 11, borderColor: isSelected ? '#4FD1C5' : undefined, color: isSelected ? '#4FD1C5' : undefined }}
                            onClick={() => setSelected((sel) => isSelected ? sel.filter((x) => x !== t.id) : [...sel, t.id])}>
                            {isSelected ? '선택됨' : '데뷔조 선택'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selected.length > 0 && (
              <div className="me-panel" style={{ marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderColor: '#4FD1C5' }}>
                <span style={{ fontSize: 12, color: '#4FD1C5' }}>데뷔조 {selected.length}명 선택됨</span>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="그룹명"
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none' }} />
                <button className="me-btn-primary" style={{ marginLeft: 'auto' }} disabled={busy}
                  onClick={() => run(async () => { const c = await companyApi.debutGroup(groupName, selected); setSelected([]); setGroupName(''); return c; })}>
                  그룹 데뷔
                </button>
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#8B8496' }}>
              <Sparkles size={14} /> 데뷔 그룹
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--sk-accent)' }}>
                <Wallet size={13} /> <span className="me-mono" style={{ fontSize: 12 }}>회사 자본 {won(company.capital || 0)}</span>
              </span>
            </div>
            {company.groups.length === 0 && <div style={{ fontSize: 12, color: '#6B6577' }}>아직 데뷔한 그룹이 없습니다.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {company.groups.map((g) => (
                <div key={g.id} className="me-panel" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</span>
                    <span className="me-mono" style={{ fontSize: 11, color: '#8B8496' }}>명성 {Math.round(g.fame)} · 팬 {g.fans_count.toLocaleString('ko-KR')} · 멤버 {g.member_ids.length}명</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: '#8B8496' }}>누적 수익</span>
                    <span className="me-mono" style={{ fontSize: 15, color: '#E8A33D', fontWeight: 700 }}>{won(g.total_earnings || 0)}</span>
                  </div>
                  {/* group activities — send them to earn */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: g.activity_log?.length ? 12 : 0 }}>
                    {ACTIVITIES.map((a) => {
                      const Icon = a.icon;
                      const afford = character.money >= a.cost;
                      return (
                        <button
                          key={a.kind}
                          className="me-btn-ghost"
                          style={{ padding: '7px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: afford ? 1 : 0.45 }}
                          disabled={busy || !afford}
                          onClick={() => doActivity(g.id, a.kind)}
                          title={a.cost ? `비용 ${won(a.cost)}` : '무료'}
                        >
                          <Icon size={13} /> {a.label} {a.cost ? <span style={{ color: '#6B6577', fontSize: 10 }}>{won(a.cost)}</span> : <span style={{ color: '#5FBF8F', fontSize: 10 }}>무료</span>}
                        </button>
                      );
                    })}
                  </div>
                  {g.activity_log?.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: '#6B6577', marginBottom: 5 }}>활동 내역</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {g.activity_log.map((a, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                            <span className="me-mono" style={{ color: '#6B6577', flexShrink: 0 }}>{a.date}</span>
                            <span style={{ color: '#B8B2C4' }}>{a.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {actResult && (
        <div className="me-modal-backdrop" onClick={() => setActResult(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setActResult(null)} aria-label="닫기" className="me-btn-ghost" style={{ position: 'absolute', top: 10, right: 10, padding: 4 }}><X size={15} /></button>
            <div style={{ fontSize: 34, marginBottom: 4 }}>{actResult.kind === 'comeback' ? '💿' : actResult.kind === 'tour' ? '🎟️' : '📺'}</div>
            <div className="me-display" style={{ fontSize: 18, fontWeight: 800 }}>{actResult.group_name} · {actResult.label}</div>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 14 }}>회사 자본 {won(actResult.company_capital)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <Reward label="수익" value={`+${won(actResult.earnings)}`} color="#E8A33D" />
              <Reward label="내 배당" value={`+${won(actResult.dividend)}`} color="#5FBF8F" />
              <Reward label="그룹 명성" value={`+${actResult.fame_gain}`} color="#B794F4" />
              <Reward label="그룹 팬" value={`+${(actResult.fans_gain || 0).toLocaleString('ko-KR')}`} color="#4FD1C5" />
            </div>
            <button className="me-btn-primary w-full justify-center" onClick={() => setActResult(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Reward({ label, value, color }) {
  return (
    <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '9px 6px', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 10, color: '#6B6577' }}>{label}</div>
      <div className="me-mono" style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
