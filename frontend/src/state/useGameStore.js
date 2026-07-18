import { create } from 'zustand';
import { SECTION_TYPES, DEFAULT_MIXER, FAN_PERSONAS } from '../lib/gameData/constants';
import { emptySections, emptySection, basicPatternForLength, buildCombinedPattern } from '../lib/patterns';
import * as engine from '../lib/audio/engine';
import { playStepTick, playSuccessChime } from '../lib/audio/uiSounds';
import * as charactersApi from '../lib/api/characters';
import * as songsApi from '../lib/api/songs';
import * as communityApi from '../lib/api/community';
import * as collabApi from '../lib/api/collab';

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
    totalStreams: apiChar.total_streams ?? 0,
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
  followedArtists: [],   // list of {followed_type, followed_id}
  offlineSummary: null,  // offline fan-drift / passive income since last login
  persistedDraftId: null, // set once a draft is saved server-side for collaboration

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
  // GET /characters/me also settles offline fan drift + passive income.
  loadCharacter: async () => {
    try {
      const res = await charactersApi.getMyCharacter();
      const character = mapCharacter(res.character);
      try {
        const songs = await songsApi.listMySongs();
        character.songs = songs.map(mapSong);
      } catch {
        // no songs yet, or listing failed — character itself still loaded
      }
      let followedArtists = [];
      try {
        followedArtists = await communityApi.getFollows();
      } catch {
        // ignore
      }
      set({ character, characterLoaded: true, offlineSummary: res.offline_summary || null, followedArtists });
    } catch {
      set({ character: null, characterLoaded: true });
    }
  },
  resetCharacterLoaded: () => set({ character: null, characterLoaded: false, offlineSummary: null, followedArtists: [] }),
  dismissOfflineSummary: () => set({ offlineSummary: null }),

  // Re-pull the character (money/fame/fans) after an action that changes it
  // server-side — company/concert/marketplace spending. Preserves loaded songs.
  refreshCharacter: async () => {
    try {
      const res = await charactersApi.getMyCharacter();
      set((state) => ({
        character: { ...mapCharacter(res.character), songs: state.character ? state.character.songs : [] },
      }));
    } catch {
      // ignore
    }
  },

  setDraftField: (field, value) => set((s) => ({ draft: { ...s.draft, [field]: value } })),

  toggleTag: (field, tag, max) => set((s) => {
    const list = s.draft[field];
    if (list.includes(tag)) return { draft: { ...s.draft, [field]: list.filter((t) => t !== tag) } };
    if (list.length >= max) return {};
    return { draft: { ...s.draft, [field]: [...list, tag] } };
  }),

  setEditingSection: (key) => set((s) => ({ draft: { ...s.draft, editingSection: key } })),

  toggleDrumStep: (instKey, idx) => {
    playStepTick();
    set((s) => {
      const sec = s.draft.sections[s.draft.editingSection];
      const arr = [...sec.drums[instKey]];
      arr[idx] = !arr[idx];
      return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, drums: { ...sec.drums, [instKey]: arr } } } } };
    });
  },

  setNoteStep: (track, idx, pitch) => {
    playStepTick();
    set((s) => {
      const sec = s.draft.sections[s.draft.editingSection];
      const arr = [...sec[track]];
      arr[idx] = arr[idx] === pitch ? null : pitch;
      return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, [track]: arr } } } };
    });
  },

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
  // Direct drag-and-drop reorder (Timeline.jsx) — moves the clip at fromIdx
  // to sit at toIdx, unlike moveArrangement's adjacent-swap.
  reorderArrangement: (fromIdx, toIdx) => set((s) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= s.draft.arrangement.length || toIdx >= s.draft.arrangement.length) return {};
    const arr = [...s.draft.arrangement];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    return { draft: { ...s.draft, arrangement: arr } };
  }),
  // Resize a specific section's length directly (Timeline drag-resize), not
  // necessarily the currently-editing one. length must stay a multiple of 16
  // (basicPatternForLength's tiling assumes bar-aligned lengths).
  setSectionLengthFor: (sectionKey, length) => set((s) => {
    const sec = s.draft.sections[sectionKey];
    const resize = (arr, fill) => { const out = arr.slice(0, length); while (out.length < length) out.push(fill); return out; };
    const newDrums = {};
    Object.keys(sec.drums).forEach((k) => { newDrums[k] = resize(sec.drums[k], false); });
    return {
      draft: {
        ...s.draft,
        sections: { ...s.draft.sections, [sectionKey]: { ...sec, length, drums: newDrums, bass: resize(sec.bass, null), piano: resize(sec.piano, null), guitar: resize(sec.guitar, null) } },
      },
    };
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

  // Follows are keyed by (followed_type, followed_id) and persisted server-side.
  isFollowing: (type, id) => get().followedArtists.some((f) => f.followed_type === type && f.followed_id === id),
  toggleFollow: async (type, id) => {
    const following = get().isFollowing(type, id);
    // optimistic update, then confirm with the server
    if (following) {
      set((s) => ({ followedArtists: s.followedArtists.filter((f) => !(f.followed_type === type && f.followed_id === id)) }));
      try { await communityApi.unfollow(type, id); } catch { /* revert on failure */ set((s) => ({ followedArtists: [...s.followedArtists, { followed_type: type, followed_id: id }] })); }
    } else {
      set((s) => ({ followedArtists: [...s.followedArtists, { followed_type: type, followed_id: id }] }));
      try { await communityApi.follow(type, id); } catch { set((s) => ({ followedArtists: s.followedArtists.filter((f) => !(f.followed_type === type && f.followed_id === id)) })); }
    }
  },
  setCommunityTab: (tab) => set({ communityTab: tab }),

  play: async (pattern, bpm, id) => {
    const { mixer, fx } = get();
    set({ isPlaying: true, playingId: id, currentStep: -1 });
    // queueMicrotask: Tone.Draw can invoke the very first step's callback
    // synchronously inside Transport.start() (called from this same click
    // handler), which raced with React's in-flight render of the components
    // now subscribed to currentStep (Timeline's playhead) — "Cannot update a
    // component while rendering a different component". Deferring the store
    // update by one microtask guarantees it lands after the current render.
    await engine.playPattern(pattern, bpm, mixer, fx, (idx) => queueMicrotask(() => set({ currentStep: idx })));
  },
  stop: () => {
    engine.stopPattern();
    set({ isPlaying: false, currentStep: -1, playingId: null });
  },

  // Server-authoritative: the draft is saved and re-scored by
  // backend/app/services/scoring.py — see docs/server-architecture.md §3.
  // Nothing computed client-side (computeRelease.js) is trusted or sent.
  // Save the current draft server-side (so collaborators can be invited to it)
  // and remember its id. Release reuses this id instead of creating a new draft.
  saveDraftForCollab: async () => {
    const s = get();
    if (s.persistedDraftId) return s.persistedDraftId;
    const lyrics = Object.fromEntries(Object.keys(s.draft.sections).map((k) => [k, s.draft.sections[k].lyrics]));
    const draftRow = await songsApi.createDraft({
      title: s.draft.title, bpm: s.draft.bpm, genre_tags: s.draft.genres, mood_tags: s.draft.moods,
      chord_preset_id: s.draft.chordPresetId, production_mode: s.draft.productionMode,
      vocal_source: s.draft.vocalSource, structure: s.draft.arrangement, pattern: s.draft.sections, lyrics,
    });
    set({ persistedDraftId: draftRow.id });
    return draftRow.id;
  },

  inviteCollaborator: async (inviteeCharacterId, role, contributionPct) => {
    const draftId = await get().saveDraftForCollab();
    return collabApi.invite(draftId, inviteeCharacterId, role, contributionPct);
  },

  handleRelease: async () => {
    const s = get();
    if (s.isPlaying) get().stop();

    let draftId = s.persistedDraftId;
    if (!draftId) {
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
      draftId = draftRow.id;
    }
    const result = await songsApi.releaseSong(draftId);
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
      revenueBreakdown: result.revenue_breakdown,
      newlyUnlocked: result.newly_unlocked || [],
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
      persistedDraftId: null,
    }));
    playSuccessChime();
    return lastResult;
  },

  nextSong: () => set({ draft: initialDraft(), persistedDraftId: null }),
}));
