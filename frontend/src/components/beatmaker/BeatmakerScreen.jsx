import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { CoverEditor } from '../cover/CoverEditor';
import { TopBar } from '../shared/TopBar';
import { DraftBar } from './DraftBar';
import { Timeline } from './Timeline';
import { DrumGrid } from './DrumGrid';
import { MelodicPanel, PianoPanel } from './PianoRollPanel';
import { ChannelRack } from './ChannelRack';
import { DrumMachine } from './DrumMachine';
import { EffectWindow } from './EffectWindow';
import { TransportBar } from './TransportBar';
import { PresetLibrary } from './PresetLibrary';
import { VoiceToPattern } from './VoiceToPattern';
import { VoiceInstrument } from './VoiceInstrument';
import { CollabInvitePanel } from './CollabInvitePanel';
import { CHANNELS } from '../../lib/gameData/constants';
import { buildCombinedPattern, analyzeCombinedPattern, sectionHasContent, songCombined } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';
import { SceneHero } from '../shared/SceneHero';

export function BeatmakerScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const draft = useGameStore((s) => s.draft);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const playingId = useGameStore((s) => s.playingId);
  const currentStep = useGameStore((s) => s.currentStep);
  const play = useGameStore((s) => s.play);
  const stop = useGameStore((s) => s.stop);
  const setEditingSection = useGameStore((s) => s.setEditingSection);
  const setSectionLength = useGameStore((s) => s.setSectionLength);
  const addClip = useGameStore((s) => s.addClip);
  const duplicateClip = useGameStore((s) => s.duplicateClip);
  const renameClip = useGameStore((s) => s.renameClip);
  const deleteClip = useGameStore((s) => s.deleteClip);
  const setSectionBpm = useGameStore((s) => s.setSectionBpm);
  const toggleDrumStep = useGameStore((s) => s.toggleDrumStep);
  const setDrumVelocity = useGameStore((s) => s.setDrumVelocity);
  const setDrumRatchet = useGameStore((s) => s.setDrumRatchet);
  const setSectionSwing = useGameStore((s) => s.setSectionSwing);
  const setNoteStep = useGameStore((s) => s.setNoteStep);
  const paintNoteRange = useGameStore((s) => s.paintNoteRange);
  const setVelocity = useGameStore((s) => s.setVelocity);
  const clearSection = useGameStore((s) => s.clearSection);
  const clearChannel = useGameStore((s) => s.clearChannel);
  const clearDrumLane = useGameStore((s) => s.clearDrumLane);
  const handleRelease = useGameStore((s) => s.handleRelease);
  const selectedChannel = useGameStore((s) => s.selectedChannel);
  const channelFx = useGameStore((s) => s.channelFx);
  const openPlugin = useGameStore((s) => s.openPlugin);
  const openEffectIds = useGameStore((s) => s.openEffectIds);
  const saveDraft = useGameStore((s) => s.saveDraft);
  const persistedDraftId = useGameStore((s) => s.persistedDraftId);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  const [coverSongId, setCoverSongId] = useState(null);
  const [coverSaved, setCoverSaved] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceInstOpen, setVoiceInstOpen] = useState(false);

  // The cover attaches to the song row, so an unsaved draft has to be
  // persisted first — same thing the collab invite does.
  async function openCoverEditor() {
    setReleaseError('');
    try {
      setCoverSongId(persistedDraftId || await saveDraft());
    } catch (e) {
      setReleaseError(e.message || '커버를 열기 전에 곡을 저장하지 못했습니다');
    }
  }

  if (!character) return null;

  const editingSec = draft.sections[draft.editingSection];
  // Reflect the real song — the per-instrument 편곡 timeline if the player set
  // one up, otherwise the clip arrangement.
  const combinedDraft = songCombined(draft);
  const patternInfo = analyzeCombinedPattern(combinedDraft);
  const hasStructure = draft.arrangement.length > 0 || (draft.timeline && draft.timeline.length > 0);
  const canRelease = draft.title.trim() && draft.genres.length > 0 && draft.moods.length > 0 && hasStructure && patternInfo.totalActive >= 6;

  async function onRelease() {
    if (!canRelease || releasing) return;
    setReleasing(true);
    setReleaseError('');
    try {
      await handleRelease();
      navigate('/results');
    } catch (e) {
      setReleaseError(e.message || '발매에 실패했습니다');
    } finally {
      setReleasing(false);
    }
  }

  const sectionStep = playingId === 'section-preview' ? currentStep : -1;

  function onAdjustVelocity(track, idx, delta) {
    const current = editingSec[`${track}Velocity`]?.[idx] ?? 100;
    setVelocity(track, idx, current + delta);
  }

  // Every open effect window, flattened with the channel it belongs to.
  const openEffects = Object.entries(channelFx).flatMap(([channel, list]) =>
    list.filter((e) => openEffectIds.includes(e.id)).map((effect) => ({ channel, effect }))
  );

  const channel = CHANNELS.find((c) => c.key === selectedChannel);
  const channelLabel = channel?.label || '';
  const channelIcon = channel?.icon || '';

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar character={character} />

      <div className="max-w-[1400px] w-full mx-auto px-5 pt-5 flex-1">
        <SceneHero scene="studio" title="비트 작업실" subtitle="채널을 골라 비트를 찍고, 악기와 보컬로 곡을 완성하세요." height={96} />
        <DraftBar />

        <div className="grid grid-cols-1 gap-4 items-start md:[grid-template-columns:minmax(210px,240px)_minmax(0,1fr)_minmax(190px,220px)]">
          <ChannelRack />

          <div className="min-w-0">
            <Timeline />

            <div className="me-panel mb-5">
              <div className="flex items-center justify-between flex-wrap gap-2.5 mb-3">
                <div className="flex items-baseline gap-2">
                  <span className="me-display text-lg font-extrabold">섹션 편집</span>
                  <span className="text-[11px] text-muted">— {channelLabel}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* per-section BPM — falls back to the song default (transport) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-faint">BPM</span>
                    <input
                      type="number" min={40} max={220} value={editingSec.bpm ?? draft.bpm}
                      onChange={(e) => setSectionBpm(Number(e.target.value))}
                      className="w-12 font-mono text-xs text-text px-1.5 py-1 rounded outline-none border border-border bg-transparent"
                      title={`${draft.editingSection} 구간 BPM (비우면 곡 기본 ${draft.bpm})`}
                      aria-label="구간 BPM"
                    />
                    {editingSec.bpm != null && editingSec.bpm !== draft.bpm && (
                      <button className="text-[10px] text-faint hover:text-accent2 bg-transparent border-0 cursor-pointer px-0.5"
                        onClick={() => setSectionBpm(null)} title={`곡 기본 BPM(${draft.bpm}) 따르기`}>↺</button>
                    )}
                  </div>
                  {/* Swing — delays the off-beat 16ths for a shuffled groove */}
                  <div className="flex items-center gap-1" title="짝수 칸을 살짝 밀어 스윙(셔플) 느낌을 줍니다">
                    <span className="text-[10px] font-mono text-faint">스윙</span>
                    <input
                      type="range" min={0} max={100} value={Math.round((editingSec.swing || 0) * 100)}
                      onChange={(e) => setSectionSwing(Number(e.target.value) / 100)}
                      className="me-slider" style={{ width: 64 }} aria-label="스윙"
                    />
                    <span className="text-[10px] font-mono text-faint" style={{ width: 26 }}>{Math.round((editingSec.swing || 0) * 100)}%</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[[16, '1마디'], [32, '2마디'], [64, '4마디'], [128, '8마디']].map(([len, label]) => (
                      <div key={len} className={`me-pill small ${editingSec.length === len ? 'active' : ''}`} onClick={() => setSectionLength(len)}>{label} ({len})</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clip list — every reusable building block of the song. Add,
                  duplicate (independent copy), rename or delete them freely. */}
              <div className="flex gap-1.5 flex-wrap items-center mb-4">
                {Object.keys(draft.sections).map((key) => {
                  const active = draft.editingSection === key;
                  const color = draft.sections[key].color || '#8B8496';
                  return (
                    <div key={key} className={`me-pill small ${active ? 'active' : ''}`} onClick={() => setEditingSection(key)}
                      style={active ? { borderColor: color, color } : {}}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: color, marginRight: 5, verticalAlign: 'middle' }} />
                      {key}{sectionHasContent(draft.sections[key]) ? ' ●' : ''}
                    </div>
                  );
                })}
                <div className="me-pill small" onClick={addClip} title="빈 클립을 새로 만들어요">＋ 새 클립</div>
              </div>

              {/* actions on the clip being edited */}
              <div className="flex gap-1.5 flex-wrap items-center mb-4 -mt-2">
                <span className="text-[10px] text-faint">이 클립:</span>
                <button className="me-btn-ghost !px-2 !py-1 !text-[10px]" onClick={() => duplicateClip(draft.editingSection)}
                  title="지금 클립을 그대로 복제해 독립된 새 클립을 만들어요 (벌스 A / 벌스 B)">⧉ 복제</button>
                <button className="me-btn-ghost !px-2 !py-1 !text-[10px]" onClick={() => {
                  const next = window.prompt('클립 이름 바꾸기', draft.editingSection);
                  if (next) renameClip(draft.editingSection, next);
                }} title="클립 이름 바꾸기">✎ 이름</button>
                <button className="me-btn-ghost !px-2 !py-1 !text-[10px]" disabled={Object.keys(draft.sections).length <= 1}
                  style={{ color: 'var(--color-danger)' }}
                  onClick={() => { if (window.confirm(`'${draft.editingSection}' 클립을 삭제할까요? 타임라인에서도 빠집니다.`)) deleteClip(draft.editingSection); }}
                  title="이 클립을 삭제 (타임라인에서도 제거)">🗑 클립 삭제</button>
              </div>

              {/* One instrument at a time — which one follows the channel rack
                  selection, the way clicking a channel in a DAW swaps the editor. */}
              <div className="me-scroll overflow-x-auto mb-2">
                <div style={{ minWidth: 520 }}>
                  {selectedChannel === 'drums' && (
                    <DrumGrid
                      section={editingSec} onToggle={toggleDrumStep} onClearLane={clearDrumLane}
                      onSetVelocity={setDrumVelocity} onSetRatchet={setDrumRatchet} currentStep={sectionStep}
                    />
                  )}
                  {selectedChannel !== 'drums' && selectedChannel !== 'piano' && (
                    <MelodicPanel
                      track={selectedChannel} section={editingSec} onSetNote={setNoteStep}
                      onPaintRange={paintNoteRange} onSetVelocity={setVelocity} currentStep={sectionStep}
                    />
                  )}
                  {selectedChannel === 'piano' && (
                    <PianoPanel
                      section={editingSec} onSetNote={setNoteStep} onPaintRange={paintNoteRange}
                      onAdjustVelocity={onAdjustVelocity} currentStep={sectionStep}
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                <button
                  className="me-btn-ghost"
                  onClick={() => (isPlaying && playingId === 'section-preview') ? stop() : play(buildCombinedPattern(draft.sections, [draft.editingSection], draft.bpm), draft.bpm, 'section-preview')}
                >
                  {(isPlaying && playingId === 'section-preview') ? '■ 정지' : `▶ ${draft.editingSection} 미리듣기`}
                </button>
                <button
                  className="me-btn-ghost"
                  onClick={() => clearChannel(selectedChannel)}
                  title={`${draft.editingSection} 구간의 ${channelLabel} 파트만 지웁니다`}
                >
                  {channelIcon} {channelLabel} 지우기
                </button>
                {/* Destructive "wipe the whole section" — pushed to the far
                    right, away from the play/load buttons, and behind a confirm
                    so it can't be triggered by an accidental click. */}
                <button
                  className="me-btn-ghost ml-auto inline-flex items-center gap-1 opacity-70 hover:opacity-100"
                  style={{ color: 'var(--color-danger)' }}
                  onClick={() => {
                    if (window.confirm(`${draft.editingSection} 구간의 모든 악기를 지울까요?\n(가사는 남습니다. 되돌릴 수 없어요.)`)) clearSection();
                  }}
                  title={`${draft.editingSection} 구간의 모든 악기를 지웁니다 (가사는 남습니다)`}
                >
                  <Trash2 size={13} /> 전체 지우기
                </button>
              </div>
            </div>

            <CollabInvitePanel />

            <div className="me-panel flex justify-between items-center flex-wrap gap-3 mb-5">
              <div className="text-[11px]" style={{ color: releaseError ? '#C4576B' : canRelease ? '#4FD1C5' : '#C4576B' }}>
                {releaseError ? releaseError :
                  draft.arrangement.length === 0 ? '곡 구조에 섹션을 최소 1개 이상 추가하세요' :
                  patternInfo.totalActive < 6 ? `최소 6칸 이상 입력해야 발매할 수 있어요 (현재 ${patternInfo.totalActive}개)` :
                  `${patternInfo.totalActive}개 스텝 · ${draft.arrangement.length}개 섹션 구성 완료`}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button className="me-btn-ghost inline-flex items-center gap-1.5" onClick={openCoverEditor}>
                  <ImageIcon size={13} /> {coverSaved ? '커버 다시 그리기' : '앨범 커버 만들기'}
                </button>
                <button className="me-btn-primary" onClick={onRelease} disabled={!canRelease || releasing}>
                  {releasing ? '발매 중...' : '곡 발매하기'}
                </button>
              </div>
            </div>
          </div>

          <PresetLibrary onOpenVoice={() => setVoiceOpen(true)} onOpenVoiceInstrument={() => setVoiceInstOpen(true)} />
        </div>
      </div>

      <TransportBar />

      {openPlugin === 'drums' && <DrumMachine />}
      {openEffects.map(({ channel, effect }, i) => (
        <EffectWindow key={effect.id} channel={channel} effect={effect} index={i} />
      ))}
      {voiceOpen && <VoiceToPattern onClose={() => setVoiceOpen(false)} />}
      {voiceInstOpen && <VoiceInstrument onClose={() => setVoiceInstOpen(false)} />}
      {coverSongId && (
        <CoverEditor
          songId={coverSongId}
          songTitle={draft.title}
          onClose={() => setCoverSongId(null)}
          onSaved={() => setCoverSaved(true)}
        />
      )}
    </div>
  );
}
