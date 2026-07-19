const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('me_token');
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
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  if (asBlob) return res.blob();
  return res.json();
}
