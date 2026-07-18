import { apiFetch } from './client';

export function getFeed() {
  return apiFetch('/community/feed', { auth: false });
}

export function getChart() {
  return apiFetch('/community/chart', { auth: false });
}

export function getFollows() {
  return apiFetch('/community/follows');
}

export function follow(followedType, followedId) {
  return apiFetch('/community/follow', { method: 'POST', body: { followed_type: followedType, followed_id: followedId } });
}

export function unfollow(followedType, followedId) {
  return apiFetch('/community/unfollow', { method: 'POST', body: { followed_type: followedType, followed_id: followedId } });
}
