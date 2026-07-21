const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('me_token');
}

// The active save. Every authenticated request carries it so the backend
// knows which world it's acting in — see routers/songs.py::get_current_character.
// A ref rather than reading localStorage each call keeps the two in sync when
// the player switches saves without a reload.
let activeCharacterId = localStorage.getItem('me_character_id');
export function setActiveCharacterId(id) {
  activeCharacterId = id || null;
  if (id) localStorage.setItem('me_character_id', id);
  else localStorage.removeItem('me_character_id');
}
export function getActiveCharacterId() {
  return activeCharacterId;
}

// Set by App so an expired/invalid session can drop the player back to the
// login screen. Registered via a setter rather than importing the auth store
// here, which would be a circular import (store -> api/auth -> client).
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/**
 * body      -> JSON request
 * form      -> URLSearchParams (login)
 * formData  -> FormData (file upload; Content-Type is intentionally left unset
 *              so the browser can add the multipart boundary)
 * asBlob    -> resolve with a Blob instead of JSON (authenticated audio)
 */
export async function apiFetch(path, { method = 'GET', body, form, formData, asBlob = false, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Names the save this request acts in. Omitted before a save is chosen
    // (the /worlds screen), where the backend has no character to resolve yet.
    if (activeCharacterId) headers['X-Character-Id'] = activeCharacterId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData ? formData : form ? form : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // ignore non-JSON error bodies
    }
    // An expired/invalid token otherwise surfaces as a raw English 401 on
    // whatever the player happened to click. Drop the dead session and say so.
    if (res.status === 401 && auth) {
      onUnauthorized?.();
      throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  if (asBlob) return res.blob();
  return res.json();
}
