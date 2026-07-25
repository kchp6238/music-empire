import { useEffect, useState } from 'react';
import { Newspaper, CalendarPlus, Trophy } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { PageTransition } from '../ui/PageTransition';
import { Button } from '../ui/Button';
import * as newsApi from '../../lib/api/news';
import { getChart } from '../../lib/api/community';
import { TIER_COLOR } from '../../lib/gameData/constants';
import { compactNum } from '../../lib/utils';
import { useGameStore } from '../../state/useGameStore';

const KIND = {
  choice: { color: '#E8A33D', label: '결정' },
  fun: { color: '#4FD1C5', label: '이런 일이' },
  serious: { color: '#C4576B', label: '주의' },
  industry: { color: '#8B7FD1', label: '업계' },
  rival: { color: '#E893A6', label: '라이벌' },
  personal: { color: '#5FBF8F', label: '이야기' },
};

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'choice', label: '결정할 일' },
  { id: 'industry', label: '업계·라이벌' },
  { id: 'personal', label: '나의 소식' },
];

function effectText(effect) {
  const parts = [];
  if (effect.money) parts.push(`${effect.money > 0 ? '+' : ''}${(effect.money / 10000).toLocaleString('ko-KR')}만원`);
  if (effect.fans) parts.push(`팬 ${effect.fans > 0 ? '+' : ''}${effect.fans}`);
  if (effect.fame) parts.push(`명성 ${effect.fame > 0 ? '+' : ''}${effect.fame}`);
  return parts.join(' · ');
}

function Choices({ item, onChoose, busy }) {
  if (item.kind !== 'choice') return null;
  if (item.resolved) {
    return item.outcome
      ? <div className="text-[12px] text-accent2 mt-2 border-l-2 border-accent2/40 pl-2">{item.outcome}</div>
      : null;
  }
  return (
    <div className="flex gap-2 flex-wrap mt-2.5">
      {item.choices.map((c) => (
        <Button key={c.id} size="sm" onClick={() => onChoose(item.id, c.id)} disabled={busy}>{c.label}</Button>
      ))}
    </div>
  );
}

export function NewsScreen() {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);
  const openArtist = useGameStore((s) => s.openArtist);

  const [items, setItems] = useState(null);
  const [chart, setChart] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    try {
      setItems(await newsApi.getNews());
      getChart().then((c) => setChart(c.slice(0, 6))).catch(() => {});
    } catch (e) { setError(e.message || '소식을 불러오지 못했습니다'); }
  }
  useEffect(() => { load(); }, []);

  async function onAdvance() {
    setBusy(true); setError(''); setFlash('');
    try {
      const res = await newsApi.advanceDay();
      await refreshCharacter();
      setFlash(res.news?.length ? `${res.news.length}건의 새 소식이 도착했어요` : '조용한 하루였어요.');
      await load();
    } catch (e) { setError(e.message || '하루를 보내지 못했습니다'); }
    finally { setBusy(false); }
  }

  async function onChoose(newsId, choiceId) {
    setBusy(true); setError('');
    try {
      const res = await newsApi.chooseNews(newsId, choiceId);
      await refreshCharacter();
      const eff = effectText(res.effect || {});
      setFlash(eff ? `결정 완료 — ${eff}` : '결정을 내렸어요.');
      await load();
    } catch (e) { setError(e.message || '결정에 실패했습니다'); }
    finally { setBusy(false); }
  }

  if (!character) return null;

  const filtered = (items || []).filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'choice') return n.kind === 'choice';
    if (filter === 'industry') return n.kind === 'industry' || n.kind === 'rival';
    if (filter === 'personal') return n.kind === 'personal' || n.kind === 'fun' || n.kind === 'serious';
    return true;
  });
  // Unresolved decisions bubble up as the headline; otherwise the newest item.
  const headline = filtered.find((n) => n.kind === 'choice' && !n.resolved) || filtered[0];
  const rest = filtered.filter((n) => n !== headline);

  return (
    <div>
      <TopBar character={character} />
      <PageTransition>
        <div className="max-w-[1080px] mx-auto px-4 md:px-6 pt-6 pb-16">
          <div className="font-display text-2xl font-extrabold mb-1 flex items-center gap-2">
            <Newspaper size={20} className="text-accent" /> 소식
          </div>
          <div className="text-muted text-xs mb-4">하루를 보내면 그날의 소식이 도착해요. 가끔은 당신의 결정이 필요한 일도 생깁니다.</div>

          <div className="grid grid-cols-1 lg:[grid-template-columns:1fr_300px] gap-5 items-start">
            {/* main column */}
            <div className="min-w-0">
              <div className="flex gap-1.5 flex-wrap mb-4">
                {FILTERS.map((f) => (
                  <div key={f.id} className={`me-pill small ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</div>
                ))}
              </div>

              {flash && <div className="text-xs text-accent2 mb-3">{flash}</div>}
              {error && <div className="text-xs text-danger mb-3">{error}</div>}
              {items === null && <div className="text-xs text-faint">불러오는 중...</div>}
              {items && filtered.length === 0 && (
                <div className="text-xs text-faint">해당하는 소식이 없어요. '하루 보내기'로 하루를 흘려보세요.</div>
              )}

              {/* featured headline */}
              {headline && (
                <div className="me-panel mb-4 overflow-hidden" style={{ padding: 0, borderColor: headline.kind === 'choice' && !headline.resolved ? 'rgba(232,163,61,0.5)' : undefined }}>
                  <div className="h-1.5" style={{ background: KIND[headline.kind]?.color || '#8B8496' }} />
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl" aria-hidden>{headline.icon}</span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ color: KIND[headline.kind]?.color, border: `1px solid ${KIND[headline.kind]?.color}55` }}>
                        {KIND[headline.kind]?.label || '소식'}
                      </span>
                      <span className="text-[10px] text-faint me-mono ml-auto">{headline.game_date}</span>
                    </div>
                    <div className="me-display text-lg font-extrabold mb-1.5">{headline.title}</div>
                    <div className="text-[13px] text-text leading-relaxed">{headline.body}</div>
                    <Choices item={headline} onChoose={onChoose} busy={busy} />
                  </div>
                </div>
              )}

              {/* card grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rest.map((n) => (
                  <div key={n.id} className="me-panel" style={{ padding: 12, borderColor: n.kind === 'choice' && !n.resolved ? 'rgba(232,163,61,0.5)' : undefined }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base" aria-hidden>{n.icon}</span>
                      <span className="text-[10px] font-mono" style={{ color: KIND[n.kind]?.color }}>{KIND[n.kind]?.label || '소식'}</span>
                      <span className="text-[9px] text-faint me-mono ml-auto">{n.game_date}</span>
                    </div>
                    <div className="text-[12px] text-text leading-snug">{n.body}</div>
                    <Choices item={n} onChoose={onChoose} busy={busy} />
                  </div>
                ))}
              </div>
            </div>

            {/* sidebar */}
            <div className="flex flex-col gap-4">
              <div className="me-panel">
                <div className="text-[11px] text-muted mb-1">오늘</div>
                <div className="me-mono text-accent2 text-sm mb-3">{character.gameDate}</div>
                <Button variant="primary" className="w-full justify-center" onClick={onAdvance} disabled={busy}>
                  <CalendarPlus size={15} /> {busy ? '진행 중…' : '하루 보내기'}
                </Button>
              </div>

              <div className="me-panel">
                <div className="text-[12px] font-bold text-muted mb-2.5 flex items-center gap-1.5"><Trophy size={13} className="text-accent" /> 차트 TOP</div>
                {!chart && <div className="text-[11px] text-faint">불러오는 중...</div>}
                {chart && chart.length === 0 && <div className="text-[11px] text-faint">아직 차트가 비어있어요.</div>}
                <div className="flex flex-col gap-2">
                  {chart && chart.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 text-[11px]">
                      <span className="me-mono w-4 text-center font-bold" style={{ color: i === 0 ? '#E8A33D' : i === 1 ? '#4FD1C5' : i === 2 ? '#E893A6' : '#6B6577' }}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-text">{s.title}</div>
                        <div className="truncate text-faint me-artist-link" onClick={() => openArtist(s.artist_type, s.artist_id)}>{s.artist_name}</div>
                      </div>
                      <span className="me-mono shrink-0" style={{ color: TIER_COLOR[s.tier] }}>{Math.round(s.overall_score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
