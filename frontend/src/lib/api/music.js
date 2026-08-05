import { apiFetch } from './client';

export function getMusicStatus() {
  return apiFetch('/music');
}

export function setFandomName(name) {
  return apiFetch('/music/fandom-name', { method: 'POST', body: { name } });
}

export function promoteSong(songId) {
  return apiFetch('/music/promote', { method: 'POST', body: { song_id: songId } });
}
