import { useEffect, useState } from 'react';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import * as newsApi from '../../lib/api/news';
import { useGameStore } from '../../state/useGameStore';

// Phone-native news feed: the same /news data as the full 소식 tab, laid out for
// the narrow screen. Choice events stay interactive (resolving one applies its
// money/fans/fame effect and refreshes the save), so the phone is a real way to
// play the daily beats, not just a read-only mirror.
export function NewsApp() {
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  async function load() {
    try { setItems(await newsApi.getNews()); } catch { setItems([]); }
  }
  useEffect(() => { load(); }, []);

  async function choose(newsId, choiceId) {
    setBusy(true);
    try {
      await newsApi.chooseNews(newsId, choiceId);
      await refreshCharacter();
      setFlash('결정을 내렸어요.');
      await load();
    } catch { setFlash('결정에 실패했어요.'); }
    finally { setBusy(false); }
  }

  if (items === null) return <div className="p-5 text-center text-muted text-xs">불러오는 중…</div>;
  if (!items.length) return <div className="p-6 text-center text-muted text-xs">아직 소식이 없어요. 곡을 발매하면 하루가 흐르고 소식이 쌓여요.</div>;

  return (
    <div className="px-3 py-3 flex flex-col gap-2.5">
      {flash && <div className="text-[11px] text-accent2 text-center">{flash}</div>}
      {items.map((n) => {
        const open = n.kind === 'choice' && !n.resolved;
        return (
          <div key={n.id} className="me-daw-groove p-3 rounded-xl">
            <div className="flex items-start gap-2.5">
              {n.subject_name
                ? <ArtistAvatar name={n.subject_name} color={n.subject_color || '#8B8496'} size={38} />
                : <div className="text-xl leading-none mt-0.5 shrink-0">{n.icon}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-text truncate">{n.title}</span>
                  {n.game_date && <span className="me-mono text-[9px] text-faint ml-auto shrink-0">{n.game_date.slice(5)}</span>}
                </div>
                <div className="text-[11px] text-muted leading-relaxed mt-1">{n.body}</div>

                {open && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {n.choices.map((c) => (
                      <button
                        key={c.id} disabled={busy}
                        onClick={() => choose(n.id, c.id)}
                        className="me-btn-ghost !px-2.5 !py-1 !text-[11px] disabled:opacity-40"
                      >{c.label}</button>
                    ))}
                  </div>
                )}
                {n.kind === 'choice' && n.resolved && n.outcome && (
                  <div className="text-[10px] text-faint mt-1.5">→ {n.outcome}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
