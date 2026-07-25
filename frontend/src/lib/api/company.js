import { apiFetch } from './client';

export function getMyCompany() {
  return apiFetch('/company/me');
}

export function getFoundRequirements() {
  return apiFetch('/company/requirements');
}

export function foundCompany(name) {
  return apiFetch('/company', { method: 'POST', body: { name } });
}

export function recruitTrainee(name) {
  return apiFetch('/company/trainees', { method: 'POST', body: { name: name || null } });
}

export function trainTrainee(traineeId) {
  return apiFetch(`/company/trainees/${traineeId}/train`, { method: 'POST' });
}

export function debutGroup(name, traineeIds) {
  return apiFetch('/company/groups', { method: 'POST', body: { name, trainee_ids: traineeIds } });
}
