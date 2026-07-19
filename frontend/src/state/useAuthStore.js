import { create } from 'zustand';
import * as authApi from '../lib/api/auth';

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
    set({ token: null });
  },
}));
