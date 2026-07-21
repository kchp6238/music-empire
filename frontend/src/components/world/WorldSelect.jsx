import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc3, Plus, Users, User, LogIn, Trash2, LogOut, Calendar } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { won } from '../../lib/utils';
import * as worldsApi from '../../lib/api/worlds';
import { useGameStore } from '../../state/useGameStore';
import { useAuthStore } from '../../state/useAuthStore';

/**
 * The save-select screen, FM-style. Every login lands here: pick a save to
 * continue, start a new solo career, open a multi room others can join by
 * code, or join one with a code.
 *
 * A save is a World. Choosing one sets it active (so every request carries its
 * character) and either continues into the studio or, for a world with no
 * character yet, drops into character creation.
 */
export function WorldSelect() {
  const navigate = useNavigate();
  const selectSave = useGameStore((s) => s.selectSave);
  const loadCharacter = useGameStore((s) => s.loadCharacter);
  const resetCharacterLoaded = useGameStore((s) => s.resetCharacterLoaded);
  const logout = useAuthStore((s) => s.logout);

  const [saves, setSaves] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // 'solo' | 'multi' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  async function refresh() {
    setError('');
    try {
      setSaves(await worldsApi.listSaves());
    } catch (e) {
      setError(e.message || '세이브를 불러오지 못했습니다');
      setSaves([]);
    }
  }
  useEffect(() => { refresh(); }, []);

  // Enter a save: make it active, then continue the career or create one.
  async function enter(save) {
    setBusy(true); setError('');
    try {
      selectSave(save.world_id, save.character?.id || null);
      if (save.character) {
        resetCharacterLoaded();
        await loadCharacter();
        navigate('/studio');
      } else {
        // world exists but no career in it yet (freshly made / just joined)
        navigate('/create');
      }
    } catch (e) {
      setError(e.message || '세이브를 여는 데 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function createNew(kind) {
    setBusy(true); setError('');
    try {
      const world = await worldsApi.createWorld(name.trim(), kind);
      selectSave(world.id, null);
      navigate('/create');
    } catch (e) {
      setError(e.message || '세이브를 만들지 못했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    setBusy(true); setError('');
    try {
      const world = await worldsApi.joinWorld(code.trim());
      selectSave(world.id, null);
      navigate('/create');
    } catch (e) {
      setError(e.message || '참여에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function remove(save) {
    if (!window.confirm(`"${save.name}" 세이브를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true); setError('');
    try {
      await worldsApi.deleteWorld(save.world_id);
      await refresh();
    } catch (e) {
      setError(e.message || '삭제에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="me-root min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Disc3 size={26} className="text-accent" />
          <div className="me-display text-2xl font-extrabold flex-1">세이브 선택</div>
          <Button size="sm" onClick={logout} title="로그아웃"><LogOut size={14} /> 로그아웃</Button>
        </div>
        <div className="text-muted text-xs mb-6">
          혼자 하는 세이브와 친구들과 함께하는 멀티 방을 여러 개 만들 수 있어요. 각 세이브는 완전히 분리됩니다.
        </div>

        {error && <div className="text-danger text-sm mb-4">{error}</div>}

        {/* existing saves */}
        {saves === null && <div className="text-faint text-sm">불러오는 중…</div>}
        {saves && saves.length === 0 && (
          <div className="text-faint text-sm mb-6">아직 세이브가 없어요. 아래에서 새로 시작하세요.</div>
        )}
        <div className="flex flex-col gap-2.5 mb-8">
          {saves && saves.map((s) => (
            <Panel key={s.world_id} className="flex items-center gap-4 flex-wrap">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: s.kind === 'multi' ? 'rgba(79,209,197,0.15)' : 'rgba(232,163,61,0.15)' }}
              >
                {s.kind === 'multi' ? <Users size={17} className="text-accent2" /> : <User size={17} className="text-accent" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{s.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{
                    background: 'var(--color-groove)',
                    color: s.kind === 'multi' ? 'var(--color-accent2)' : 'var(--color-accent)',
                  }}>
                    {s.kind === 'multi' ? `멀티 · ${s.player_count}명` : '솔로'}
                  </span>
                  {s.kind === 'multi' && s.join_code && (
                    <span className="text-[10px] font-mono text-faint">코드 {s.join_code}</span>
                  )}
                </div>
                {s.character ? (
                  <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="text-text">{s.character.artist_name}</span>
                    <span>· {s.character.background_name}</span>
                    <span className="inline-flex items-center gap-1"><Calendar size={10} /> {s.character.game_date}</span>
                    <span>· 발매곡 {s.character.released_count}</span>
                    <span>· {won(s.character.money)}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-faint mt-0.5">아직 아티스트를 만들지 않았어요</div>
                )}
              </div>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => enter(s)}>
                {s.character ? '이어하기' : '시작하기'}
              </Button>
              {s.is_owner && (
                <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(s)} aria-label={`${s.name} 삭제`}>
                  <Trash2 size={13} />
                </Button>
              )}
            </Panel>
          ))}
        </div>

        {/* new save actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          <button
            className="me-rack-row p-4 text-left cursor-pointer"
            style={{ borderColor: mode === 'solo' ? 'var(--color-accent)' : undefined }}
            onClick={() => { setMode('solo'); setName(''); }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold"><User size={15} className="text-accent" /> 혼자 하기</div>
            <div className="text-[11px] text-faint mt-1">나만의 세계에서 NPC 라이벌과 경쟁</div>
          </button>
          <button
            className="me-rack-row p-4 text-left cursor-pointer"
            style={{ borderColor: mode === 'multi' ? 'var(--color-accent2)' : undefined }}
            onClick={() => { setMode('multi'); setName(''); }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold"><Users size={15} className="text-accent2" /> 멀티 방 만들기</div>
            <div className="text-[11px] text-faint mt-1">코드를 발급해 친구를 초대</div>
          </button>
          <button
            className="me-rack-row p-4 text-left cursor-pointer"
            style={{ borderColor: mode === 'join' ? 'var(--color-purple)' : undefined }}
            onClick={() => { setMode('join'); setCode(''); }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold"><LogIn size={15} className="text-purple" /> 코드로 참여</div>
            <div className="text-[11px] text-faint mt-1">친구가 준 코드로 방에 입장</div>
          </button>
        </div>

        {(mode === 'solo' || mode === 'multi') && (
          <Panel className="flex items-center gap-2 flex-wrap">
            <Input
              className="flex-1 min-w-[180px]"
              placeholder={mode === 'solo' ? '세이브 이름 (예: 나의 커리어)' : '방 이름 (예: 우리들의 무대)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button variant="primary" disabled={busy} onClick={() => createNew(mode)}>
              <Plus size={14} /> 만들기
            </Button>
          </Panel>
        )}
        {mode === 'join' && (
          <Panel className="flex items-center gap-2 flex-wrap">
            <Input
              className="flex-1 min-w-[180px] font-mono uppercase"
              placeholder="참여 코드 (예: ABC123)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
            />
            <Button variant="primary" disabled={busy || !code.trim()} onClick={joinByCode}>
              <LogIn size={14} /> 참여
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
