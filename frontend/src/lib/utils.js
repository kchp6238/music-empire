export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (min, max) => Math.random() * (max - min) + min;
export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

// Compact Korean count: 12345 -> "1.2만", 1638 -> "1.6천", 640 -> "640".
export function compactNum(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 100000000) return `${(v / 100000000).toFixed(1).replace(/\.0$/, '')}억`;
  if (v >= 10000) return `${(v / 10000).toFixed(1).replace(/\.0$/, '')}만`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}천`;
  return String(v);
}
