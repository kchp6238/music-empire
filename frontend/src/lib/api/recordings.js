import { apiFetch } from './client';

export function listRecordings(songId) {
  return apiFetch(`/recordings${songId ? `?song_id=${encodeURIComponent(songId)}` : ''}`);
}

export function uploadRecording({ blob, mimeType, title, durationSec, songId, section, pitchShift }) {
  const fd = new FormData();
  // filename is cosmetic — the server generates its own UUID name
  fd.append('file', blob, 'take' + (mimeType.includes('mp4') ? '.m4a' : '.webm'));
  fd.append('title', title || '');
  fd.append('duration_sec', String(durationSec || 0));
  if (songId) fd.append('song_id', songId);
  if (section) fd.append('section', section);
  if (pitchShift != null) fd.append('pitch_shift', String(pitchShift));
  return apiFetch('/recordings', { method: 'POST', formData: fd });
}

/** Audio is behind auth, so fetch it as a blob and hand back an object URL
 *  (an <audio src> can't carry the Authorization header). */
export async function fetchRecordingUrl(recordingId) {
  const blob = await apiFetch(`/recordings/${recordingId}/audio`, { asBlob: true });
  return URL.createObjectURL(blob);
}

// section: pass a section name to place the take, null to clear it, or leave
// undefined ("__keep__") to change only the song link. body maps to `body` in
// apiFetch — the server reads song_id/section off the JSON.
export function attachRecording(recordingId, songId, section = '__keep__') {
  return apiFetch(`/recordings/${recordingId}`, { method: 'PATCH', body: { song_id: songId, section } });
}

export function deleteRecording(recordingId) {
  return apiFetch(`/recordings/${recordingId}`, { method: 'DELETE' });
}
