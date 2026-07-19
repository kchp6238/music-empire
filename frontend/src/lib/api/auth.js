import { apiFetch } from './client';

export function register(email, password, inviteCode) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: { email, password, invite_code: inviteCode || null },
    auth: false,
  });
}

export function login(email, password) {
  const form = new URLSearchParams({ username: email, password });
  return apiFetch('/auth/login', { method: 'POST', form, auth: false });
}

/** Whether this server requires an invite code to sign up. */
export function getAuthConfig() {
  return apiFetch('/auth/config', { auth: false });
}
