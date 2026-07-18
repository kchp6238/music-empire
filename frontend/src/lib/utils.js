export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (min, max) => Math.random() * (max - min) + min;
export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
