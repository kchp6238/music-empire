import { useEffect, useState } from 'react';
import { Newspaper, CalendarPlus } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { PageTransition } from '../ui/PageTransition';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import * as newsApi from '../../lib/api/news';
import { useGameStore } from '../../state/useGameStore';

const KIND_COLOR = {
  choice: '#E8A33D', fun: '#4FD1C5', serious: '#C4576B',
  industry: '#8B7FD1', rival: '#E893A6', personal: '#5FBF8F',
};

function effectText(effect) {
  const parts = [];
  if (effect.money) parts.push(`${effect.money > 0 ? '+' : ''}${(effect.money / 10000).toLocaleString('ko-KR')}만원`);
  if (effect.fans) parts.push(`팬 ${effect.fans > 0 ? '+' : ''}${effect.fans}`);
  if (effect.fame) parts.push(`명성 ${effect.fame > 0 ? '+' : ''}${effect.fame}`);
  return parts.join(' · ');
}

export function NewsScreen() {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);

  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  async function load() {
    try { setItems(await newsApi.getNews()); }
    catch (e) { setError(e.message || '소식을 불러오지 못했습니다'); }
  }
  useEffect(() => { load(); }, []);

  async function onAdvance() {
    setBusy(true); setError(''); setFlash('');
    try {
      const res = await newsApi.advanceDay();
      await refreshCharacter();
      setFlash(res.news?.length ? `${res.news.length}건의 새 소식이 도착했어요` : '조용한 하루였어요.');
      await load();
    } catch (e) {
      setError(e.message || '하루를 보내지 못했습니다');
    } finally { setBusy(false); }
  }

  async function onChoose(newsId, choiceId) {
    setBusy(true); setError('');
    try {
      const res = await newsApi.chooseNews(newsId, choiceId);
      await refreshCharacter();
      const eff = effectText(res.effect || {});
      setFlash(eff ? `결정 완료 — ${eff}` : '결정을 내렸어요.');
      await load();
    } catch (e) {
      setError(e.message || '결정에 실패했습니다');
    } finally { setBusy(false); }
  }

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <PageTransition>
        <div className="max-w-[720px] mx-auto px-4 md:px-6 pt-7 pb-16">
          <div className="font-display text-2xl font-extrabold mb-1 flex items-center gap-2">
            <Newspaper size={20} className="text-accent" /> 소식
          </div>
          <div className="text-muted text-xs mb-4">
            하루를 보내면 그날의 소식이 도착해요. 가끔은 당신의 결정이 필요한 일도 생깁니다.
          </div>

          <Panel className="mb-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="text-muted">오늘</span>{' '}
              <span className="me-mono text-accent2">{character.gameDate}</span>
            </div>
            <Button variant="primary" onClick={onAdvance} disabled={busy}>
              <CalendarPlus size={15} /> {busy ? '진행 중…' : '하루 보내기'}
            </Button>
          </Panel>

          {flash && <div className="text-xs text-accent2 mb-3">{flash}</div>}
          {error && <div className="text-xs text-danger mb-3">{error}</div>}

          {items === null && <div className="text-xs text-faint">불러오는 중...</div>}
          {items && items.length === 0 && (
            <div className="text-xs text-faint">아직 소식이 없어요. '하루 보내기'로 하루를 흘려보세요.</div>
          )}

          <div className="flex flex-col gap-2.5">
            {items && items.map((n) => (
              <Panel key={n.id} className="py-3 px-4" style={{ borderColor: n.kind === 'choice' && !n.resolved ? 'rgba(232,163,61,0.5)' : undefined }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none shrink-0" aria-hidden>{n.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono" style={{ color: KIND_COLOR[n.kind] || 'var(--color-muted)' }}>{n.title}</span>
                      <span className="text-[10px] text-faint me-mono ml-auto">{n.game_date}</span>
                    </div>
                    <div className="text-[13px] text-text leading-snug">{n.body}</div>

                    {n.kind === 'choice' && !n.resolved && (
                      <div className="flex gap-2 flex-wrap mt-2.5">
                        {n.choices.map((c) => (
                          <Button key={c.id} size="sm" onClick={() => onChoose(n.id, c.id)} disabled={busy}>{c.label}</Button>
                        ))}
                      </div>
                    )}
                    {n.kind === 'choice' && n.resolved && n.outcome && (
                      <div className="text-[12px] text-accent2 mt-2 border-l-2 border-accent2/40 pl-2">{n.outcome}</div>
                    )}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
