import { apiFetch } from './client';

export function uploadCover(songId, blob) {
  const fd = new FormData();
  // filename is cosmetic — the server keys the row on song_id
  fd.append('file', blob, 'cover.png');
  return apiFetch(`/covers/${songId}`, { method: 'PUT', formData: fd });
}

/** Cover images sit behind auth, so fetch as a blob and hand back an object
 *  URL — an <img src> can't carry the Authorization header. */
export async function fetchCoverUrl(songId) {
  const blob = await apiFetch(`/covers/${songId}/image`, { asBlob: true });
  return URL.createObjectURL(blob);
}

/** Song ids of my songs that have art, so lists can skip probing each one. */
export function listMyCovers() {
  return apiFetch('/covers/mine');
}

export function deleteCover(songId) {
  return apiFetch(`/covers/${songId}`, { method: 'DELETE' });
}
