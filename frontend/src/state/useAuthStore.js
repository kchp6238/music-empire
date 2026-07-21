import { create } from 'zustand';
import * as authApi from '../lib/api/auth';
import { clearCoverCache } from '../components/cover/CoverThumb';
import { setActiveCharacterId } from '../lib/api/client';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('me_token'),

  async register(email, password, inviteCode) {
    await authApi.register(email, password, inviteCode);
  },

  async login(email, password) {
    const { access_token } = await authApi.login(email, password);
    localStorage.setItem('me_token', access_token);
    set({ token: access_token });
  },

  logout() {
    localStorage.removeItem('me_token');
    // the chosen save belongs to the account that's leaving
    setActiveCharacterId(null);
    // cover object URLs are per-account; a new sign-in must not reuse them
    clearCoverCache();
    set({ token: null });
  },
}));
