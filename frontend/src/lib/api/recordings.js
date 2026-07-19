import { apiFetch } from './client';

export function listRecordings(songId) {
  return apiFetch(`/recordings${songId ? `?song_id=${encodeURIComponent(songId)}` : ''}`);
}

export function uploadRecording({ blob, mimeType, title, durationSec, songId }) {
  const fd = new FormData();
  // filename is cosmetic — the server generates its own UUID name
  fd.append('file', blob, 'take' + (mimeType.includes('mp4') ? '.m4a' : '.webm'));
  fd.append('title', title || '');
  fd.append('duration_sec', String(durationSec || 0));
  if (songId) fd.append('song_id', songId);
  return apiFetch('/recordings', { method: 'POST', formData: fd });
}

/** Audio is behind auth, so fetch it as a blob and hand back an object URL
 *  (an <audio src> can't carry the Authorization header). */
export async function fetchRecordingUrl(recordingId) {
  const blob = await apiFetch(`/recordings/${recordingId}/audio`, { asBlob: true });
  return URL.createObjectURL(blob);
}

export function attachRecording(recordingId, songId) {
  return apiFetch(`/recordings/${recordingId}`, { method: 'PATCH', body: { song_id: songId } });
}

export function deleteRecording(recordingId) {
  return apiFetch(`/recordings/${recordingId}`, { method: 'DELETE' });
}
