import { create } from 'zustand';
import {
  SECTION_TYPES, DEFAULT_MIXER, FAN_PERSONAS, EFFECT_TYPES, DEFAULT_DRUM_PARAMS,
  DEFAULT_CHANNEL_MIX, DRUM_INSTRUMENTS, PRESET_STEP_LENGTH, CHANNEL_KEYS, MELODIC_KEYS,
  GENRE_PROFILES, CLIP_PALETTE,
} from '../lib/gameData/constants';
import { emptySections, emptySection, basicPatternForLength, buildCombinedPattern, assembleTimeline, songCombined, bakeTimeline, cellPitches } from '../lib/patterns';
import * as engine from '../lib/audio/engine';
import { playSuccessChime } from '../lib/audio/uiSounds';
import * as charactersApi from '../lib/api/characters';
import * as songsApi from '../lib/api/songs';
import * as albumsApi from '../lib/api/albums';
import * as communityApi from '../lib/api/community';
import * as collabApi from '../lib/api/collab';
import * as recordingsApi from '../lib/api/recordings';
import { setActiveCharacterId, getActiveCharacterId } from '../lib/api/client';
import * as timeApi from '../lib/api/time';

const FAN_PERSONAS_BY_ID = Object.fromEntries(FAN_PERSONAS.map((p) => [p.id, p]));

// The vocal takes currently layered over a playing beat (a harmony stack can be
// several at once), the timers that bring section takes in at the right moment,
// and a per-recording cache of object URLs so replaying doesn't re-download.
// Module-level (not store state) — they're playback plumbing, not UI.
let vocalAudios = [];
let vocalTimers = [];
const vocalUrlCache = new Map();
// The last thing sent to play(), so seek() can restart it from a new step.
let lastPlay = null;

// Normalize a vocals list (API snake_case or local camelCase) to {recordingId,
// offsetSec}; also accepts a bare recording-id string for the old single-take
// callers. Returns [] for null/empty.
function normalizeVocals(vocals) {
  if (!vocals) return [];
  const arr = Array.isArray(vocals) ? vocals : [vocals];
  return arr
    .map((v) => (typeof v === 'string'
      ? { recordingId: v, offsetSec: 0 }
      : { recordingId: v.recordingId ?? v.recording_id, offsetSec: v.offsetSec ?? v.offset_sec ?? 0 }))
    .filter((v) => v.recordingId);
}

function stopVocals() {
  vocalTimers.forEach((t) => clearTimeout(t));
  vocalTimers = [];
  vocalAudios.forEach((el) => { try { el.pause(); } catch { /* already gone */ } });
  vocalAudios = [];
}

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
    gameDate: apiChar.game_date,
    age: apiChar.age,
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
    vocalRecordingId: apiSong.vocal_recording_id || null,
    vocals: apiSong.vocals || [],
    views: apiSong.views || 0,
    pattern: buildCombinedPattern(apiSong.pattern, apiSong.structure, apiSong.bpm),
  };
}

const initialDraft = () => ({
  title: '', genres: [], moods: [], bpm: 100, chordPresetId: 'p1', productionMode: 'beginner', vocalSource: 'self',
  sections: emptySections(), arrangement: [], editingSection: SECTION_TYPES[0],
  timeline: [], // per-instrument DAW arrangement (편곡 screen); [] = use the clip sequence
});

const emptyChannelFx = () => Object.fromEntries(CHANNEL_KEYS.map((k) => [k, []]));
const defaultDrumParams = () => structuredClone(DEFAULT_DRUM_PARAMS);
const defaultChannelMix = () => structuredClone(DEFAULT_CHANNEL_MIX);
const defaultMix = () => ({
  mixer: DEFAULT_MIXER, fx: { humanize: false }, channelMix: defaultChannelMix(),
  channelFx: emptyChannelFx(), drumParams: defaultDrumParams(), drumKitId: 'basic',
});

// Sound design (faders, per-channel effects, drum tuning) rides along inside
// the pattern JSON under a reserved key rather than getting its own columns.
// Song.pattern is an opaque JSON blob server-side and
// services/patterns.py::build_combined_pattern only ever looks up the keys
// named in `structure`, so this round-trips untouched with zero backend
// change — and without it a carefully tuned kit would evaporate on reload.
const MIX_KEY = '_mix';

// Editor draft -> API payload. Single source of truth for the shape, shared by
// manual save, collab draft-persist, and release.
function buildDraftPayload(draft, audio) {
  // A timeline-arranged song bakes into a single synthetic clip so the backend
  // scores the exact assembled arrangement with no backend change; the raw
  // timeline rides along under _timeline so it can be re-edited on load.
  const usesTimeline = draft.timeline && draft.timeline.length > 0;
  const baked = usesTimeline ? bakeTimeline(draft.sections, draft.timeline) : null;
  const patternSections = baked ? baked.sections : draft.sections;
  return {
    title: draft.title,
    bpm: draft.bpm,
    genre_tags: draft.genres,
    mood_tags: draft.moods,
    chord_preset_id: draft.chordPresetId,
    production_mode: draft.productionMode,
    vocal_source: draft.vocalSource,
    structure: baked ? baked.structure : draft.arrangement,
    pattern: { ...patternSections, [MIX_KEY]: audio, ...(usesTimeline ? { _timeline: draft.timeline } : {}) },
    lyrics: Object.fromEntries(Object.keys(draft.sections).map((k) => [k, draft.sections[k].lyrics])),
  };
}

// Reads the mix blob back out, tolerating its absence — drafts saved before
// this existed (and any pattern the server reconstructs) simply get defaults.
function readMixFromPattern(pattern) {
  const saved = pattern?.[MIX_KEY] || {};
  return {
    mixer: { ...DEFAULT_MIXER, ...(saved.mixer || {}) },
    fx: { humanize: false, ...(saved.fx || {}) },
    channelMix: { ...defaultChannelMix(), ...(saved.channelMix || {}) },
    channelFx: { ...emptyChannelFx(), ...(saved.channelFx || {}) },
    drumParams: { ...defaultDrumParams(), ...(saved.drumParams || {}) },
    drumKitId: saved.drumKitId || 'basic',
  };
}

// API song -> editor draft. Merges onto a fresh emptySections() so a draft
// saved before a section/field existed still loads with every lane present.
function mapApiSongToDraft(apiSong) {
  const sections = emptySections();
  // Custom clips: keep every clip in the saved pattern, not just the default
  // five — a clip named "벌스 B" must survive a reload. Skip the reserved _mix
  // blob, which rides in the same object but isn't a clip.
  const timeline = apiSong.pattern?._timeline || [];
  Object.entries(apiSong.pattern || {}).forEach(([key, sec]) => {
    // reserved keys: mix blob, baked song clip, raw timeline — never clips
    if (key === MIX_KEY || key === '_song' || key === '_timeline') return;
    const base = sections[key] || emptySection((sec.bass || []).length || 16);
    sections[key] = { ...base, ...sec };
  });
  Object.entries(apiSong.lyrics || {}).forEach(([key, text]) => {
    if (sections[key]) sections[key] = { ...sections[key], lyrics: text || '' };
  });
  // Backfill a color for any clip that predates per-clip colors.
  Object.keys(sections).forEach((k, i) => { if (!sections[k].color) sections[k].color = CLIP_PALETTE[i % CLIP_PALETTE.length]; });
  // A timeline song stores its real order in _timeline; the baked '_song' key is
  // scoring-only, so it never appears as a clip in the arrangement.
  const arrangement = (apiSong.structure || []).filter((k) => k !== '_song');
  return {
    title: apiSong.title || '',
    genres: apiSong.genre_tags || [],
    moods: apiSong.mood_tags || [],
    bpm: apiSong.bpm || 100,
    chordPresetId: apiSong.chord_preset_id || 'p1',
    productionMode: apiSong.production_mode || 'beginner',
    vocalSource: apiSong.vocal_source || 'self',
    sections,
    arrangement,
    timeline,
    editingSection: arrangement[0] || SECTION_TYPES[0],
  };
}

// A short unique id for a timeline placement — stable across moves/resizes.
let _pidSeq = 0;
const pid = () => `p${Date.now().toString(36)}${(_pidSeq++).toString(36)}`;

// Which instrument lanes a clip actually plays — one placement per lane, so
// each instrument can then be moved independently on the timeline.
function clipTracks(sec) {
  const tracks = [];
  if (DRUM_INSTRUMENTS.some((di) => sec.drums[di.key].some(Boolean))) tracks.push('drums');
  MELODIC_KEYS.forEach((k) => { if ((sec[k] || []).some((c) => cellPitches(c).length > 0)) tracks.push(k); });
  return tracks;
}
const clipBars = (sec) => Math.max(1, Math.ceil(((sec.bass || []).length || 16) / 16));

export const useGameStore = create((set, get) => ({
  artistNameInput: '',
  character: null,
  characterLoaded: false,
  draft: initialDraft(),
  mixer: DEFAULT_MIXER,
  // reverb/delay used to live here as two global sends; they're per-channel
  // insert effects now (channelFx), so only playback-time jitter remains.
  fx: { humanize: false },
  channelMix: defaultChannelMix(),
  channelFx: emptyChannelFx(),
  drumParams: defaultDrumParams(),
  drumKitId: 'basic',
  selectedChannel: 'drums',
  openPlugin: null,        // 'drums' when the DrumMachine window is open
  openEffectIds: [],       // effect ids whose windows are open
  lastResult: null,
  isPlaying: false,
  currentStep: -1,
  playingId: null,
  playingTotal: 0,     // total steps of the currently playing pattern (for the progress bar)
  playingLabel: '',    // "artist — title" of what's playing, shown in the now-playing bar
  vocalSampleInfo: null, // { baseNote, duration } of the recorded 내 목소리 instrument (session-only)
  communityTab: 'feed',
  followedArtists: [],   // list of {followed_type, followed_id}
  albums: [],            // released albums/EPs (from /albums)
  persistedDraftId: null, // server id of the open draft (set on first save/load)
  draftSavedAt: null,     // timestamp of the last successful save, for the UI indicator
  lastTimeSummary: null,  // what happened during the most recent timed action

  setArtistNameInput: (v) => set({ artistNameInput: v }),

  // The server resolves backgrounds (including "random"'s jitter) itself —
  // see backend/app/services/characters_service.py — so the client only
  // sends the artist name and chosen background id.
  // Which save is being created/played. Set by the world-select screen before
  // routing into the game, so createCharacter/loadCharacter know the world and
  // every request carries the save's character id.
  activeWorldId: null,
  selectSave: (worldId, characterId) => {
    setActiveCharacterId(characterId || null);
    set({ activeWorldId: worldId || null });
  },

  confirmBackground: async (bg) => {
    const artistName = get().artistNameInput.trim() || '무명';
    const apiChar = await charactersApi.createCharacter(artistName, bg.id, get().activeWorldId);
    // The new character is now this session's active save.
    setActiveCharacterId(apiChar.id);
    set({ character: mapCharacter(apiChar) });
  },

  // Called once on app load to restore the session's character (and
  // released songs) after a refresh — see docs/mvp-plan.md DoD #1.
  // Loading no longer advances anything: the in-game calendar only moves on
  // player actions (backend services/time_service.py).
  loadCharacter: async () => {
    // No save chosen yet — the world-select screen decides where to go.
    if (!getActiveCharacterId()) {
      set({ character: null, characterLoaded: true });
      return;
    }
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
      let albums = [];
      try {
        albums = await albumsApi.listAlbums();
      } catch {
        // ignore
      }
      set({ character, characterLoaded: true, followedArtists, albums });
    } catch {
      set({ character: null, characterLoaded: true });
    }
  },
  loadAlbums: async () => {
    try { set({ albums: await albumsApi.listAlbums() }); } catch { /* ignore */ }
  },
  // Bundling songs into an album grants a fame/money/fans bonus server-side, so
  // reload the character (which also refreshes the album list) afterwards.
  createAlbum: async (payload) => {
    const album = await albumsApi.createAlbum(payload);
    await get().loadCharacter();
    return album;
  },

  resetCharacterLoaded: () => set({ character: null, characterLoaded: false, lastTimeSummary: null, followedArtists: [], albums: [] }),

  // Leave the current save and return to save selection — no reload needed.
  switchSave: () => {
    if (get().isPlaying) get().stop();
    setActiveCharacterId(null);
    set({ character: null, characterLoaded: true, activeWorldId: null, lastTimeSummary: null, followedArtists: [] });
  },

  // Timed actions: the server moves the in-game calendar and reports what
  // happened in the gap (fans, income, weeks/seasons settled). Both refresh
  // the character from the response rather than re-fetching.
  trainStat: async (stat) => {
    const res = await timeApi.train(stat);
    set((s) => ({
      character: { ...mapCharacter(res.character), songs: s.character ? s.character.songs : [] },
      lastTimeSummary: { ...res.time, message: res.message },
    }));
    return res;
  },

  restWeek: async () => {
    const res = await timeApi.rest();
    set((s) => ({
      character: { ...mapCharacter(res.character), songs: s.character ? s.character.songs : [] },
      lastTimeSummary: { ...res.time, message: res.message },
    }));
    return res;
  },

  dismissTimeSummary: () => set({ lastTimeSummary: null }),

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

  // Apply the first selected genre's conventions — BPM, signature moods and a
  // fitting chord progression — as a starting point so a 발라드 comes out slow
  // and soft, a 힙합 beat-forward, etc.
  applyGenrePreset: () => set((s) => {
    const g = s.draft.genres[0];
    const p = GENRE_PROFILES[g];
    if (!p) return {};
    return { draft: { ...s.draft, bpm: p.bpm, moods: p.moods.slice(0, 2), chordPresetId: p.chordPresetId } };
  }),

  setEditingSection: (key) => set((s) => ({ draft: { ...s.draft, editingSection: key } })),

  // The grids audition the real instrument on mousedown (see DrumRow /
  // PianoRoll), so these no longer fire the generic UI tick — hearing the
  // actual kick or the actual note is the whole point of the feedback.
  toggleDrumStep: (instKey, idx) => {
    set((s) => {
      const sec = s.draft.sections[s.draft.editingSection];
      const arr = [...sec.drums[instKey]];
      arr[idx] = !arr[idx];
      return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, drums: { ...sec.drums, [instKey]: arr } } } } };
    });
  },

  // Single-cell click: toggle. Used by PianoRoll/PianoKeyRoll's plain click
  // (no drag) — see paintNoteRange for the multi-step drag gesture.
  // Single click toggles ONE pitch in the step's chord — so clicking several
  // rows in the same column stacks them into a chord (두 음 동시에). A click is
  // a DISCRETE hit: retrig[idx]=true keeps it from merging into a neighbour, so
  // clicking three cells one-by-one plays 띵띵띵, not one long 띵~~~.
  setNoteStep: (track, idx, pitch) => {
    set((s) => {
      const sec = s.draft.sections[s.draft.editingSection];
      const arr = [...sec[track]];
      const velArr = [...sec[`${track}Velocity`]];
      const retArr = [...(sec[`${track}Retrig`] || Array(arr.length).fill(false))];
      const cur = cellPitches(arr[idx]);
      const has = cur.includes(pitch);
      const next = has ? cur.filter((p) => p !== pitch) : [...cur, pitch];
      arr[idx] = next.length ? next : null;
      if (!has) { retArr[idx] = true; if (cur.length === 0) velArr[idx] = 100; }
      else if (!next.length) retArr[idx] = false;
      return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, [track]: arr, [`${track}Velocity`]: velArr, [`${track}Retrig`]: retArr } } } };
    });
  },

  // Drag-paint (PianoRoll/PianoKeyRoll): lays one pitch across a run of steps as
  // ONE held note (띵~~~) — retrig=false across the range so engine.js merges it
  // into a single sustained trigger. Adds the pitch (keeping others in the
  // cell), so a held line can sit inside a chord.
  paintNoteRange: (track, fromIdx, toIdx, pitch) => {
    set((s) => {
      const sec = s.draft.sections[s.draft.editingSection];
      const arr = [...sec[track]];
      const velArr = [...sec[`${track}Velocity`]];
      const retArr = [...(sec[`${track}Retrig`] || Array(arr.length).fill(false))];
      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      for (let i = lo; i <= hi; i++) {
        const cur = cellPitches(arr[i]);
        if (!cur.includes(pitch)) arr[i] = [...cur, pitch];
        if (cur.length === 0) velArr[i] = 100;
        retArr[i] = false; // held note, no retrigger
      }
      return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, [track]: arr, [`${track}Velocity`]: velArr, [`${track}Retrig`]: retArr } } } };
    });
  },

  // Flip a single note between 또박또박(separate hit) and 길게(merge with its
  // neighbour) — right-clicking a note calls this, so both can be mixed freely
  // in one part and any note changed after the fact.
  toggleCellRetrig: (track, idx) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const len = (sec[track] || []).length;
    const retArr = [...(sec[`${track}Retrig`] || Array(len).fill(false))];
    retArr[idx] = !retArr[idx];
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, [`${track}Retrig`]: retArr } } } };
  }),

  setVelocity: (track, idx, velocity) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const velArr = [...sec[`${track}Velocity`]];
    velArr[idx] = Math.round(Math.max(1, Math.min(127, velocity)));
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, [`${track}Velocity`]: velArr } } } };
  }),

  // --- per-cell drum expression: velocity (세기), ratchet/roll (롤), swing ---
  // Stored as optional sparse objects on the section (drumVel/drumRatchet keyed
  // by drum lane); buildCombinedPattern normalises length, so these never need
  // resizing when the section length changes. swing is a single 0..1 groove
  // amount per section (engine delays the off-beat 16ths by up to half a step).
  setDrumVelocity: (drumKey, idx, velocity) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const len = sec.drums[drumKey].length;
    const vel = { ...(sec.drumVel || {}) };
    const arr = vel[drumKey] ? [...vel[drumKey]] : Array(len).fill(100);
    arr[idx] = Math.round(Math.max(1, Math.min(127, velocity)));
    vel[drumKey] = arr;
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, drumVel: vel } } } };
  }),

  setDrumRatchet: (drumKey, idx, ratchet) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const len = sec.drums[drumKey].length;
    const rat = { ...(sec.drumRatchet || {}) };
    const arr = rat[drumKey] ? [...rat[drumKey]] : Array(len).fill(1);
    arr[idx] = Math.max(1, Math.min(4, Math.round(ratchet)));
    rat[drumKey] = arr;
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, drumRatchet: rat } } } };
  }),

  setSectionSwing: (swing) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...sec, swing: Math.max(0, Math.min(1, swing)) } } } };
  }),

  /** Lyrics live in the recording studio, which shows the whole song at once
   *  — so writes are addressed by section name rather than via
   *  `editingSection` (a beatmaker concept the studio has no notion of). */
  setLyricsFor: (key, text) => set((s) => {
    if (!s.draft.sections[key]) return {};
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [key]: { ...s.draft.sections[key], lyrics: text } } } };
  }),

  // Per-section tempo. null clears it so the section follows the song's default
  // BPM again. A section that keeps its own bpm plays at that tempo, and the
  // combined-pattern player switches tempo at section boundaries.
  setSectionBpm: (bpm) => set((s) => {
    const key = s.draft.editingSection;
    const sec = { ...s.draft.sections[key] };
    if (bpm == null) delete sec.bpm;
    else sec.bpm = Math.max(40, Math.min(220, Math.round(bpm) || s.draft.bpm));
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [key]: sec } } };
  }),

  setSectionLength: (length) => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const resize = (arr, fill) => { const out = arr.slice(0, length); while (out.length < length) out.push(fill); return out; };
    const newDrums = {};
    Object.keys(sec.drums).forEach((k) => { newDrums[k] = resize(sec.drums[k], false); });
    const resized = { ...sec, length, drums: newDrums };
    MELODIC_KEYS.forEach((k) => {
      resized[k] = resize(sec[k] || [], null);
      resized[`${k}Velocity`] = resize(sec[`${k}Velocity`] || [], 100);
    });
    return {
      draft: {
        ...s.draft,
        sections: { ...s.draft.sections, [s.draft.editingSection]: resized },
      },
    };
  }),

  loadBasicPattern: () => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const loaded = basicPatternForLength(sec.length);
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...loaded, lyrics: sec.lyrics } } } };
  }),

  /** Wipe everything in the open section (lyrics survive — they're written,
   *  not played, and losing a verse to a "clear the beat" click stings). */
  clearSection: () => set((s) => {
    const sec = s.draft.sections[s.draft.editingSection];
    const cleared = emptySection(sec.length);
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [s.draft.editingSection]: { ...cleared, lyrics: sec.lyrics } } } };
  }),

  /** Wipe just one instrument, leaving the rest of the section intact — the
   *  usual case is redoing one part, not starting the whole section over. */
  clearChannel: (channel) => set((s) => {
    const key = s.draft.editingSection;
    const sec = s.draft.sections[key];
    const blank = emptySection(sec.length);
    const next = channel === 'drums'
      ? { ...sec, drums: blank.drums }
      : { ...sec, [channel]: blank[channel], [`${channel}Velocity`]: blank[`${channel}Velocity`] };
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [key]: next } } };
  }),

  /** One drum lane — clearing a hihat by hand is 16 clicks otherwise. */
  clearDrumLane: (drumKey) => set((s) => {
    const key = s.draft.editingSection;
    const sec = s.draft.sections[key];
    if (!sec.drums[drumKey]) return {};
    const drums = { ...sec.drums, [drumKey]: Array(sec.length).fill(false) };
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [key]: { ...sec, drums } } } };
  }),

  addToArrangement: (type) => set((s) => ({ draft: { ...s.draft, arrangement: [...s.draft.arrangement, type], editingSection: type } })),
  // Replace the whole arrangement at once — the DAW timeline computes repeats,
  // duplicates and group moves as a new flat list and commits it here.
  setArrangement: (list) => set((s) => ({ draft: { ...s.draft, arrangement: list } })),

  // ---- per-instrument timeline (편곡 screen): independent placements ----
  // Build the timeline once from the current clip sequence so opening 편곡 shows
  // the song laid out per instrument, ready to move each block independently.
  seedTimelineFromArrangement: () => set((s) => {
    if (s.draft.timeline.length) return {};
    const { arrangement, sections } = s.draft;
    const placements = [];
    let bar = 0;
    arrangement.forEach((key) => {
      const sec = sections[key];
      if (!sec) return;
      const bars = clipBars(sec);
      clipTracks(sec).forEach((track) => placements.push({ id: pid(), clip: key, track, start: bar, bars }));
      bar += bars;
    });
    return { draft: { ...s.draft, timeline: placements } };
  }),
  // Drop a clip: one independent placement per instrument it uses.
  addTimelineClip: (clip, startBar = 0) => set((s) => {
    const sec = s.draft.sections[clip];
    if (!sec) return {};
    const bars = clipBars(sec);
    const at = Math.max(0, Math.round(startBar));
    const added = clipTracks(sec).map((track) => ({ id: pid(), clip, track, start: at, bars }));
    return { draft: { ...s.draft, timeline: [...s.draft.timeline, ...added] } };
  }),
  moveTimelinePlacement: (id, start) => set((s) => ({ draft: { ...s.draft, timeline: s.draft.timeline.map((p) => (p.id === id ? { ...p, start: Math.max(0, Math.round(start)) } : p)) } })),
  resizeTimelinePlacement: (id, bars) => set((s) => ({ draft: { ...s.draft, timeline: s.draft.timeline.map((p) => (p.id === id ? { ...p, bars: Math.max(1, Math.round(bars)) } : p)) } })),
  deleteTimelinePlacement: (id) => set((s) => ({ draft: { ...s.draft, timeline: s.draft.timeline.filter((p) => p.id !== id) } })),
  clearTimeline: () => set((s) => ({ draft: { ...s.draft, timeline: [] } })),

  // ---- custom clips: create / duplicate / rename / delete ----
  // Clips are the reusable building blocks a song is arranged from. They live
  // in draft.sections keyed by their (unique) name; the arrangement and lyrics
  // reference that name. Duplicating makes an INDEPENDENT copy, which is how you
  // get 벌스 A ≠ 벌스 B.
  addClip: () => set((s) => {
    const keys = Object.keys(s.draft.sections);
    let n = keys.length + 1;
    let name = `구간 ${n}`;
    while (s.draft.sections[name]) name = `구간 ${++n}`;
    const clip = { ...emptySection(16), color: CLIP_PALETTE[keys.length % CLIP_PALETTE.length] };
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [name]: clip }, arrangement: [...s.draft.arrangement, name], editingSection: name } };
  }),

  duplicateClip: (key) => set((s) => {
    const src = s.draft.sections[key];
    if (!src) return {};
    let name = `${key} 사본`;
    let i = 2;
    while (s.draft.sections[name]) name = `${key} 사본 ${i++}`;
    const keys = Object.keys(s.draft.sections);
    const clip = { ...structuredClone(src), color: CLIP_PALETTE[keys.length % CLIP_PALETTE.length] };
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [name]: clip }, editingSection: name } };
  }),

  renameClip: (oldKey, rawNew) => set((s) => {
    const newKey = (rawNew || '').trim();
    if (!newKey || newKey === oldKey || newKey === MIX_KEY || s.draft.sections[newKey] || !s.draft.sections[oldKey]) return {};
    const sections = {};
    Object.entries(s.draft.sections).forEach(([k, v]) => { sections[k === oldKey ? newKey : k] = v; });
    const arrangement = s.draft.arrangement.map((k) => (k === oldKey ? newKey : k));
    const editingSection = s.draft.editingSection === oldKey ? newKey : s.draft.editingSection;
    return { draft: { ...s.draft, sections, arrangement, editingSection } };
  }),

  deleteClip: (key) => set((s) => {
    const keys = Object.keys(s.draft.sections);
    if (keys.length <= 1 || !s.draft.sections[key]) return {}; // always keep one clip
    const { [key]: _removed, ...rest } = s.draft.sections;
    const arrangement = s.draft.arrangement.filter((k) => k !== key);
    const editingSection = s.draft.editingSection === key ? Object.keys(rest)[0] : s.draft.editingSection;
    return { draft: { ...s.draft, sections: rest, arrangement, editingSection } };
  }),
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
    const resize = (arr, fill) => { const out = (arr || []).slice(0, length); while (out.length < length) out.push(fill); return out; };
    const newDrums = {};
    Object.keys(sec.drums).forEach((k) => { newDrums[k] = resize(sec.drums[k], false); });
    const resized = { ...sec, length, drums: newDrums };
    // Resize every melodic lane, not just the original three — otherwise the
    // expanded instruments (and vocalInst) keep a stale length and misalign
    // against bass when the combined pattern is stitched together.
    MELODIC_KEYS.forEach((k) => {
      resized[k] = resize(sec[k], null);
      resized[`${k}Velocity`] = resize(sec[`${k}Velocity`], 100);
    });
    return {
      draft: { ...s.draft, sections: { ...s.draft.sections, [sectionKey]: resized } },
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
  setFx: (field, v) => set((s) => ({ fx: { ...s.fx, [field]: v } })),

  // Everything the audio engine needs, in one object — used to seed the
  // engine on play and to persist the mix alongside the draft.
  audioState: () => {
    const { mixer, fx, channelMix, channelFx, drumParams, drumKitId } = get();
    return { mixer, fx, channelMix, channelFx, drumParams, drumKitId };
  },

  setChannelVol: (channel, v) => set((s) => {
    const channelMix = { ...s.channelMix, [channel]: { ...s.channelMix[channel], vol: v } };
    engine.updateChannelMix(channelMix);
    return { channelMix };
  }),
  toggleChannelMute: (channel) => set((s) => {
    const channelMix = { ...s.channelMix, [channel]: { ...s.channelMix[channel], mute: !s.channelMix[channel].mute } };
    engine.updateChannelMix(channelMix);
    return { channelMix };
  }),
  selectChannel: (channel) => set({ selectedChannel: channel }),

  // Record-your-voice instrument: decode the take, hand the buffer to the
  // engine's vocal sampler mapped to baseNote, and remember it so the channel
  // rack can show it's loaded. The sample lives only in the engine (never
  // uploaded), so this is session-local.
  loadVocalInstrument: async (buffer, baseNote, duration) => {
    await engine.loadVocalSample(buffer, baseNote);
    set({ vocalSampleInfo: { baseNote, duration } });
  },
  setOpenPlugin: (plugin) => set({ openPlugin: plugin }),
  toggleEffectWindow: (effectId) => set((s) => ({
    openEffectIds: s.openEffectIds.includes(effectId)
      ? s.openEffectIds.filter((id) => id !== effectId)
      : [...s.openEffectIds, effectId],
  })),

  /* --- per-channel effects ------------------------------------------------
     Structural changes (add/remove) rebuild that channel's Tone nodes; knob
     turns go through setChannelEffectParam, which tweaks the live node so a
     drag doesn't click. See engine.js for why the two paths differ. */
  addChannelEffect: (channel, type) => set((s) => {
    const spec = EFFECT_TYPES[type];
    if (!spec) return {};
    const effect = { id: `${type}-${Date.now().toString(36)}`, type };
    spec.params.forEach((p) => { effect[p.key] = p.default; });
    const list = [...s.channelFx[channel], effect];
    const channelFx = { ...s.channelFx, [channel]: list };
    engine.updateChannelEffects(channel, list);
    return { channelFx };
  }),
  removeChannelEffect: (channel, effectId) => set((s) => {
    const list = s.channelFx[channel].filter((e) => e.id !== effectId);
    const channelFx = { ...s.channelFx, [channel]: list };
    engine.updateChannelEffects(channel, list);
    return { channelFx, openEffectIds: s.openEffectIds.filter((id) => id !== effectId) };
  }),
  setChannelEffectParam: (channel, effectId, param, value) => set((s) => {
    const list = s.channelFx[channel].map((e) => (e.id === effectId ? { ...e, [param]: value } : e));
    engine.updateChannelEffectParam(channel, effectId, param, value);
    return { channelFx: { ...s.channelFx, [channel]: list } };
  }),

  /* --- drum machine ------------------------------------------------------- */
  setDrumParam: (drumKey, param, value) => set((s) => {
    const params = { ...s.drumParams[drumKey], [param]: value };
    engine.updateDrumParams(drumKey, params);
    // any hand-edit takes the kit off its preset — the sound is custom now
    return { drumParams: { ...s.drumParams, [drumKey]: params }, drumKitId: 'custom' };
  }),
  applyDrumKit: (kitId, kitParams) => set(() => {
    const drumParams = structuredClone(kitParams);
    Object.entries(drumParams).forEach(([key, params]) => engine.updateDrumParams(key, params));
    return { drumParams, drumKitId: kitId };
  }),
  auditionDrum: (drumKey) => engine.auditionDrum(drumKey),

  /** Write a whole transcribed drum take into the open section at once.
   *  `hits` is { drumKey: [stepIndex, ...] }. Bulk-setting rather than
   *  looping toggleDrumStep, which would flip existing hits back off and fire
   *  one audition per note. Lanes not mentioned are left alone. */
  applyDrumTranscription: (hits) => set((s) => {
    const key = s.draft.editingSection;
    const sec = s.draft.sections[key];
    const drums = { ...sec.drums };
    Object.entries(hits).forEach(([drumKey, indices]) => {
      if (!drums[drumKey]) return;
      const arr = Array(sec.length).fill(false);
      indices.forEach((i) => { if (i >= 0 && i < sec.length) arr[i] = true; });
      drums[drumKey] = arr;
    });
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [key]: { ...sec, drums } } } };
  }),

  /** Same for a hummed melody: replaces one lane's notes wholesale. */
  applyMelodyTranscription: (track, notes) => set((s) => {
    const key = s.draft.editingSection;
    const sec = s.draft.sections[key];
    const arr = Array(sec.length).fill(null);
    const velArr = [...sec[`${track}Velocity`]];
    notes.slice(0, sec.length).forEach((n, i) => {
      arr[i] = n || null;
      if (n) velArr[i] = 100;
    });
    return {
      draft: {
        ...s.draft,
        sections: { ...s.draft.sections, [key]: { ...sec, [track]: arr, [`${track}Velocity`]: velArr } },
      },
    };
  }),

  /** Drop a library preset onto the section being edited. Presets are one bar
   *  long, so they tile across a 2-bar section rather than leaving it half
   *  empty. Only the drum lanes are touched — melodies stay put. */
  applyDrumPreset: (preset) => set((s) => {
    const key = s.draft.editingSection;
    const sec = s.draft.sections[key];
    const drums = {};
    DRUM_INSTRUMENTS.forEach((d) => {
      const hits = new Set(preset.steps[d.key] || []);
      drums[d.key] = Array.from({ length: sec.length }, (_, i) => hits.has(i % PRESET_STEP_LENGTH));
    });
    return { draft: { ...s.draft, sections: { ...s.draft.sections, [key]: { ...sec, drums } } } };
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

  // Which artist's profile card is open (null = closed). Set from anywhere an
  // artist name is clickable; the global ArtistProfile modal reads it.
  profileArtist: null,
  openArtist: (type, id) => set({ profileArtist: { type, id } }),
  closeArtist: () => set({ profileArtist: null }),

  // When a song has attached vocal takes, `vocals` (an array of {recordingId,
  // offsetSec}, or the API's snake_case twin, or a bare id) is passed here and
  // each voice is layered over the Tone.js beat. A take with offset 0 starts
  // with the beat; a section take is delayed to its section's start; multiple
  // takes sharing an offset stack as harmony.
  play: async (pattern, bpm, id, vocals = null, label = '', startStep = 0) => {
    const audio = get().audioState();
    const total = pattern?.bass?.length || 0;
    const from = Math.max(0, Math.min(total - 1, Math.round(startStep) || 0));
    lastPlay = { pattern, bpm, id, vocals, label };
    set({ isPlaying: true, playingId: id, currentStep: from, playingTotal: total, playingLabel: label });
    stopVocals();

    // Seconds from the top to `from`, honouring per-section tempo — used to line
    // vocal takes up when seeking into the middle of a song.
    const stepBpms = pattern.stepBpms && pattern.stepBpms.length === total ? pattern.stepBpms : null;
    const stepDur = (i) => 60 / ((stepBpms ? stepBpms[i] : bpm) || bpm || 100) / 4;
    let seekSec = 0;
    for (let j = 0; j < from; j++) seekSec += stepDur(j);

    const list = normalizeVocals(vocals);
    if (list.length) {
      // Fetch + cache every take's blob URL up front, so a delayed section take
      // isn't late to its own entrance. Fetch failures skip that take only.
      await Promise.all(list.map(async (v) => {
        if (vocalUrlCache.has(v.recordingId)) return;
        try { vocalUrlCache.set(v.recordingId, await recordingsApi.fetchRecordingUrl(v.recordingId)); }
        catch { /* skip this take */ }
      }));
      list.forEach((v) => {
        const url = vocalUrlCache.get(v.recordingId);
        if (!url) return;
        const startTake = (into = 0) => { const el = new Audio(url); if (into > 0) el.addEventListener('loadedmetadata', () => { try { el.currentTime = into; } catch { /* ignore */ } }, { once: true }); vocalAudios.push(el); el.play().catch(() => {}); };
        const rel = (v.offsetSec || 0) - seekSec; // seconds from now until this take enters
        if (rel >= 0) { if (rel * 1000 < 20) startTake(); else vocalTimers.push(setTimeout(() => startTake(), rel * 1000)); }
        else startTake(-rel); // seek point is inside this take — start it partway in
      });
    }

    // queueMicrotask: Tone.Draw can invoke the very first step's callback
    // synchronously inside Transport.start() (called from this same click
    // handler), which raced with React's in-flight render of the components
    // now subscribed to currentStep (Timeline's playhead) — "Cannot update a
    // component while rendering a different component". Deferring the store
    // update by one microtask guarantees it lands after the current render.
    await engine.playPattern(pattern, bpm, audio, (idx) => queueMicrotask(() => set({ currentStep: idx })), from);
  },
  // Jump playback to a step (click a progress bar / timeline, YouTube-style).
  seek: (step) => {
    if (!get().isPlaying || !lastPlay) return;
    const { pattern, bpm, id, vocals, label } = lastPlay;
    get().play(pattern, bpm, id, vocals, label, step);
  },
  stop: () => {
    engine.stopPattern();
    stopVocals();
    lastPlay = null;
    set({ isPlaying: false, currentStep: -1, playingId: null, playingTotal: 0, playingLabel: '' });
  },

  // Save the work-in-progress to the server. Creates the draft row the first
  // time, PATCHes it thereafter, so repeated saves don't pile up rows.
  // Returns the draft id. Release and collab-invite both reuse it.
  saveDraft: async () => {
    const s = get();
    const payload = buildDraftPayload(s.draft, s.audioState());
    if (s.persistedDraftId) {
      await songsApi.updateDraft(s.persistedDraftId, payload);
      set({ draftSavedAt: Date.now() });
      return s.persistedDraftId;
    }
    const draftRow = await songsApi.createDraft(payload);
    set({ persistedDraftId: draftRow.id, draftSavedAt: Date.now() });
    return draftRow.id;
  },

  listDrafts: () => songsApi.listMyDrafts(),

  loadDraft: async (songId) => {
    if (get().isPlaying) get().stop();
    const apiSong = await songsApi.getSong(songId);
    const mix = readMixFromPattern(apiSong.pattern);
    set({ draft: mapApiSongToDraft(apiSong), persistedDraftId: apiSong.id, draftSavedAt: null, openEffectIds: [], openPlugin: null, ...mix });
    engine.syncAudioState(mix);
  },

  deleteDraft: async (songId) => {
    await songsApi.deleteDraft(songId);
    // if the open draft was the deleted one, detach so a later save creates fresh
    if (get().persistedDraftId === songId) set({ persistedDraftId: null });
  },

  // Start a brand-new song without touching the saved draft on the server.
  // Sound design resets too — the mix is part of the song, not the session.
  newDraft: () => {
    if (get().isPlaying) get().stop();
    const mix = defaultMix();
    set({ draft: initialDraft(), persistedDraftId: null, draftSavedAt: null, openEffectIds: [], openPlugin: null, ...mix });
    engine.syncAudioState(mix);
  },

  inviteCollaborator: async (inviteeCharacterId, role, contributionPct) => {
    const draftId = await get().saveDraft();
    return collabApi.invite(draftId, inviteeCharacterId, role, contributionPct);
  },

  // Server-authoritative: the draft is saved and re-scored by
  // backend/app/services/scoring.py — see docs/server-architecture.md §3.
  // Nothing computed client-side (computeRelease.js) is trusted or sent.
  handleRelease: async () => {
    const s = get();
    if (s.isPlaying) get().stop();

    // Always flush the latest edits first, so releasing can't publish a stale
    // server-side draft when the player edited after their last manual save.
    const draftId = await get().saveDraft();
    const result = await songsApi.releaseSong(draftId);
    const song = result.song;
    const combined = buildCombinedPattern(song.pattern, song.structure, song.bpm);

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
        commentLine: r.comment_line,
      })),
      revenueBreakdown: result.revenue_breakdown,
      newlyUnlocked: result.newly_unlocked || [],
      songTitle: song.title,
      songId: song.id,
      pattern: combined,
      bpm: song.bpm,
      vocalRecordingId: song.vocal_recording_id || null,
      vocals: song.vocals || [],
    };

    set((state) => ({
      character: {
        ...state.character,
        fame: result.character_fame,
        money: result.character_money,
        fansCount: result.character_fans_count,
        // a release consumes a week of game time
        gameDate: result.character_game_date,
        age: result.character_age,
        songs: [...state.character.songs, mapSong(song)],
      },
      lastResult,
      lastTimeSummary: result.time ? { ...result.time, message: '발매 후 한 주가 지났습니다.' } : null,
      // released: the row is no longer a draft, so detach from it
      persistedDraftId: null,
      draftSavedAt: null,
    }));
    playSuccessChime();
    return lastResult;
  },

  nextSong: () => set({ draft: initialDraft(), persistedDraftId: null, draftSavedAt: null }),
}));

