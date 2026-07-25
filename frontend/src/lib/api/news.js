import { apiFetch } from './client';

export function getNews() {
  return apiFetch('/news');
}

export function advanceDay() {
  return apiFetch('/news/advance-day', { method: 'POST' });
}

export function chooseNews(newsId, choiceId) {
  return apiFetch(`/news/${newsId}/choose`, { method: 'POST', body: { choice_id: choiceId } });
}
