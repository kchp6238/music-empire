import { create } from 'zustand';
import * as Tone from 'tone';
import { setUiSoundsEnabled } from '../lib/audio/uiSounds';

// Client-only preferences (there's no backend for these) + the open-state of
// the settings and guide overlays. Persisted to localStorage so they survive a
// reload; the guide's "seen" flag is stored separately so clearing settings
// never re-triggers the intro.
const KEY = 'me_settings';
const GUIDE_SEEN_KEY = 'me_guide_seen';
// Selectable in-game skins. Each id has a matching [data-me-theme="id"] block in
// index.css that overrides the palette/surface variables. 'classic' is the
// default look (index.css :root defaults), so it needs no override block.
export const THEMES = [
  { id: 'classic', name: '클래식', desc: '기본 · 앰버·틸', swatch: ['#E8A33D', '#4FD1C5', '#221E2E'] },
  { id: 'pastel', name: '케이팝', desc: '파스텔 · 홀로그램', swatch: ['#FF8FD1', '#8BC5FF', '#241B30'] },
  { id: 'neon', name: '네온', desc: '사이버 · 발광', swatch: ['#2EE6E6', '#FF3D8B', '#0E1424'] },
  { id: 'mono', name: '매거진', desc: '에디토리얼 · 선명', swatch: ['#E23B67', '#D9A441', '#17151B'] },
  { id: 'warm', name: '바이닐', desc: '따뜻한 아날로그', swatch: ['#C4622E', '#B8892F', '#241A12'] },
];
const THEME_IDS = THEMES.map((t) => t.id);
const DEFAULTS = { masterVolume: 80, uiSounds: true, animations: true, theme: 'classic' };

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      masterVolume: s.masterVolume, uiSounds: s.uiSounds, animations: s.animations, theme: s.theme,
    }));
  } catch { /* private mode / quota — settings just won't persist */ }
}
function applyTheme(id) {
  const theme = THEME_IDS.includes(id) ? id : 'classic';
  try { document.documentElement.setAttribute('data-me-theme', theme); } catch { /* no DOM */ }
}

// 0..100 slider → master gain in dB. 100 = 0 dB (unchanged), tapering
// logarithmically to a -40 dB floor, and a hard mute at 0.
export function volumeToDb(v) { return v <= 0 ? -Infinity : Math.max(-40, 20 * Math.log10(v / 100)); }
function applyVolume(v) { try { Tone.getDestination().volume.value = volumeToDb(v); } catch { /* no ctx yet */ } }

export function hasSeenGuide() {
  try { return Boolean(localStorage.getItem(GUIDE_SEEN_KEY)); } catch { return true; }
}
function markGuideSeen() { try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch { /* ignore */ } }

// Apply persisted prefs to the audio engine immediately at module load, before
// any component mounts, so the very first sound already honours them.
const initial = loadSettings();
applyVolume(initial.masterVolume);
setUiSoundsEnabled(initial.uiSounds);
applyTheme(initial.theme);

export const useSettingsStore = create((set, get) => ({
  ...initial,
  settingsOpen: false,
  guideOpen: false,

  setMasterVolume: (v) => {
    const vol = Math.max(0, Math.min(100, Math.round(v)));
    applyVolume(vol);
    set({ masterVolume: vol });
    persist(get());
  },
  setUiSounds: (on) => {
    setUiSoundsEnabled(on);
    set({ uiSounds: on });
    persist(get());
  },
  setAnimations: (on) => {
    set({ animations: on });
    persist(get());
  },
  setTheme: (id) => {
    applyTheme(id);
    set({ theme: id });
    persist(get());
  },

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  openGuide: () => set({ guideOpen: true }),
  // Closing the guide (finish OR skip) counts as "seen" so it won't auto-open
  // again; it can still be reopened from the ? button or settings.
  closeGuide: () => { markGuideSeen(); set({ guideOpen: false }); },

  // Called once a save is active — shows the intro the first time only.
  maybeAutoOpenGuide: () => { if (!hasSeenGuide()) set({ guideOpen: true }); },
}));

