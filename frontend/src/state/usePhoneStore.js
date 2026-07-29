import { create } from 'zustand';

// UI state for the in-game phone: whether it's open and which app is on screen
// (null = home). Kept separate from game data — it's pure presentation, like
// useSettingsStore's overlay flags.
export const usePhoneStore = create((set) => ({
  open: false,
  activeApp: null, // null = home screen

  openPhone: (app = null) => set({ open: true, activeApp: app }),
  closePhone: () => set({ open: false }),
  openApp: (app) => set({ activeApp: app }),
  goHome: () => set({ activeApp: null }),
  togglePhone: () => set((s) => ({ open: !s.open })),
}));

