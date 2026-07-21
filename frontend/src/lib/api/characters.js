import { apiFetch } from './client';

export function createCharacter(artistName, backgroundId, worldId) {
  return apiFetch('/characters', {
    method: 'POST',
    body: { artist_name: artistName, background_id: backgroundId, world_id: worldId },
  });
}

export function getMyCharacter() {
  return apiFetch('/characters/me');
}
