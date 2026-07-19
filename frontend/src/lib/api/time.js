import { apiFetch } from './client';

export function getTime() {
  return apiFetch('/time');
}

export function train(stat) {
  return apiFetch('/train', { method: 'POST', body: { stat } });
}

export function rest() {
  return apiFetch('/rest', { method: 'POST' });
}

export function getSeasons() {
  return apiFetch('/seasons');
}
