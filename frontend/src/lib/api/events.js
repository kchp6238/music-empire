import { apiFetch } from './client';

export function rollEvent() {
  return apiFetch('/events/roll', { method: 'POST' });
}

export function resolveEvent(eventId, choiceIndex) {
  return apiFetch('/events/resolve', { method: 'POST', body: { event_id: eventId, choice_index: choiceIndex } });
}
