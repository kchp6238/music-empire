import { apiFetch } from './client';

export function getFeed() {
  return apiFetch('/community/feed', { auth: false });
}

export function getChart() {
  return apiFetch('/community/chart', { auth: false });
}
