import { useEffect, useState } from 'react';
import { Save, FolderOpen, FilePlus2, Trash2, X } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { useGameStore } from '../../state/useGameStore';

function timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5) return '방금';
  if (secs < 60) return `${secs}초 전`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}분 전`;
  return `${Math.floor(mins / 60)}시간 전`;
}

export function DraftBar() {
  const draft = useGameStore((s) => s.draft);
  const persistedDraftId = useGameStore((s) => s.persistedDraftId);
  const draftSavedAt = useGameStore((s) => s.draftSavedAt);
  const saveDraft = useGameStore((s) => s.saveDraft);
  const listDrafts = useGameStore((s) => s.listDrafts);
  const loadDraft = useGameStore((s) => s.loadDraft);
  const deleteDraft = useGameStore((s) => s.deleteDraft);
  const newDraft = useGameStore((s) => s.newDraft);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState(null);
  // re-render so the "n분 전" label stays truthful while sitting on the page
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!draftSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [draftSavedAt]);

  async function onSave() {
    setBusy(true); setError('');
    try {
      await saveDraft();
    } catch (e) {
      setError(e.message || '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function openList() {
    setOpen(true); setError(''); setDrafts(null);
    try {
      setDrafts(await listDrafts());
    } catch (e) {
      setError(e.message || '초안을 불러오지 못했습니다');
      setDrafts([]);
    }
  }

  async function onLoad(id) {
    setBusy(true); setError('');
    try {
      await loadDraft(id);
      setOpen(false);
    } catch (e) {
      setError(e.message || '불러오기에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id) {
    setBusy(true); setError('');
    try {
      await deleteDraft(id);
      setDrafts(await listDrafts());
    } catch (e) {
      setError(e.message || '삭제에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="mb-5 flex items-center gap-3 flex-wrap">
      <Button variant="primary" size="md" onClick={onSave} disabled={busy}>
        <Save size={15} /> 저장
      </Button>
      <Button onClick={openList} disabled={busy}>
        <FolderOpen size={14} /> 불러오기
      </Button>
      <Button onClick={newDraft} disabled={busy}>
        <FilePlus2 size={14} /> 새 곡
      </Button>

      <span className="text-xs text-muted ml-auto">
        {error ? <span className="text-danger">{error}</span>
          : draftSavedAt ? `저장됨 · ${timeAgo(draftSavedAt)}`
          : persistedDraftId ? '불러온 초안 · 변경사항 미저장'
          : '아직 저장되지 않음'}
      </span>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setOpen(false)}>
          <Panel className="w-full max-w-lg max-h-[70vh] overflow-y-auto me-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <span className="font-display font-extrabold text-lg">저장된 초안</span>
              <Button size="sm" className="ml-auto" onClick={() => setOpen(false)} aria-label="닫기"><X size={14} /></Button>
            </div>
            {drafts === null && <div className="text-xs text-faint">불러오는 중...</div>}
            {drafts && drafts.length === 0 && <div className="text-xs text-faint">저장된 초안이 없습니다.</div>}
            <div className="flex flex-col gap-2">
              {drafts && drafts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{d.title?.trim() || '(제목 없음)'}</div>
                    <div className="text-[11px] text-muted">
                      {d.bpm} BPM · {(d.structure || []).length}개 섹션
                      {d.genre_tags?.length ? ` · ${d.genre_tags.join(', ')}` : ''}
                    </div>
                  </div>
                  {d.id === persistedDraftId && <span className="text-[11px] text-accent2">편집 중</span>}
                  <Button size="sm" onClick={() => onLoad(d.id)} disabled={busy}>불러오기</Button>
                  <Button size="sm" variant="danger" onClick={() => onDelete(d.id)} disabled={busy} aria-label={`${d.title || '초안'} 삭제`}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </Panel>
  );
}
