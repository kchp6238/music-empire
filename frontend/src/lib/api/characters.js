import { apiFetch } from './client';

export function createCharacter(artistName, backgroundId) {
  return apiFetch('/characters', { method: 'POST', body: { artist_name: artistName, background_id: backgroundId } });
}

export function getMyCharacter() {
  return apiFetch('/characters/me');
}
