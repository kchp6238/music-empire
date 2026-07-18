import { apiFetch } from './client';

export function createDraft(payload) {
  return apiFetch('/songs', { method: 'POST', body: payload });
}

export function releaseSong(songId) {
  return apiFetch(`/songs/${songId}/release`, { method: 'POST' });
}

export function listMySongs() {
  return apiFetch('/songs');
}
