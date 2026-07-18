import { create } from 'zustand';
import { SECTION_TYPES, DEFAULT_MIXER, FAN_PERSONAS } from '../lib/gameData/constants';
import { emptySections, emptySection, basicPatternForLength, buildCombinedPattern } from '../lib/patterns';
import * as engine from '../lib/audio/engine';
import * as charactersApi from '../lib/api/characters';
import * as songsApi from '../lib/api/songs';

const FAN_PERSONAS_BY_ID = Object.fromEntries(FAN_PERSONAS.map((p) => [p.id, p]));

function mapCharacter(apiChar) {
  return {
    id: apiChar.id,
    artistName: apiChar.artist_name,
    backgroundId: apiChar.background_id,
    backgroundName: apiChar.background_name,
    stats: apiChar.stats,
    talent: apiChar.talent,
    fame: apiChar.fame,
    money: apiChar.money,
    fansCount: apiChar.fans_count,
    songs: [],
  };
}

// apiSong.pattern is per-section (keyed by section name) plus a separate
// structure(arrangement) array — the audio engine only plays a single
// flattened pattern, so combine them the same way the beatmaker preview does.
function mapSong(apiSong) {
  return {
    id: apiSong.id,
    title: apiSong.title,
    tier: apiSong.tier,
    score: Math.round(apiSong.overall_score),
    bpm: apiSong.bpm,
    pattern: buildCombinedPattern(apiSong.pattern, apiSong.structure),
  };
}

const initialDraft = () => ({
  title: '', genres: [], moods: [], bpm: 100, chordPresetId: 'p1', productionMode: 'beginner', vocalSource: 'self',
  sections: emptySections(), arrangement: [], editingSection: SECTION_TYPES[0],
});

export const useGameStore = create((set, get) => ({
  artistNameInput: '',
  character: null,
  characterLoaded: false,
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

  // The server resolves backgrounds (including "random"'s jitter) itself —
  // see backend/app/services/characters_service.py — so the client only
  // sends the artist name and chosen background id.
  confirmBackground: async (bg) => {
    const artistName = get().artistNameInput.trim() || '무명';
    const apiChar = await charactersApi.createCharacter(artistName, bg.id);
    set({ character: mapCharacter(apiChar) });
  },

  // Called once on app load to restore the session's character (and
  // released songs) after a refresh — see docs/mvp-plan.md DoD #1.
  loadCharacter: async () => {
    try {
      const apiChar = await charactersApi.getMyCharacter();
      const character = mapCharacter(apiChar);
      try {
        const songs = await songsApi.listMySongs();
        character.songs = songs.map(mapSong);
      } catch {
        // no songs yet, or listing failed — character itself still loaded
      }
      set({ character, characterLoaded: true });
    } catch {
      set({ character: null, characterLoaded: true });
    }
  },
  resetCharacterLoaded: () => set({ character: null, characterLoaded: false }),

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

  // Server-authoritative: the draft is saved and re-scored by
  // backend/app/services/scoring.py — see docs/server-architecture.md §3.
  // Nothing computed client-side (computeRelease.js) is trusted or sent.
  handleRelease: async () => {
    const s = get();
    if (s.isPlaying) get().stop();

    const lyrics = Object.fromEntries(Object.keys(s.draft.sections).map((k) => [k, s.draft.sections[k].lyrics]));
    const draftRow = await songsApi.createDraft({
      title: s.draft.title,
      bpm: s.draft.bpm,
      genre_tags: s.draft.genres,
      mood_tags: s.draft.moods,
      chord_preset_id: s.draft.chordPresetId,
      production_mode: s.draft.productionMode,
      vocal_source: s.draft.vocalSource,
      structure: s.draft.arrangement,
      pattern: s.draft.sections,
      lyrics,
    });
    const result = await songsApi.releaseSong(draftRow.id);
    const song = result.song;
    const combined = buildCombinedPattern(song.pattern, song.structure);

    const lastResult = {
      attributes: { craft: song.craft, originality: song.originality, accessibility: song.accessibility, experimental: song.experimental },
      breakdown: {
        reachRatio: result.breakdown.reach_ratio,
        completionRate: result.breakdown.completion_rate,
        repeatPlayRate: result.breakdown.repeat_play_rate,
        saveRate: result.breakdown.save_rate,
        shareRate: result.breakdown.share_rate,
        fanAffinityMatch: result.breakdown.fan_affinity_match,
      },
      overallScore: song.overall_score,
      tier: song.tier,
      geniusEvent: song.genius_event,
      sleeperHit: song.sleeper_hit,
      fansDelta: song.fans_delta,
      moneyDelta: song.money_delta,
      fameDelta: song.fame_delta,
      personaResults: result.reactions.map((r) => ({
        persona: FAN_PERSONAS_BY_ID[r.persona_id] || { id: r.persona_id, name: `#${r.persona_id}`, color: '#8B8496' },
        affinity: r.affinity,
        reached: r.reached,
        reactionScore: r.reaction_score,
      })),
      songTitle: song.title,
      songId: song.id,
      pattern: combined,
      bpm: song.bpm,
    };

    set((state) => ({
      character: {
        ...state.character,
        fame: result.character_fame,
        money: result.character_money,
        fansCount: result.character_fans_count,
        songs: [...state.character.songs, mapSong(song)],
      },
      lastResult,
    }));
    return lastResult;
  },

  nextSong: () => set({ draft: initialDraft() }),
}));
