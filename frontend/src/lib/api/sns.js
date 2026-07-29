import { apiFetch } from './client';

export function getFeed() {
  return apiFetch('/sns/feed');
}

export function getProfile() {
  return apiFetch('/sns/profile');
}

export function createPost(caption, songId) {
  return apiFetch('/sns/posts', { method: 'POST', body: { caption, song_id: songId || null } });
}

export function likePost(postId) {
  return apiFetch(`/sns/posts/${postId}/like`, { method: 'POST' });
}

export function commentPost(postId, body) {
  return apiFetch(`/sns/posts/${postId}/comment`, { method: 'POST', body: { body } });
}
