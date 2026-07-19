import { clamp } from '../utils';

export const GENRES = ['발라드', '팝', '힙합', 'R&B', 'EDM', '록', '인디', '재즈', '트로트'];
export const MOODS = ['감성적', '신남', '우울', '강렬', '로맨틱', '몽환적', '편안함', '실험적'];
export const SECTION_TYPES = ['인트로', '벌스', '코러스', '브릿지', '아웃트로'];
export const SECTION_COLORS = {
  인트로: '#8B7FD1',
  벌스: '#4FD1C5',
  코러스: '#E8A33D',
  브릿지: '#E893A6',
  아웃트로: '#5FBF8F',
};

export const DRUM_INSTRUMENTS = [
  { key: 'kick', label: '킥', color: '#E8A33D' },
  { key: 'snare', label: '스네어', color: '#4FD1C5' },
  { key: 'hihatClosed', label: '클로즈 하이햇', color: '#8B7FD1' },
  { key: 'hihatOpen', label: '오픈 하이햇', color: '#7FA8D1' },
  { key: 'clap', label: '클랩', color: '#E893A6' },
  { key: 'tom', label: '톰', color: '#D18B4C' },
  { key: 'crash', label: '크래시', color: '#C4576B' },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function buildPitchRange(startOctave, numOctaves) {
  const notes = [];
  for (let oct = startOctave + numOctaves - 1; oct >= startOctave; oct--) {
    for (let i = 11; i >= 0; i--) notes.push(NOTE_NAMES[i] + oct);
  }
  return notes;
}
export const BASS_PITCHES = buildPitchRange(2, 2);
export const PIANO_PITCHES = buildPitchRange(3, 2);
export const GUITAR_PITCHES = buildPitchRange(4, 2);

export const MIXER_TRACKS = [
  ...DRUM_INSTRUMENTS.map((d) => ({ key: d.key, label: d.label })),
  { key: 'bass', label: '베이스' },
  { key: 'piano', label: '피아노' },
  { key: 'guitar', label: '기타' },
];
export const DEFAULT_MIXER = {
  kick: { vol: 0, mute: false }, snare: { vol: 0, mute: false },
  hihatClosed: { vol: -10, mute: false }, hihatOpen: { vol: -8, mute: false },
  clap: { vol: -4, mute: false }, tom: { vol: -2, mute: false }, crash: { vol: -6, mute: false },
  bass: { vol: -3, mute: false }, piano: { vol: -4, mute: false }, guitar: { vol: -6, mute: false },
};

export const CHORD_PRESETS = [
  { id: 'p1', name: 'I - V - vi - IV', desc: '가장 대중적인 팝 진행', accessibility: 85, originalityMod: -15 },
  { id: 'p2', name: 'vi - IV - I - V', desc: '감성적인 발라드 진행', accessibility: 75, originalityMod: -8 },
  { id: 'p3', name: 'I - IV - V', desc: '단순하고 강렬한 록 진행', accessibility: 70, originalityMod: -5 },
  { id: 'p4', name: 'ii - V - I', desc: '재즈 스탠다드 진행', accessibility: 40, originalityMod: 12 },
  { id: 'p5', name: 'i - ♭VI - ♭III - ♭VII', desc: '몽환적인 마이너 진행', accessibility: 35, originalityMod: 15 },
  { id: 'p6', name: '불협화음 실험 진행', desc: '관습을 깨는 독창적 진행', accessibility: 20, originalityMod: 25 },
];

export const BACKGROUNDS = [
  { id: 'unknown', name: '무명 음악가', tagline: '완전한 자유, 낮은 리스크', pro: '인지도 0', con: '초기 수익 없음',
    stats: { composing: 45, lyrics: 40, arrangement: 35, vocal: 40, production: 35, mixing: 30, business: 20, marketing: 15 },
    talent: { genius: 50, creativity: 55, ear: 50, charisma: 40, effort: 60, leadership: 30, luck: 50 },
    fame: 5, money: 800000 },
  { id: 'star', name: '유명 가수', tagline: '초기 팬덤·수익 확보', pro: '탄탄한 팬층', con: '기대치 부담',
    stats: { composing: 35, lyrics: 35, arrangement: 30, vocal: 70, production: 30, mixing: 25, business: 40, marketing: 55 },
    talent: { genius: 45, creativity: 45, ear: 55, charisma: 75, effort: 50, leadership: 45, luck: 55 },
    fame: 55, money: 3000000 },
  { id: 'producer', name: '신인 프로듀서', tagline: '협업 네트워크 시작값 높음', pro: '탄탄한 제작 기초', con: '본인 인지도 낮음',
    stats: { composing: 55, lyrics: 35, arrangement: 60, vocal: 25, production: 65, mixing: 60, business: 35, marketing: 30 },
    talent: { genius: 55, creativity: 55, ear: 65, charisma: 40, effort: 55, leadership: 40, luck: 50 },
    fame: 10, money: 1200000 },
  { id: 'genius', name: '천재 작곡가', tagline: '독창성의 축복, 세상과는 거리감', pro: '천재성 보너스', con: '경영 감각 부족',
    stats: { composing: 70, lyrics: 55, arrangement: 60, vocal: 30, production: 45, mixing: 35, business: 10, marketing: 10 },
    talent: { genius: 85, creativity: 80, ear: 75, charisma: 30, effort: 45, leadership: 20, luck: 45 },
    fame: 8, money: 600000 },
  { id: 'trainee', name: '연습생', tagline: '체계적 커리큘럼, 낮은 자율성', pro: '성장 인프라', con: '계약 제약',
    stats: { composing: 25, lyrics: 25, arrangement: 25, vocal: 55, production: 20, mixing: 15, business: 15, marketing: 20 },
    talent: { genius: 45, creativity: 45, ear: 50, charisma: 55, effort: 70, leadership: 25, luck: 50 },
    fame: 15, money: 300000 },
  { id: 'indie', name: '인디 뮤지션', tagline: '창작 자유도 최대', pro: '충성도 높은 소수 팬', con: '자금·유통 취약',
    stats: { composing: 55, lyrics: 60, arrangement: 50, vocal: 50, production: 45, mixing: 40, business: 20, marketing: 20 },
    talent: { genius: 60, creativity: 70, ear: 60, charisma: 45, effort: 60, leadership: 35, luck: 50 },
    fame: 12, money: 500000 },
  { id: 'ceo_small', name: '신생 기획사 대표', tagline: '회사 시스템 조기 개방', pro: '경영 인프라', con: '자본 부담',
    stats: { composing: 30, lyrics: 25, arrangement: 25, vocal: 20, production: 35, mixing: 25, business: 65, marketing: 60 },
    talent: { genius: 40, creativity: 40, ear: 45, charisma: 60, effort: 55, leadership: 70, luck: 45 },
    fame: 20, money: 5000000 },
  { id: 'ceo_big', name: '대형 기획사 대표', tagline: '풍부한 자본·인프라', pro: '막강한 자원', con: '관료적 제약',
    stats: { composing: 25, lyrics: 20, arrangement: 20, vocal: 15, production: 40, mixing: 30, business: 80, marketing: 80 },
    talent: { genius: 40, creativity: 35, ear: 40, charisma: 65, effort: 50, leadership: 80, luck: 50 },
    fame: 45, money: 30000000 },
  { id: 'random', name: '랜덤 인생', tagline: '무엇이 될지 알 수 없다', pro: '리플레이성 최대', con: '예측 불가',
    stats: null, talent: null, fame: null, money: null },
];

export const FAN_PERSONAS = [
  { id: 1, name: '감성 발라드 러버', color: '#E893A6', genrePref: { 발라드: 0.9, 'R&B': 0.5, EDM: -0.6, 힙합: -0.3 }, moodPref: { 감성적: 0.8, 우울: 0.3, 신남: -0.4 }, openness: 0.2 },
  { id: 2, name: '클럽 EDM 매니아', color: '#4FD1C5', genrePref: { EDM: 0.9, 팝: 0.4, 발라드: -0.5, 트로트: -0.7 }, moodPref: { 신남: 0.8, 강렬: 0.6, 우울: -0.5 }, openness: 0.3 },
  { id: 3, name: '힙합 헤드', color: '#E8A33D', genrePref: { 힙합: 0.9, 'R&B': 0.5, 록: 0.2, 발라드: -0.4 }, moodPref: { 강렬: 0.7, 신남: 0.3, 로맨틱: -0.3 }, openness: 0.4 },
  { id: 4, name: '인디 시네필', color: '#8B7FD1', genrePref: { 인디: 0.9, 재즈: 0.4, 팝: -0.3, 트로트: -0.5 }, moodPref: { 몽환적: 0.7, 편안함: 0.4, 신남: -0.3 }, openness: 0.8 },
  { id: 5, name: '올드스쿨 트로트 팬', color: '#D18B4C', genrePref: { 트로트: 0.9, 발라드: 0.4, EDM: -0.8, 힙합: -0.7 }, moodPref: { 편안함: 0.6, 감성적: 0.5, 강렬: -0.5 }, openness: 0.1 },
  { id: 6, name: '실험음악 얼리어답터', color: '#5FBF8F', genrePref: { 인디: 0.6, 재즈: 0.5, EDM: 0.3 }, moodPref: { 실험적: 0.9, 몽환적: 0.5, 편안함: -0.4 }, openness: 0.9 },
  { id: 7, name: '대중 팝 리스너', color: '#E8C34D', genrePref: { 팝: 0.8, 발라드: 0.3, 'R&B': 0.3, EDM: 0.2 }, moodPref: { 신남: 0.5, 로맨틱: 0.4, 실험적: -0.4 }, openness: 0.3 },
  { id: 8, name: '록 마니아', color: '#C4576B', genrePref: { 록: 0.9, 인디: 0.4, 트로트: -0.6, 발라드: -0.2 }, moodPref: { 강렬: 0.8, 신남: 0.4, 편안함: -0.4 }, openness: 0.3 },
  { id: 9, name: 'R&B 소울 리스너', color: '#7FA8D1', genrePref: { 'R&B': 0.9, 힙합: 0.4, 발라드: 0.3, EDM: -0.4 }, moodPref: { 로맨틱: 0.7, 감성적: 0.5, 강렬: -0.2 }, openness: 0.4 },
];

export const REACTION_LINES = {
  love: ['완전 내 스타일이야, 계속 돌려 듣는 중', '이 아티스트 진짜 물건이다', '이번 곡 알고리즘에 감사해야겠어'],
  good: ['괜찮네, 플레이리스트에 저장했어', '한 번 더 들어볼 만해', '기대 이상인데?'],
  meh: ['나쁘진 않은데 딱히 또 찾아 듣진 않을 듯', '무난하네', '한 번 듣고 말 것 같아'],
  bad: ['내 취향은 확실히 아니네', '음... 패스', '다음 곡을 기대해볼게'],
  awful: ['이건 좀 스킵하게 되네', '왜 이렇게 만들었을까', '아쉬운 시도였어'],
};
export function pickLine(key) { const arr = REACTION_LINES[key]; return arr[Math.floor(Math.random() * arr.length)]; }
export function tierKeyFromScore(score) {
  if (score >= 80) return 'love';
  if (score >= 60) return 'good';
  if (score >= 40) return 'meh';
  if (score >= 20) return 'bad';
  return 'awful';
}
export const TIER_COLOR = { 대박: '#E8A33D', 성공: '#4FD1C5', 무난: '#8B8496', 부진: '#D18B4C', 참패: '#C4576B' };

export function makeRandomBackground() {
  const pool = BACKGROUNDS.filter((b) => b.id !== 'random');
  const base = pool[Math.floor(Math.random() * pool.length)];
  const jitterObj = (obj) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => { out[k] = Math.round(clamp(v + (Math.random() * 30 - 15), 5, 95)); });
    return out;
  };
  return {
    ...base, id: 'random', name: `랜덤 인생 (${base.name} 기반)`,
    stats: jitterObj(base.stats), talent: jitterObj(base.talent),
    fame: Math.round(clamp(base.fame + (Math.random() * 20 - 10), 0, 100)),
    money: Math.round(clamp(base.money + (Math.random() * 600000 - 300000), 100000, 50000000)),
  };
}
