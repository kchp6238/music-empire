import { apiFetch } from './client';

export function register(email, password) {
  return apiFetch('/auth/register', { method: 'POST', body: { email, password }, auth: false });
}

export function login(email, password) {
  const form = new URLSearchParams({ username: email, password });
  return apiFetch('/auth/login', { method: 'POST', form, auth: false });
}
