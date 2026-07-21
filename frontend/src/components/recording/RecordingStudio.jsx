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
import { buildCombinedPattern } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

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
      // Optionally play the instrumental so the take is sung in time with it.
      if (withBeat && draft.arrangement.length > 0) {
        await play(buildCombinedPattern(draft.sections, draft.arrangement), draft.bpm, 'recording-backing');
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
      await recordingsApi.uploadRecording({
        blob, mimeType, durationSec, songId,
        title: title.trim() || `테이크 ${new Date().toLocaleTimeString('ko-KR')}`,
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
        await play(buildCombinedPattern(draft.sections, draft.arrangement), draft.bpm, 'recording-backing');
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
      await recordingsApi.attachRecording(take.id, songId);
      await loadTakes();
    } catch (e) {
      setError(e.message || '연결에 실패했습니다');
    } finally { setBusy(false); }
  }

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
            ① <b className="text-text">반주와 함께</b> 켠 채로 녹음하면 비트에 맞춰 노래할 수 있어요.
            ② 마음에 드는 테이크의 <b className="text-accent2">곡에 넣기</b> 버튼을 누르면 지금 작업 중인 곡에 목소리가 얹혀요.
            ③ 그 뒤로는 스튜디오·커뮤니티·차트 어디서 곡을 재생하든 <b className="text-text">비트와 목소리가 같이</b> 들립니다.
          </div>

          {!supported && (
            <Panel className="mb-5 border-danger/50">
              <div className="text-sm text-danger">이 브라우저는 마이크 녹음을 지원하지 않습니다. 최신 Chrome/Edge에서 열어주세요.</div>
            </Panel>
          )}
          {error && <div className="text-danger text-xs mb-4">{error}</div>}

          <Panel className="mb-6">
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
                {recording ? <><Square size={15} /> 정지</> : <><Mic size={15} /> 녹음 시작</>}
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

          <div className="text-sm font-bold text-muted mb-3 flex items-center gap-2">
            <Music2 size={14} /> 저장된 테이크
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
                    <div className="text-sm font-semibold truncate">{t.title}</div>
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
