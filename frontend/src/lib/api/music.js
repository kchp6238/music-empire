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

export function fanEvent(kind) {
  return apiFetch('/music/fan-event', { method: 'POST', body: { kind } });
}

export function worldTour() {
  return apiFetch('/music/world-tour', { method: 'POST' });
}
