import { apiFetch } from './client';

export function createDraft(payload) {
  return apiFetch('/songs', { method: 'POST', body: payload });
}

export function updateDraft(songId, payload) {
  return apiFetch(`/songs/${songId}`, { method: 'PATCH', body: payload });
}

export function getSong(songId) {
  return apiFetch(`/songs/${songId}`);
}

export function releaseSong(songId) {
  return apiFetch(`/songs/${songId}/release`, { method: 'POST' });
}

export function makeMusicVideo(songId, tier) {
  return apiFetch(`/songs/${songId}/music-video`, { method: 'POST', body: { tier } });
}

export function listMySongs() {
  return apiFetch('/songs');
}

export function listMyDrafts() {
  return apiFetch('/songs/drafts');
}

export function deleteDraft(songId) {
  return apiFetch(`/songs/${songId}`, { method: 'DELETE' });
}
