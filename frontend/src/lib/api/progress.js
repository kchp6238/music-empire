import { apiFetch } from './client';

export function getAchievements() {
  return apiFetch('/achievements');
}

export function getCurrentTrend() {
  return apiFetch('/trends/current', { auth: false });
}
