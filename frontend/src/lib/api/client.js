const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('me_token');
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
