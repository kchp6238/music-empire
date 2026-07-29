import { apiFetch } from './client';

export function getThreads() {
  return apiFetch('/dm/threads');
}

export function getThread(threadKey) {
  return apiFetch(`/dm/threads/${encodeURIComponent(threadKey)}`);
}

export function sendMessage(threadKey, body) {
  return apiFetch('/dm/send', { method: 'POST', body: { thread_key: threadKey, body } });
}

export function getUnread() {
  return apiFetch('/dm/unread');
}
