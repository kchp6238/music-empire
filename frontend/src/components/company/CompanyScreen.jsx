import { useEffect, useState } from 'react';
import { Building2, Users, Sparkles } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import * as companyApi from '../../lib/api/company';
import { useGameStore } from '../../state/useGameStore';
import { won } from '../../lib/utils';

const DEBUT_MIN_STAGE = 3;
const FOUND_COST = 5000000;
const RECRUIT_COST = 800000;
const TRAINEE_TRAIN_COST = 300000;

export function CompanyScreen() {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);

  const [company, setCompany] = useState(undefined); // undefined = loading, null = none
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);

  async function load() {
    try {
      setCompany(await companyApi.getMyCompany());
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
        <div className="me-display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={20} style={{ color: '#E8A33D' }} /> 회사
        </div>
        <div style={{ color: '#8B8496', fontSize: 12, marginBottom: 20 }}>연습생을 모집·육성해 그룹으로 데뷔시키세요.</div>
        {error && <div style={{ color: '#C4576B', fontSize: 12, marginBottom: 14 }}>{error}</div>}

        {company === undefined && <div style={{ fontSize: 12, color: '#6B6577' }}>불러오는 중...</div>}

        {company === null && (
          <div className="me-panel">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>회사 설립</div>
            <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 12 }}>설립 자본 {won(FOUND_COST)}이 필요합니다.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="회사명"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none' }}
              />
              <button className="me-btn-primary" disabled={busy} onClick={() => run(() => companyApi.foundCompany(companyName))}>설립하기</button>
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

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#8B8496' }}><Sparkles size={14} /> 데뷔 그룹</div>
            {company.groups.length === 0 && <div style={{ fontSize: 12, color: '#6B6577' }}>아직 데뷔한 그룹이 없습니다.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {company.groups.map((g) => (
                <div key={g.id} className="me-panel" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{g.name}</span>
                  <span className="me-mono" style={{ fontSize: 12, color: '#8B8496' }}>명성 {Math.round(g.fame)} · 팬 {g.fans_count.toLocaleString('ko-KR')} · 멤버 {g.member_ids.length}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
