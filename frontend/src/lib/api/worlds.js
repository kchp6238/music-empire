import { apiFetch } from './client';

/** Every save the player has — the save-select screen. */
export function listSaves() {
  return apiFetch('/worlds');
}

export function createWorld(name, kind) {
  return apiFetch('/worlds', { method: 'POST', body: { name, kind } });
}

export function joinWorld(code) {
  return apiFetch('/worlds/join', { method: 'POST', body: { code } });
}

export function deleteWorld(worldId) {
  return apiFetch(`/worlds/${worldId}`, { method: 'DELETE' });
}
