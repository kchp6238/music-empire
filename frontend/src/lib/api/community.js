import { apiFetch } from './client';

// Auth is required now: the feed/chart are scoped to the viewer's world, so
// the request must carry the active save (Authorization + X-Character-Id).
export function getFeed() {
  return apiFetch('/community/feed');
}

export function getChart() {
  return apiFetch('/community/chart');
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
