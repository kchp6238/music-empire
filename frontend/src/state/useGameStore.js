import { create } from 'zustand';
import { clamp } from '../lib/utils';
import { SECTION_TYPES, DEFAULT_MIXER, FAN_PERSONAS, makeRandomBackground } from '../lib/gameData/constants';
import { emptySections, emptySection, basicPatternForLength, buildCombinedPattern } from '../lib/patterns';
import { computeRelease } from '../lib/scoring/computeRelease';
import * as engine from '../lib/audio/engine';

const initialDraft = () => ({
  title: '', genres: [], moods: [], bpm: 100, chordPresetId: 'p1', productionMode: 'beginner', vocalSource: 'self',
  sections: emptySections(), arrangement: [], editingSection: SECTION_TYPES[0],
});

export const useGameStore = create((set, get) => ({
  artistNameInput: '',
  character: null,
  draft: initialDraft(),
  mixer: DEFAULT_MIXER,
  fx: { reverbWet: 20, delayWet: 15 },
  lastResult: null,
  isPlaying: false,
  currentStep: -1,
  playingId: null,
  communityTab: 'feed',
  followedArtists: [],

  setArtistNameInput: (v) => set({ artistNameInput: v }),

  confirmBackground: (bg) => {
    const resolved = bg.id === 'random' ? makeRandomBackground() : bg;
    set({
      character: {
        artistName: get().artistNameInput.trim() || '무명',
        backgroundId: resolved.id, backgroundName: resolved.name,
        stats: { ...resolved.stats }, talent: { ...resolved.talent },
        fame: resolved.fame, money: resolved.money,
        fansCount: Math.round(resolved.fame * 8 + 30),
        songs: [], personaLoyalty: Object.fromEntries(FAN_PERSONAS.map((p) => [p.id, 0])),
      },
    });
  },

  setDraftField: (field, value) => set((s) => ({ draft: { ...s.draft, [field]: value } })),

  toggleTag: (field, tag, max) => set((s) => {
    const list = s.draft[field];
    if (list.includes(tag)) return { draft: { ...s.draft, [field]: list.filter((t) => t !== tag) } };
    if (list.length >= max) return {};
    return { draft: { ...s.draft, [field]: [...list, tag] } };
  }),

  setEditingSection: (key) => set((s) => ({ draft: { ...s.draft, editingSection: key } })),

  toggleDrumStep: (instKey, idx) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const arr = [...sec.drums[instKey]];
    arr[idx] = !arr[idx];
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, drums: { ...sec.drums, [instKey]: arr } } } } };
  }),

  setNoteStep: (track, idx, pitch) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const arr = [...sec[track]];
    arr[idx] = arr[idx] === pitch ? null : pitch;
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, [track]: arr } } } };
  }),

  setLyrics: (text) => set((s) => ({
    draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...s.draft.sections[s.draft.editingSection], lyrics: text } } },
  })),

  setSectionLength: (length) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const resize = (arr, fill) => { const out = arr.slice(0, length); while (out.length < length) out.push(fill); return out; };
    const newDrums = {};
    Object.keys(sec.drums).forEach((k) => { newDrums[k] = resize(sec.drums[k], false); });
    return {
      draft: {
        ...s.draft,
        sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, length, drums: newDrums, bass: resize(sec.bass, null), piano: resize(sec.piano, null), guitar: resize(sec.guitar, null) } },
      },
    };
  }),

  loadBasicPattern: () => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const loaded = basicPatternForLength(sec.length);
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...loaded, lyrics: sec.lyrics } } } };
  }),

  clearSection: () => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const cleared = emptySection(sec.length);
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...cleared, lyrics: sec.lyrics } } } };
  }),

  addToArrangement: (type) => set((s) => ({ draft: { ...s.draft, arrangement: [...s.draft.arrangement, type], editingSection: type } })),
  removeFromArrangement: (idx) => set((s) => ({ draft: { ...s.draft, arrangement: s.draft.arrangement.filter((_, i) => i !== idx) } })),
  moveArrangement: (idx, dir) => set((s) => {
    const arr = [...s.draft.arrangement];
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return {};
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    return { draft: { ...s.draft, arrangement: arr } };
  }),

  setMixerVol: (key, v) => set((s) => {
    const mixer = { ...s.mixer, [key]: { ...s.mixer[key], vol: v } };
    engine.updateMixer(mixer);
    return { mixer };
  }),
  toggleMute: (key) => set((s) => {
    const mixer = { ...s.mixer, [key]: { ...s.mixer[key], mute: !s.mixer[key].mute } };
    engine.updateMixer(mixer);
    return { mixer };
  }),
  setFx: (field, v) => set((s) => {
    const fx = { ...s.fx, [field]: v };
    engine.updateFx(fx);
    return { fx };
  }),

  toggleFollow: (id) => set((s) => ({
    followedArtists: s.followedArtists.includes(id) ? s.followedArtists.filter((x) => x !== id) : [...s.followedArtists, id],
  })),
  setCommunityTab: (tab) => set({ communityTab: tab }),

  play: async (pattern, bpm, id) => {
    const { mixer, fx } = get();
    set({ isPlaying: true, playingId: id, currentStep: -1 });
    await engine.playPattern(pattern, bpm, mixer, fx, (idx) => set({ currentStep: idx }));
  },
  stop: () => {
    engine.stopPattern();
    set({ isPlaying: false, currentStep: -1, playingId: null });
  },

  handleRelease: () => {
    const s = get();
    if (s.isPlaying) get().stop();
    const combined = buildCombinedPattern(s.draft.sections, s.draft.arrangement);
    const result = computeRelease(s.character, s.draft, combined);
    const songId = Date.now();
    const songRecord = { id: songId, title: s.draft.title, tier: result.tier, score: Math.round(result.overallScore), pattern: combined, bpm: s.draft.bpm };
    set({
      character: {
        ...s.character,
        fame: clamp(s.character.fame + result.fameDelta, 0, 100),
        money: Math.max(0, s.character.money + result.moneyDelta),
        fansCount: Math.max(0, s.character.fansCount + result.fansDelta),
        songs: [...s.character.songs, songRecord],
        personaLoyalty: result.newLoyalty,
      },
      lastResult: { ...result, songTitle: s.draft.title, songId, pattern: combined, bpm: s.draft.bpm },
    });
    return result;
  },

  nextSong: () => set({ draft: initialDraft() }),
}));
