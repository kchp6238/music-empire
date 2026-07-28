import { create } from 'zustand';
import * as Tone from 'tone';
import { setUiSoundsEnabled } from '../lib/audio/uiSounds';

// Client-only preferences (there's no backend for these) + the open-state of
// the settings and guide overlays. Persisted to localStorage so they survive a
// reload; the guide's "seen" flag is stored separately so clearing settings
// never re-triggers the intro.
const KEY = 'me_settings';
const GUIDE_SEEN_KEY = 'me_guide_seen';
const DEFAULTS = { masterVolume: 80, uiSounds: true, animations: true };

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      masterVolume: s.masterVolume, uiSounds: s.uiSounds, animations: s.animations,
    }));
  } catch { /* private mode / quota — settings just won't persist */ }
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

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  openGuide: () => set({ guideOpen: true }),
  // Closing the guide (finish OR skip) counts as "seen" so it won't auto-open
  // again; it can still be reopened from the ? button or settings.
  closeGuide: () => { markGuideSeen(); set({ guideOpen: false }); },

  // Called once a save is active — shows the intro the first time only.
  maybeAutoOpenGuide: () => { if (!hasSeenGuide()) set({ guideOpen: true }); },
}));
