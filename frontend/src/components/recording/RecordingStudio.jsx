import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Play, Pause, Link2, Link2Off, Music2, Wand2 } from 'lucide-react';
import { TopBar } from '../shared/TopBar';
import { PageTransition } from '../ui/PageTransition';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AutotunePanel } from './AutotunePanel';
import { LyricsBoard } from './LyricsBoard';
import { startRecording, isRecordingSupported } from '../../lib/audio/recorder';
import * as recordingsApi from '../../lib/api/recordings';
import { buildCombinedPattern, sectionOffsets } from '../../lib/patterns';
import { SECTION_TYPES } from '../../lib/gameData/constants';
import { useGameStore } from '../../state/useGameStore';

// The take's target: a real section (인트로/벌스/…) or the whole song.
const WHOLE_SONG = '__whole__';

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RecordingStudio() {
  const character = useGameStore((s) => s.character);
  const draft = useGameStore((s) => s.draft);
  const persistedDraftId = useGameStore((s) => s.persistedDraftId);
  const saveDraft = useGameStore((s) => s.saveDraft);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const storePlayingId = useGameStore((s) => s.playingId);

  const [supported] = useState(isRecordingSupported());
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [takes, setTakes] = useState(null);
  const [title, setTitle] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [withBeat, setWithBeat] = useState(true);
  const [monitor, setMonitor] = useState(false);
  // Diagnostics for the last take: input peak + a local blob URL, so a silent
  // result can be traced to mic capture vs. server playback.
  const [lastTake, setLastTake] = useState(null);
  const [autotuneFor, setAutotuneFor] = useState(null); // take id with the panel open
  // Which part of the song the next take sings. Sections actually used in the
  // arrangement, in song order, plus a whole-song option.
  const arrangementSections = SECTION_TYPES.filter((t) => draft.arrangement.includes(t));
  const [targetSection, setTargetSection] = useState(() => arrangementSections[0] || WHOLE_SONG);

  const handleRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const urlCacheRef = useRef({});
  const lastTakeUrlRef = useRef(null);

  async function loadTakes() {
    try { setTakes(await recordingsApi.listRecordings()); } catch (e) { setError(e.message); setTakes([]); }
  }
  useEffect(() => { loadTakes(); }, []);

  // Revoke object URLs on unmount so blobs aren't leaked between visits
  useEffect(() => () => {
    Object.values(urlCacheRef.current).forEach((u) => URL.revokeObjectURL(u));
    if (lastTakeUrlRef.current) URL.revokeObjectURL(lastTakeUrlRef.current);
    if (audioRef.current) audioRef.current.pause();
    if (handleRef.current) handleRef.current.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  async function onStart() {
    setError('');
    try {
      // Optionally play the instrumental so the take is sung in time with it —
      // just the target section when one is chosen (so you sing the verse over
      // the verse, from its own top), otherwise the whole song.
      if (withBeat && draft.arrangement.length > 0) {
        const backingArr = targetSection === WHOLE_SONG ? draft.arrangement : [targetSection];
        await play(buildCombinedPattern(draft.sections, backingArr), draft.bpm, 'recording-backing');
      }
      handleRef.current = await startRecording({ onLevel: setLevel, monitor });
      setRecording(true);
      setLastTake(null);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 0.25), 250);
    } catch (e) {
      setError(e.message || '녹음을 시작할 수 없습니다');
      stop();
    }
  }

  async function onStop() {
    if (!handleRef.current) return;
    clearInterval(timerRef.current);
    setRecording(false);
    setLevel(0);
    stop();
    setBusy(true);
    try {
      const { blob, mimeType, durationSec, peak } = await handleRef.current.stop();
      handleRef.current = null;
      if (!blob.size) throw new Error('녹음된 오디오가 비어 있습니다');
      // Keep a local URL so the take can be auditioned without the server —
      // if this plays but the saved one doesn't, the problem is playback, not capture.
      if (lastTakeUrlRef.current) URL.revokeObjectURL(lastTakeUrlRef.current);
      lastTakeUrlRef.current = URL.createObjectURL(blob);
      setLastTake({ url: lastTakeUrlRef.current, peak, durationSec, bytes: blob.size, mimeType });
      // Attach to the open draft when there is one, so the take belongs to the song.
      let songId = persistedDraftId;
      if (!songId && draft.arrangement.length > 0) {
        try { songId = await saveDraft(); } catch { /* take is still worth keeping unattached */ }
      }
      const section = targetSection === WHOLE_SONG ? null : targetSection;
      await recordingsApi.uploadRecording({
        blob, mimeType, durationSec, songId, section,
        title: title.trim() || `${section || '전체'} 테이크 ${new Date().toLocaleTimeString('ko-KR')}`,
      });
      setTitle('');
      await loadTakes();
    } catch (e) {
      setError(e.message || '녹음 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function togglePlay(take) {
    if (playingId === take.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      stop();
      return;
    }
    audioRef.current?.pause();
    setError('');
    try {
      if (!urlCacheRef.current[take.id]) {
        urlCacheRef.current[take.id] = await recordingsApi.fetchRecordingUrl(take.id);
      }
      const audio = new Audio(urlCacheRef.current[take.id]);
      audio.onended = () => { setPlayingId(null); stop(); };
      audioRef.current = audio;
      if (withBeat && draft.arrangement.length > 0) {
        // Back a section take with just its section (it was sung over that from
        // the top), and a whole-song take with the whole song.
        const backingArr = take.section && draft.arrangement.includes(take.section)
          ? [take.section] : draft.arrangement;
        await play(buildCombinedPattern(draft.sections, backingArr), draft.bpm, 'recording-backing');
      }
      await audio.play();
      setPlayingId(take.id);
    } catch (e) {
      setError(e.message || '재생에 실패했습니다');
    }
  }

  async function onDelete(id) {
    setBusy(true);
    try {
      await recordingsApi.deleteRecording(id);
      if (urlCacheRef.current[id]) { URL.revokeObjectURL(urlCacheRef.current[id]); delete urlCacheRef.current[id]; }
      if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
      await loadTakes();
    } catch (e) {
      setError(e.message || '삭제에 실패했습니다');
    } finally { setBusy(false); }
  }

  async function onToggleAttach(take) {
    setBusy(true);
    try {
      const songId = take.song_id ? null : (persistedDraftId || await saveDraft());
      // Attaching keeps the take's own recorded section (server sentinel).
      await recordingsApi.attachRecording(take.id, songId);
      await loadTakes();
    } catch (e) {
      setError(e.message || '연결에 실패했습니다');
    } finally { setBusy(false); }
  }

  // Move the target to the next section in song order, so recording the whole
  // song is a matter of "record → 다음 구간 → record", never a dead end.
  function goNextSection() {
    if (arrangementSections.length === 0) return;
    const seq = [WHOLE_SONG, ...arrangementSections];
    const cur = seq.indexOf(targetSection);
    setTargetSection(seq[(cur + 1) % seq.length]);
  }

  // Play the whole song with every attached take layered in at its section's
  // offset — the "does my comp actually work together" preview.
  async function previewComp() {
    if (isPlaying && storePlayingId === 'comp-preview') { stop(); return; }
    setError('');
    const offsets = sectionOffsets(draft.sections, draft.arrangement, draft.bpm);
    const mine = (takes || []).filter((t) => t.song_id && t.song_id === persistedDraftId);
    const vocals = mine.map((t) => ({
      recordingId: t.id,
      offsetSec: t.section ? (offsets[t.section] || 0) : 0,
    }));
    await play(buildCombinedPattern(draft.sections, draft.arrangement), draft.bpm, 'comp-preview', vocals);
  }

  const attachedCount = (takes || []).filter((t) => t.song_id && t.song_id === persistedDraftId).length;

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <PageTransition>
        <div className="max-w-3xl mx-auto px-6 pt-7 pb-16">
          <div className="font-display text-2xl font-extrabold mb-1 flex items-center gap-2">
            <Mic size={20} className="text-pink" /> 녹음실
          </div>
          <div className="text-muted text-xs mb-5 leading-relaxed">
            ① 넣을 <b className="text-text">부분(인트로·벌스·후렴…)</b>을 고르고 반주와 함께 녹음하세요. 같은 부분을 여러 번 부르면 <b className="text-pink">화음</b>이 쌓여요.
            ② 마음에 드는 테이크의 <b className="text-accent2">곡에 넣기</b> 버튼을 누르면 그 부분에 목소리가 얹혀요.
            ③ 그 뒤로는 스튜디오·커뮤니티·차트 어디서 곡을 재생하든 <b className="text-text">비트와 목소리가 부분별로 같이</b> 들립니다.
          </div>

          {!supported && (
            <Panel className="mb-5 border-danger/50">
              <div className="text-sm text-danger">이 브라우저는 마이크 녹음을 지원하지 않습니다. 최신 Chrome/Edge에서 열어주세요.</div>
            </Panel>
          )}
          {error && <div className="text-danger text-xs mb-4">{error}</div>}

          <Panel className="mb-6">
            {/* Which part of the song this take is for — pick it first, then
                record. Whole-song is always available; the rest are the
                sections actually used in the arrangement. */}
            <div className="mb-4">
              <div className="text-[11px] text-muted mb-2">이 녹음을 넣을 부분</div>
              <div className="flex gap-1.5 flex-wrap">
                <div
                  className={`me-pill small ${targetSection === WHOLE_SONG ? 'active' : ''}`}
                  onClick={() => !recording && setTargetSection(WHOLE_SONG)}
                  style={recording ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                >곡 전체</div>
                {arrangementSections.map((t) => (
                  <div
                    key={t}
                    className={`me-pill small ${targetSection === t ? 'active' : ''}`}
                    onClick={() => !recording && setTargetSection(t)}
                    style={recording ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                  >{t}</div>
                ))}
              </div>
              {arrangementSections.length === 0 && (
                <div className="text-[11px] text-faint mt-1.5">비트메이커에서 곡 구조(인트로·벌스…)를 만들면 부분별로 녹음할 수 있어요.</div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap mb-4">
              <Input
                className="flex-1 min-w-[180px]"
                placeholder="테이크 이름 (비우면 자동)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={recording}
              />
              <Button
                variant={recording ? 'danger' : 'primary'}
                size="lg"
                onClick={recording ? onStop : onStart}
                disabled={!supported || busy}
              >
                {recording
                  ? <><Square size={15} /> 정지</>
                  : <><Mic size={15} /> {targetSection === WHOLE_SONG ? '곡 전체' : targetSection} 녹음</>}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-text w-14">{fmtDuration(elapsed)}</span>
              {/* input level meter */}
              <div className="flex-1 h-2.5 bg-panel-2 rounded-full overflow-hidden border border-border">
                <div
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{ width: `${Math.min(100, level * 140)}%`, background: level > 0.8 ? 'var(--color-danger)' : 'var(--color-accent2)' }}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                <input type="checkbox" checked={withBeat} onChange={(e) => setWithBeat(e.target.checked)} disabled={recording} />
                반주와 함께
              </label>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none" title="녹음 중 내 목소리를 스피커로 들려줍니다. 헤드폰을 껴야 하울링이 생기지 않습니다.">
                <input type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} disabled={recording} />
                내 목소리 듣기
              </label>
            </div>
            {monitor && !recording && (
              <div className="text-[11px] text-accent mt-2">
                ⚠ 반드시 헤드폰을 착용하세요. 스피커로 들으면 소리가 되먹임(하울링)됩니다.
              </div>
            )}
            {withBeat && draft.arrangement.length === 0 && (
              <div className="text-[11px] text-faint mt-2">
                비트메이커에 곡 구조가 없어 반주 없이 녹음됩니다.
              </div>
            )}
            {recording && <div className="text-[11px] text-accent2 mt-2">녹음 중… 정지를 누르면 서버에 저장됩니다.</div>}

            {/* After a take lands, the flow keeps going: sing the next section,
                or re-record the same section to stack a harmony line. */}
            {!recording && lastTake && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted">
                  이어서 <b className="text-text">{targetSection === WHOLE_SONG ? '곡 전체' : targetSection}</b>를 한 번 더 부르면 <b className="text-accent2">화음</b>이 쌓이고,
                </span>
                {arrangementSections.length > 0 && (
                  <Button size="sm" onClick={goNextSection}>다음 구간 →</Button>
                )}
              </div>
            )}
          </Panel>

          {/* Right under the transport, so it's where your eyes already are
              when the take starts rolling. */}
          <LyricsBoard locked={recording} />

          {lastTake && (
            <Panel className={`mb-6 ${lastTake.peak < 0.02 ? 'border-danger/60' : 'border-accent2/40'}`}>
              <div className="text-sm font-bold mb-2">방금 녹음한 테이크</div>
              {lastTake.peak < 0.02 ? (
                <div className="text-xs text-danger mb-3">
                  마이크에 소리가 거의 들어오지 않았습니다 (최대 입력 {(lastTake.peak * 100).toFixed(1)}%).
                  <br />파일은 저장됐지만 사실상 무음입니다. 윈도우 <b>설정 → 시스템 → 소리 → 입력</b>에서
                  올바른 마이크가 선택되어 있는지, 음소거·입력 볼륨을 확인해 주세요.
                </div>
              ) : (
                <div className="text-xs text-accent2 mb-3">
                  입력 신호가 정상적으로 감지되었습니다 (최대 입력 {(lastTake.peak * 100).toFixed(0)}%).
                </div>
              )}
              <div className="text-[11px] text-muted mb-2">
                {fmtDuration(lastTake.durationSec)} · {(lastTake.bytes / 1024).toFixed(0)}KB · {lastTake.mimeType}
              </div>
              {/* Plays straight from the local blob — no server involved, so this
                  isolates capture problems from playback/serving problems. */}
              <audio controls src={lastTake.url} className="w-full" />
              <div className="text-[11px] text-faint mt-2">
                여기서는 들리는데 아래 목록에서 안 들린다면 재생 쪽 문제입니다. 여기서도 안 들리면 마이크 입력 문제입니다.
              </div>
            </Panel>
          )}

          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-bold text-muted flex items-center gap-2">
              <Music2 size={14} /> 저장된 테이크
            </div>
            {attachedCount > 0 && (
              <Button size="sm" onClick={previewComp}>
                {(isPlaying && storePlayingId === 'comp-preview')
                  ? <><Square size={13} /> 정지</>
                  : <><Play size={13} /> 곡 전체 미리듣기 (비트+보컬 {attachedCount})</>}
              </Button>
            )}
          </div>
          {takes === null && <div className="text-xs text-faint">불러오는 중...</div>}
          {takes && takes.length === 0 && <div className="text-xs text-faint">아직 녹음한 테이크가 없습니다.</div>}
          <div className="flex flex-col gap-2">
            {takes && takes.map((t) => (
              <div key={t.id}>
                <Panel className="py-3 px-4 flex items-center gap-3">
                  <Button size="sm" onClick={() => togglePlay(t)} aria-label={playingId === t.id ? '정지' : '재생'}>
                    {playingId === t.id ? <Pause size={13} /> : <Play size={13} />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                      <span className="truncate">{t.title}</span>
                      <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-muted">
                        {t.section || '곡 전체'}
                      </span>
                      {t.pitch_shift != null && (
                        <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border border-pink/40 text-pink">
                          화음 {t.pitch_shift > 0 ? `+${t.pitch_shift}` : t.pitch_shift}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted">
                      {fmtDuration(t.duration_sec)} · {(t.size_bytes / 1024).toFixed(0)}KB
                      {t.song_id ? <span className="text-accent2"> · 곡에 들어감 (재생 시 함께 들려요)</span> : ''}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setAutotuneFor(autotuneFor === t.id ? null : t.id)}
                    disabled={busy} aria-label={`${t.title} 목소리 효과`}>
                    <Wand2 size={13} /> 목소리 효과
                  </Button>
                  <Button size="sm" variant={t.song_id ? 'ghost' : 'primary'} onClick={() => onToggleAttach(t)} disabled={busy}
                    aria-label={t.song_id ? '곡에서 빼기' : '현재 곡에 넣기'}>
                    {t.song_id ? <><Link2Off size={13} /> 곡에서 빼기</> : <><Link2 size={13} /> 곡에 넣기</>}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => onDelete(t.id)} disabled={busy} aria-label={`${t.title} 삭제`}>
                    <Trash2 size={13} />
                  </Button>
                </Panel>
                {autotuneFor === t.id && (
                  <AutotunePanel
                    take={t}
                    songId={persistedDraftId}
                    onClose={() => setAutotuneFor(null)}
                    onSaved={loadTakes}
                  />
                )}
              </div>
            ))}
          </div>

          {isPlaying && (
            <div className="text-[11px] text-accent2 mt-4">반주 재생 중</div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
