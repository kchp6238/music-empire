import { apiFetch } from './client';

export function listAlbums() {
  return apiFetch('/albums');
}

export function createAlbum(payload) {
  return apiFetch('/albums', { method: 'POST', body: payload });
}
