import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
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
import { CollabInvitePanel } from './CollabInvitePanel';
import { SECTION_TYPES, CHANNELS } from '../../lib/gameData/constants';
import { buildCombinedPattern, analyzeCombinedPattern, sectionHasContent } from '../../lib/patterns';
import { useGameStore } from '../../state/useGameStore';

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
  const toggleDrumStep = useGameStore((s) => s.toggleDrumStep);
  const setNoteStep = useGameStore((s) => s.setNoteStep);
  const paintNoteRange = useGameStore((s) => s.paintNoteRange);
  const setVelocity = useGameStore((s) => s.setVelocity);
  const setLyrics = useGameStore((s) => s.setLyrics);
  const loadBasicPattern = useGameStore((s) => s.loadBasicPattern);
  const clearSection = useGameStore((s) => s.clearSection);
  const handleRelease = useGameStore((s) => s.handleRelease);
  const selectedChannel = useGameStore((s) => s.selectedChannel);
  const channelFx = useGameStore((s) => s.channelFx);
  const openPlugin = useGameStore((s) => s.openPlugin);
  const openEffectIds = useGameStore((s) => s.openEffectIds);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  if (!character) return null;

  const editingSec = draft.sections[draft.editingSection];
  const combinedDraft = buildCombinedPattern(draft.sections, draft.arrangement);
  const patternInfo = analyzeCombinedPattern(combinedDraft);
  const canRelease = draft.title.trim() && draft.genres.length > 0 && draft.moods.length > 0 && draft.arrangement.length > 0 && patternInfo.totalActive >= 6;

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

  const channelLabel = CHANNELS.find((c) => c.key === selectedChannel)?.label || '';

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar character={character} />

      <div className="max-w-[1400px] w-full mx-auto px-5 pt-5 flex-1">
        <DraftBar />

        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: 'minmax(210px, 240px) minmax(0, 1fr) minmax(190px, 220px)' }}>
          <ChannelRack />

          <div className="min-w-0">
            <Timeline />

            <div className="me-panel mb-5">
              <div className="flex items-center justify-between flex-wrap gap-2.5 mb-3">
                <div className="flex items-baseline gap-2">
                  <span className="me-display text-lg font-extrabold">섹션 편집</span>
                  <span className="text-[11px] text-muted">— {channelLabel}</span>
                </div>
                <div className="flex gap-1.5">
                  <div className={`me-pill small ${editingSec.length === 16 ? 'active' : ''}`} onClick={() => setSectionLength(16)}>1마디 (16)</div>
                  <div className={`me-pill small ${editingSec.length === 32 ? 'active' : ''}`} onClick={() => setSectionLength(32)}>2마디 (32)</div>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap mb-4">
                {SECTION_TYPES.map((t) => (
                  <div key={t} className={`me-pill small ${draft.editingSection === t ? 'active' : ''}`} onClick={() => setEditingSection(t)}>
                    {t}{sectionHasContent(draft.sections[t]) ? ' ●' : ''}
                  </div>
                ))}
              </div>

              {/* One instrument at a time — which one follows the channel rack
                  selection, the way clicking a channel in a DAW swaps the editor. */}
              <div className="me-scroll overflow-x-auto mb-2">
                <div style={{ minWidth: 520 }}>
                  {selectedChannel === 'drums' && <DrumGrid section={editingSec} onToggle={toggleDrumStep} currentStep={sectionStep} />}
                  {(selectedChannel === 'bass' || selectedChannel === 'guitar') && (
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

              <div className="flex gap-2 flex-wrap">
                <button className="me-btn-ghost" onClick={loadBasicPattern}>기본 패턴 불러오기</button>
                <button className="me-btn-ghost" onClick={clearSection}>이 섹션 지우기</button>
                <button
                  className="me-btn-ghost"
                  onClick={() => (isPlaying && playingId === 'section-preview') ? stop() : play(buildCombinedPattern(draft.sections, [draft.editingSection]), draft.bpm, 'section-preview')}
                >
                  {(isPlaying && playingId === 'section-preview') ? '■ 정지' : `▶ ${draft.editingSection} 미리듣기`}
                </button>
              </div>
            </div>

            <div className="me-panel mb-5">
              <div className="me-display text-lg font-extrabold mb-1 flex items-center gap-2">
                <FileText size={18} style={{ color: '#E893A6' }} /> 가사 노트 — {draft.editingSection}
              </div>
              <div className="text-[11px] text-muted mb-3">섹션을 바꾸려면 위 "섹션 편집" 탭을 클릭하세요.</div>
              <div className="me-notebook">
                <textarea value={editingSec.lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="가사를 적어보세요..." />
              </div>
              <div className="text-[10px] text-faint mt-2">
                {editingSec.lyrics.trim() ? `${editingSec.lyrics.trim().split(/\s+/).length}단어` : '아직 가사가 없어요'} · 완성도에 소폭 반영돼요
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
              <button className="me-btn-primary" onClick={onRelease} disabled={!canRelease || releasing}>
                {releasing ? '발매 중...' : '곡 발매하기'}
              </button>
            </div>
          </div>

          <PresetLibrary />
        </div>
      </div>

      <TransportBar />

      {openPlugin === 'drums' && <DrumMachine />}
      {openEffects.map(({ channel, effect }, i) => (
        <EffectWindow key={effect.id} channel={channel} effect={effect} index={i} />
      ))}
    </div>
  );
}
