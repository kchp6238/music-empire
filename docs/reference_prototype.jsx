import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import {
  Disc3, ChevronRight, Music2, Users, TrendingUp,
  Sparkles, RotateCcw, Heart, Smile, Meh, Frown, Flame, Star, Sliders, Layers, FileText, Trophy
} from 'lucide-react';

// ---------------------------------------------------------------------------
// CONSTANTS & DATA
// ---------------------------------------------------------------------------

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

const GENRES = ['발라드', '팝', '힙합', 'R&B', 'EDM', '록', '인디', '재즈', '트로트'];
const MOODS = ['감성적', '신남', '우울', '강렬', '로맨틱', '몽환적', '편안함', '실험적'];
const SECTION_TYPES = ['인트로', '벌스', '코러스', '브릿지', '아웃트로'];

const DRUM_INSTRUMENTS = [
  { key: 'kick', label: '킥', color: '#E8A33D' },
  { key: 'snare', label: '스네어', color: '#4FD1C5' },
  { key: 'hihatClosed', label: '클로즈 하이햇', color: '#8B7FD1' },
  { key: 'hihatOpen', label: '오픈 하이햇', color: '#7FA8D1' },
  { key: 'clap', label: '클랩', color: '#E893A6' },
  { key: 'tom', label: '톰', color: '#D18B4C' },
  { key: 'crash', label: '크래시', color: '#C4576B' },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function buildPitchRange(startOctave, numOctaves) {
  const notes = [];
  for (let oct = startOctave + numOctaves - 1; oct >= startOctave; oct--) {
    for (let i = 11; i >= 0; i--) notes.push(NOTE_NAMES[i] + oct);
  }
  return notes;
}
const BASS_PITCHES = buildPitchRange(2, 2);
const PIANO_PITCHES = buildPitchRange(3, 2);
const GUITAR_PITCHES = buildPitchRange(4, 2);

const MIXER_TRACKS = [
  ...DRUM_INSTRUMENTS.map((d) => ({ key: d.key, label: d.label })),
  { key: 'bass', label: '베이스' },
  { key: 'piano', label: '피아노' },
  { key: 'guitar', label: '기타' },
];
const DEFAULT_MIXER = {
  kick: { vol: 0, mute: false }, snare: { vol: 0, mute: false },
  hihatClosed: { vol: -10, mute: false }, hihatOpen: { vol: -8, mute: false },
  clap: { vol: -4, mute: false }, tom: { vol: -2, mute: false }, crash: { vol: -6, mute: false },
  bass: { vol: -3, mute: false }, piano: { vol: -4, mute: false }, guitar: { vol: -6, mute: false },
};

const CHORD_PRESETS = [
  { id: 'p1', name: 'I - V - vi - IV', desc: '가장 대중적인 팝 진행', accessibility: 85, originalityMod: -15 },
  { id: 'p2', name: 'vi - IV - I - V', desc: '감성적인 발라드 진행', accessibility: 75, originalityMod: -8 },
  { id: 'p3', name: 'I - IV - V', desc: '단순하고 강렬한 록 진행', accessibility: 70, originalityMod: -5 },
  { id: 'p4', name: 'ii - V - I', desc: '재즈 스탠다드 진행', accessibility: 40, originalityMod: 12 },
  { id: 'p5', name: 'i - ♭VI - ♭III - ♭VII', desc: '몽환적인 마이너 진행', accessibility: 35, originalityMod: 15 },
  { id: 'p6', name: '불협화음 실험 진행', desc: '관습을 깨는 독창적 진행', accessibility: 20, originalityMod: 25 },
];

const BACKGROUNDS = [
  { id: 'unknown', name: '무명 음악가', tagline: '완전한 자유, 낮은 리스크', pro: '인지도 0', con: '초기 수익 없음',
    stats: { composing: 45, lyrics: 40, arrangement: 35, vocal: 40, production: 35, mixing: 30, business: 20, marketing: 15 },
    talent: { genius: 50, creativity: 55, ear: 50, charisma: 40, effort: 60, leadership: 30, luck: 50 },
    fame: 5, money: 800 },
  { id: 'star', name: '유명 가수', tagline: '초기 팬덤·수익 확보', pro: '탄탄한 팬층', con: '기대치 부담',
    stats: { composing: 35, lyrics: 35, arrangement: 30, vocal: 70, production: 30, mixing: 25, business: 40, marketing: 55 },
    talent: { genius: 45, creativity: 45, ear: 55, charisma: 75, effort: 50, leadership: 45, luck: 55 },
    fame: 55, money: 3000 },
  { id: 'producer', name: '신인 프로듀서', tagline: '협업 네트워크 시작값 높음', pro: '탄탄한 제작 기초', con: '본인 인지도 낮음',
    stats: { composing: 55, lyrics: 35, arrangement: 60, vocal: 25, production: 65, mixing: 60, business: 35, marketing: 30 },
    talent: { genius: 55, creativity: 55, ear: 65, charisma: 40, effort: 55, leadership: 40, luck: 50 },
    fame: 10, money: 1200 },
  { id: 'genius', name: '천재 작곡가', tagline: '독창성의 축복, 세상과는 거리감', pro: '천재성 보너스', con: '경영 감각 부족',
    stats: { composing: 70, lyrics: 55, arrangement: 60, vocal: 30, production: 45, mixing: 35, business: 10, marketing: 10 },
    talent: { genius: 85, creativity: 80, ear: 75, charisma: 30, effort: 45, leadership: 20, luck: 45 },
    fame: 8, money: 600 },
  { id: 'trainee', name: '연습생', tagline: '체계적 커리큘럼, 낮은 자율성', pro: '성장 인프라', con: '계약 제약',
    stats: { composing: 25, lyrics: 25, arrangement: 25, vocal: 55, production: 20, mixing: 15, business: 15, marketing: 20 },
    talent: { genius: 45, creativity: 45, ear: 50, charisma: 55, effort: 70, leadership: 25, luck: 50 },
    fame: 15, money: 300 },
  { id: 'indie', name: '인디 뮤지션', tagline: '창작 자유도 최대', pro: '충성도 높은 소수 팬', con: '자금·유통 취약',
    stats: { composing: 55, lyrics: 60, arrangement: 50, vocal: 50, production: 45, mixing: 40, business: 20, marketing: 20 },
    talent: { genius: 60, creativity: 70, ear: 60, charisma: 45, effort: 60, leadership: 35, luck: 50 },
    fame: 12, money: 500 },
  { id: 'ceo_small', name: '신생 기획사 대표', tagline: '회사 시스템 조기 개방', pro: '경영 인프라', con: '자본 부담',
    stats: { composing: 30, lyrics: 25, arrangement: 25, vocal: 20, production: 35, mixing: 25, business: 65, marketing: 60 },
    talent: { genius: 40, creativity: 40, ear: 45, charisma: 60, effort: 55, leadership: 70, luck: 45 },
    fame: 20, money: 5000 },
  { id: 'ceo_big', name: '대형 기획사 대표', tagline: '풍부한 자본·인프라', pro: '막강한 자원', con: '관료적 제약',
    stats: { composing: 25, lyrics: 20, arrangement: 20, vocal: 15, production: 40, mixing: 30, business: 80, marketing: 80 },
    talent: { genius: 40, creativity: 35, ear: 40, charisma: 65, effort: 50, leadership: 80, luck: 50 },
    fame: 45, money: 30000 },
  { id: 'random', name: '랜덤 인생', tagline: '무엇이 될지 알 수 없다', pro: '리플레이성 최대', con: '예측 불가',
    stats: null, talent: null, fame: null, money: null },
];

const FAN_PERSONAS = [
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

const REACTION_LINES = {
  love: ['완전 내 스타일이야, 계속 돌려 듣는 중', '이 아티스트 진짜 물건이다', '이번 곡 알고리즘에 감사해야겠어'],
  good: ['괜찮네, 플레이리스트에 저장했어', '한 번 더 들어볼 만해', '기대 이상인데?'],
  meh: ['나쁘진 않은데 딱히 또 찾아 듣진 않을 듯', '무난하네', '한 번 듣고 말 것 같아'],
  bad: ['내 취향은 확실히 아니네', '음... 패스', '다음 곡을 기대해볼게'],
  awful: ['이건 좀 스킵하게 되네', '왜 이렇게 만들었을까', '아쉬운 시도였어'],
};
function pickLine(key) { const arr = REACTION_LINES[key]; return arr[Math.floor(Math.random() * arr.length)]; }
function tierKeyFromScore(score) {
  if (score >= 80) return 'love';
  if (score >= 60) return 'good';
  if (score >= 40) return 'meh';
  if (score >= 20) return 'bad';
  return 'awful';
}
const TIER_ICON = { love: Heart, good: Smile, meh: Meh, bad: Frown, awful: Frown };
const TIER_COLOR = { 대박: '#E8A33D', 성공: '#4FD1C5', 무난: '#8B8496', 부진: '#D18B4C', 참패: '#C4576B' };

// ---------------------------------------------------------------------------
// PATTERN HELPERS
// ---------------------------------------------------------------------------

function emptySection(length) {
  const drums = {};
  DRUM_INSTRUMENTS.forEach((di) => { drums[di.key] = Array(length).fill(false); });
  return { length, drums, bass: Array(length).fill(null), piano: Array(length).fill(null), guitar: Array(length).fill(null), lyrics: '' };
}
function emptySections() { return Object.fromEntries(SECTION_TYPES.map((t) => [t, emptySection(16)])); }

function basicPatternForLength(length) {
  const base = {
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihatClosed: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    hihatOpen: Array(16).fill(false),
    clap: Array(16).fill(false),
    tom: Array(16).fill(false),
    crash: Array(16).fill(false),
  };
  const baseBass = ['C2', null, null, null, null, null, 'E2', null, 'G2', null, null, null, null, null, 'E2', null];
  const baseGuitar = Array(16).fill(null);
  const basePiano = Array(16).fill(null);
  const reps = length / 16;
  const tile = (arr) => { let out = []; for (let i = 0; i < reps; i++) out = out.concat(arr); return out.slice(0, length); };
  const drums = {};
  Object.keys(base).forEach((k) => { drums[k] = tile(base[k]); });
  return { length, drums, bass: tile(baseBass), piano: tile(basePiano), guitar: tile(baseGuitar), lyrics: '' };
}

function sectionHasContent(sec) {
  if (!sec) return false;
  const drumHit = Object.values(sec.drums).some((arr) => arr.some(Boolean));
  return drumHit || sec.bass.some(Boolean) || sec.piano.some(Boolean) || sec.guitar.some(Boolean);
}

function buildCombinedPattern(sections, arrangement) {
  const combined = { drums: {}, bass: [], piano: [], guitar: [] };
  DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = []; });
  arrangement.forEach((key) => {
    const sec = sections[key];
    if (!sec) return;
    DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = combined.drums[di.key].concat(sec.drums[di.key]); });
    combined.bass = combined.bass.concat(sec.bass);
    combined.piano = combined.piano.concat(sec.piano);
    combined.guitar = combined.guitar.concat(sec.guitar);
  });
  if (combined.bass.length === 0) {
    DRUM_INSTRUMENTS.forEach((di) => { combined.drums[di.key] = [false]; });
    combined.bass = [null];
    combined.piano = [null];
    combined.guitar = [null];
  }
  return combined;
}

function analyzeCombinedPattern(combined) {
  const totalSteps = combined.bass.length;
  const drumCount = Object.values(combined.drums).reduce((a, arr) => a + arr.filter(Boolean).length, 0);
  const bassCount = combined.bass.filter(Boolean).length;
  const pianoCount = combined.piano.filter(Boolean).length;
  const guitarCount = combined.guitar.filter(Boolean).length;
  const totalActive = drumCount + bassCount + pianoCount + guitarCount;
  const capacity = Math.max(totalSteps * (DRUM_INSTRUMENTS.length + 3) * 0.3, 1);
  const density = clamp((totalActive / capacity) * 100, 0, 100);
  const uniqueNotes = new Set([...combined.bass.filter(Boolean), ...combined.piano.filter(Boolean), ...combined.guitar.filter(Boolean)]).size;
  const variety = clamp(uniqueNotes * 10, 0, 100);
  return { density, variety, totalActive, totalSteps };
}

function lyricsWordCount(sections, arrangement) {
  return arrangement.reduce((sum, key) => {
    const sec = sections[key];
    const txt = sec && sec.lyrics ? sec.lyrics.trim() : '';
    return sum + (txt ? txt.split(/\s+/).length : 0);
  }, 0);
}

function makeRandomBackground() {
  const pool = BACKGROUNDS.filter((b) => b.id !== 'random');
  const base = pool[Math.floor(Math.random() * pool.length)];
  const jitterObj = (obj) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => { out[k] = Math.round(clamp(v + rand(-15, 15), 5, 95)); });
    return out;
  };
  return {
    ...base, id: 'random', name: `랜덤 인생 (${base.name} 기반)`,
    stats: jitterObj(base.stats), talent: jitterObj(base.talent),
    fame: Math.round(clamp(base.fame + rand(-10, 10), 0, 100)),
    money: Math.round(clamp(base.money + rand(-300, 300), 100, 50000)),
  };
}

function computeRelease(character, draft, combined) {
  const { stats, talent } = character;
  const chord = CHORD_PRESETS.find((c) => c.id === draft.chordPresetId);
  const isExpert = draft.productionMode === 'expert';
  const patternInfo = analyzeCombinedPattern(combined);
  const lyricsWords = lyricsWordCount(draft.sections, draft.arrangement);
  const lyricsBonus = clamp(lyricsWords / 10, 0, 8);

  let vocalQuality;
  if (draft.vocalSource === 'self') vocalQuality = clamp(stats.vocal + rand(-8, 8), 0, 100);
  else if (draft.vocalSource === 'ai') vocalQuality = 62;
  else vocalQuality = clamp(rand(45, 90), 0, 100);

  let temposynergy = 0;
  if (draft.bpm >= 140 && (draft.moods.includes('신남') || draft.moods.includes('강렬'))) temposynergy = 4;
  if (draft.bpm <= 80 && (draft.moods.includes('감성적') || draft.moods.includes('우울') || draft.moods.includes('편안함'))) temposynergy = 4;

  const craftBase = stats.composing * 0.3 + stats.arrangement * 0.25 + stats.production * 0.25 + stats.mixing * 0.2;
  const expertSkillAvg = (stats.production + stats.mixing) / 2;
  const modeMultiplier = isExpert ? (expertSkillAvg >= 55 ? 1.15 : 0.8) : 1.0;
  const densityBonus = clamp((patternInfo.density - 40) * 0.12, -6, 10);
  const craft = clamp(craftBase * modeMultiplier * 0.75 + vocalQuality * 0.15 + densityBonus + lyricsBonus + temposynergy + rand(-5, 5), 0, 100);

  let originality = clamp(
    talent.creativity * 0.4 + talent.genius * 0.35 + talent.ear * 0.15 + chord.originalityMod * 1.2 +
    clamp(patternInfo.variety * 0.06, 0, 6) + rand(-5, 5),
    0, 100
  );

  const geniusChance = talent.genius >= 75 && originality >= 65 ? 0.28 : (talent.genius >= 60 && originality >= 55 ? 0.12 : 0.02);
  const geniusEvent = Math.random() < geniusChance;
  if (geniusEvent) originality = clamp(originality + 16, 0, 100);
  if (!isExpert) originality = Math.min(originality, 62);

  const accessibility = clamp(chord.accessibility * 0.6 + (100 - originality) * 0.4, 0, 100);
  const experimental = clamp(100 - accessibility, 0, 100);

  const luckFactor = 1 + (talent.luck - 50) / 250 + rand(-0.15, 0.15);
  const exposureBase = character.fame * 0.55 + stats.marketing * 0.35 + (draft.vocalSource === 'npc' ? 12 : 0);
  const exposure = clamp(exposureBase * luckFactor, 3, 100);

  const personaResults = FAN_PERSONAS.map((p) => {
    const gVals = draft.genres.map((g) => p.genrePref[g] || 0);
    const mVals = draft.moods.map((m) => p.moodPref[m] || 0);
    const avgG = gVals.length ? gVals.reduce((a, b) => a + b, 0) / gVals.length : 0;
    const avgM = mVals.length ? mVals.reduce((a, b) => a + b, 0) / mVals.length : 0;
    let affinity = avgG * 0.6 + avgM * 0.4;
    const loyalty = character.personaLoyalty[p.id] || 0;
    if (affinity < 0) affinity = affinity * (1 - Math.min(0.6, p.openness * 0.5));
    else if (originality > 70) affinity = clamp(affinity + p.openness * 0.15, -1, 1);
    affinity = clamp(affinity + Math.min(0.25, loyalty * 0.05), -1, 1);

    const reachProb = clamp(exposure / 100 + (loyalty > 0 ? 0.25 : 0), 0.05, 0.97);
    const reached = Math.random() < reachProb;
    const reactionScore = clamp(50 + affinity * 45 + (craft - 50) * 0.25 + rand(-8, 8), 0, 100);

    return { persona: p, affinity, reached, reactionScore };
  });

  const reachedList = personaResults.filter((r) => r.reached);
  const reachedCount = reachedList.length;
  const reachRatio = (reachedCount / FAN_PERSONAS.length) * 100;

  const completionRate = reachedCount ? reachedList.reduce((a, r) => a + r.reactionScore, 0) / reachedCount / 100 : 0;
  const repeatPlayRate = reachedCount ? reachedList.filter((r) => r.reactionScore >= 70).length / reachedCount : 0;
  const saveRate = reachedCount ? reachedList.filter((r) => r.reactionScore >= 75).length / reachedCount : 0;
  const shareRate = reachedCount ? reachedList.filter((r) => r.reactionScore >= 85).length / reachedCount : 0;
  const fanAffinityMatch = reachedCount ? ((reachedList.reduce((a, r) => a + r.affinity, 0) / reachedCount) + 1) / 2 * 100 : 50;

  let overallScore = clamp(
    reachRatio * 0.10 + completionRate * 100 * 0.25 + repeatPlayRate * 100 * 0.15 +
    saveRate * 100 * 0.15 + shareRate * 100 * 0.10 + fanAffinityMatch * 0.25,
    0, 100
  );

  let sleeperHit = false;
  if (craft >= 65 && exposure < 32 && Math.random() < 0.15) {
    sleeperHit = true;
    overallScore = clamp(overallScore + 16, 0, 100);
  }

  let tier;
  if (overallScore >= 80) tier = '대박';
  else if (overallScore >= 65) tier = '성공';
  else if (overallScore >= 45) tier = '무난';
  else if (overallScore >= 25) tier = '부진';
  else tier = '참패';

  const fansDelta = Math.round((overallScore - 45) * 1.4 + reachedCount * 0.8);
  const moneyDelta = Math.round(
    overallScore * 45 + character.fame * 8 - (draft.vocalSource === 'npc' ? 280 : 0) - (isExpert ? 140 : 0)
  );
  const fameDelta = Math.round((overallScore - 50) * 0.35);

  const newLoyalty = { ...character.personaLoyalty };
  reachedList.forEach((r) => {
    if (r.reactionScore >= 68) newLoyalty[r.persona.id] = (newLoyalty[r.persona.id] || 0) + 1;
    else if (r.reactionScore < 30) newLoyalty[r.persona.id] = Math.max(0, (newLoyalty[r.persona.id] || 0) - 1);
  });

  return {
    attributes: { craft, originality, accessibility, experimental },
    breakdown: { reachRatio, completionRate, repeatPlayRate, saveRate, shareRate, fanAffinityMatch },
    overallScore, tier, geniusEvent, sleeperHit,
    fansDelta, moneyDelta, fameDelta,
    personaResults, newLoyalty,
  };
}

// ---------------------------------------------------------------------------
// NPC ARTISTS (community space content)
// ---------------------------------------------------------------------------

function stepsAt(indices, length = 16) {
  const arr = Array(length).fill(false);
  indices.forEach((i) => { arr[i] = true; });
  return arr;
}
function notesAt(pairs, length = 16) {
  const arr = Array(length).fill(null);
  pairs.forEach(([i, n]) => { arr[i] = n; });
  return arr;
}

const NPC_ARTISTS = [
  { id: 'npc1', name: '네온 하버', color: '#4FD1C5', genre: 'EDM', bio: '클럽 신에서 잔뼈가 굵은 듀오',
    song: { id: 'npc1-s1', title: 'Neon Tide', tier: '성공', score: 78, bpm: 128,
      pattern: {
        drums: {
          kick: stepsAt([0, 4, 8, 12]), snare: Array(16).fill(false),
          hihatClosed: stepsAt([0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]),
          hihatOpen: stepsAt([2, 6, 10, 14]), clap: stepsAt([4, 12]),
          tom: Array(16).fill(false), crash: stepsAt([0]),
        },
        bass: notesAt([[0, 'C2'], [2, 'C2'], [6, 'C2'], [8, 'C2'], [14, 'C2']]),
        piano: Array(16).fill(null),
        guitar: notesAt([[4, 'E4'], [12, 'G4']]),
      } } },
  { id: 'npc2', name: '조용한 새벽', color: '#E893A6', genre: '발라드', bio: '새벽 감성으로 유명한 싱어송라이터',
    song: { id: 'npc2-s1', title: '새벽 세시', tier: '성공', score: 65, bpm: 72,
      pattern: {
        drums: {
          kick: stepsAt([0, 8]), snare: stepsAt([4, 12]), hihatClosed: Array(16).fill(false),
          hihatOpen: Array(16).fill(false), clap: Array(16).fill(false),
          tom: Array(16).fill(false), crash: Array(16).fill(false),
        },
        bass: notesAt([[0, 'C2'], [8, 'A2']]),
        piano: Array(16).fill(null),
        guitar: notesAt([[2, 'E4'], [10, 'D4']]),
      } } },
  { id: 'npc3', name: '골목길', color: '#E8A33D', genre: '힙합', bio: '로컬 힙합 신의 라이징 스타',
    song: { id: 'npc3-s1', title: '골목길 리듬', tier: '대박', score: 83, bpm: 95,
      pattern: {
        drums: {
          kick: stepsAt([0, 3, 6, 8, 13]), snare: stepsAt([4, 12]),
          hihatClosed: stepsAt([0, 2, 3, 5, 6, 8, 10, 11, 13, 14]),
          hihatOpen: Array(16).fill(false), clap: stepsAt([15]),
          tom: Array(16).fill(false), crash: Array(16).fill(false),
        },
        bass: notesAt([[0, 'C2'], [3, 'C2'], [6, 'D2'], [9, 'C2'], [12, 'A2']]),
        piano: Array(16).fill(null),
        guitar: Array(16).fill(null),
      } } },
  { id: 'npc4', name: '유리병 편지', color: '#8B7FD1', genre: '인디', bio: '몽환적인 사운드의 인디 밴드',
    song: { id: 'npc4-s1', title: '유리병 편지', tier: '무난', score: 54, bpm: 100,
      pattern: {
        drums: {
          kick: stepsAt([0, 10]), snare: stepsAt([4, 12]),
          hihatClosed: stepsAt([1, 3, 5, 7, 9, 11, 13, 15]),
          hihatOpen: Array(16).fill(false), clap: Array(16).fill(false),
          tom: Array(16).fill(false), crash: Array(16).fill(false),
        },
        bass: notesAt([[0, 'E2'], [6, 'G2'], [12, 'D2']]),
        piano: Array(16).fill(null),
        guitar: notesAt([[0, 'E4'], [2, 'G4'], [4, 'A4'], [6, 'G4'], [8, 'E4'], [10, 'G4'], [12, 'A4'], [14, 'G4']]),
      } } },
  { id: 'npc5', name: '트로트 여왕', color: '#D18B4C', genre: '트로트', bio: '전국 노래자랑 출신의 신흥 강자',
    song: { id: 'npc5-s1', title: '인생은 트로트', tier: '성공', score: 71, bpm: 110,
      pattern: {
        drums: {
          kick: stepsAt([0, 2, 4, 6, 8, 10, 12, 14]), snare: stepsAt([3, 7, 11, 15]),
          hihatClosed: Array(16).fill(true), hihatOpen: Array(16).fill(false), clap: Array(16).fill(false),
          tom: Array(16).fill(false), crash: Array(16).fill(false),
        },
        bass: notesAt([[0, 'C2'], [2, 'G2'], [4, 'C2'], [6, 'G2'], [8, 'C2'], [10, 'G2'], [12, 'C2'], [14, 'G2']]),
        piano: Array(16).fill(null),
        guitar: Array(16).fill(null),
      } } },
];

// ---------------------------------------------------------------------------
// SMALL PRESENTATIONAL COMPONENTS
// ---------------------------------------------------------------------------

function MiniBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8B8496', marginBottom: 2 }}>
        <span>{label}</span><span className="me-mono">{Math.round(value)}</span>
      </div>
      <div style={{ height: 6, background: '#0E0C14', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamp(value, 0, 100)}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function Fader({ label, value, color }) {
  const v = clamp(value, 0, 100);
  return (
    <div className="me-fader-col">
      <div className="me-mono" style={{ fontSize: 12, color: '#EDE9F0' }}>{Math.round(v)}</div>
      <div className="me-fader-track">
        <div className="me-fader-fill" style={{ height: `${v}%`, background: `linear-gradient(180deg, ${color}, ${color}99)` }} />
        <div className="me-fader-cap" style={{ bottom: `calc(${v}% - 3px)` }} />
      </div>
      <div style={{ fontSize: 11, color: '#8B8496', textAlign: 'center', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function DrumRow({ label, steps, onToggle, currentStep, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0 }}>{label}</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {steps.map((on, i) => (
          <div
            key={i}
            onClick={() => onToggle(i)}
            style={{
              width: 26, height: 26, borderRadius: 5, cursor: 'pointer', boxSizing: 'border-box',
              background: on ? color : 'rgba(255,255,255,0.06)',
              border: currentStep === i ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.12)',
              marginRight: (i % 4 === 3) ? 10 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PianoRoll({ label, pitches, steps, onSetNote, currentStep, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0, paddingTop: 2 }}>{label}</div>
      <div className="me-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ flexShrink: 0 }}>
            {pitches.map((p) => (
              <div key={p} className="me-mono" style={{ width: 34, height: 18, fontSize: 9, color: p.includes('#') ? '#6B6577' : '#B8B2C4', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>{p}</div>
            ))}
          </div>
          <div>
            {pitches.map((p, rowIdx) => (
              <div key={p} style={{ display: 'flex' }}>
                {steps.map((val, colIdx) => {
                  const active = val === p;
                  return (
                    <div
                      key={colIdx}
                      onClick={() => onSetNote(colIdx, p)}
                      style={{
                        width: 22, height: 18, cursor: 'pointer', boxSizing: 'border-box',
                        background: active ? color : (rowIdx % 12 === 11 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)'),
                        border: currentStep === colIdx ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.06)',
                        marginRight: (colIdx % 4 === 3) ? 8 : 0,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PianoKeyRoll({ label, pitches, steps, onSetNote, currentStep, color }) {
  const cellW = 22;
  const rowH = 18;
  const whiteKeyH = 46;
  const blackKeyH = 28;
  const width = pitches.length * cellW;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>{label} — 실제 건반처럼 가로로 배열, 스텝은 아래로 진행</div>
      <div className="me-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width, height: whiteKeyH }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width, height: whiteKeyH, background: '#EDE9F0', borderRadius: '4px 4px 0 0', boxShadow: 'inset 0 -3px 4px rgba(0,0,0,0.15)' }} />
          {pitches.map((p, idx) => (
            !p.includes('#') ? (
              <div key={p + '-sep'} style={{ position: 'absolute', left: idx * cellW, top: 0, width: 1, height: whiteKeyH, background: 'rgba(0,0,0,0.18)' }} />
            ) : null
          ))}
          {pitches.map((p, idx) => (
            p.includes('#') ? (
              <div key={p + '-blk'} style={{ position: 'absolute', left: idx * cellW + 4, top: 0, width: 14, height: blackKeyH, background: 'linear-gradient(180deg, #1c1a22, #050508)', borderRadius: '0 0 3px 3px', boxShadow: '0 2px 3px rgba(0,0,0,0.5)' }} />
            ) : null
          ))}
          {pitches.map((p, idx) => (
            !p.includes('#') && p.startsWith('C') ? (
              <div key={p + '-lbl'} className="me-mono" style={{ position: 'absolute', left: idx * cellW, bottom: 4, width: cellW, textAlign: 'center', fontSize: 8, color: '#12101A', pointerEvents: 'none' }}>{p}</div>
            ) : null
          ))}
        </div>
        <div style={{ width }}>
          {steps.map((_, stepIdx) => (
            <div key={stepIdx} style={{ display: 'flex', marginBottom: (stepIdx % 4 === 3) ? 6 : 0 }}>
              {pitches.map((p) => {
                const active = steps[stepIdx] === p;
                return (
                  <div
                    key={p}
                    onClick={() => onSetNote(stepIdx, p)}
                    style={{
                      width: cellW, height: rowH, cursor: 'pointer', boxSizing: 'border-box',
                      background: active ? color : (p.includes('#') ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)'),
                      border: currentStep === stepIdx ? '2px solid #EDE9F0' : '1px solid rgba(255,255,255,0.05)',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MixerRow({ label, vol, mute, onVolChange, onMuteToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <button
        onClick={onMuteToggle} className="me-mono"
        style={{ width: 26, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: mute ? '#C4576B' : 'transparent', color: mute ? '#12101A' : '#8B8496', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
      >M</button>
      <div style={{ width: 84, fontSize: 11, color: '#8B8496', flexShrink: 0 }}>{label}</div>
      <input type="range" className="me-slider" min={-30} max={6} value={vol} onChange={(e) => onVolChange(Number(e.target.value))} style={{ flex: 1 }} />
      <div className="me-mono" style={{ width: 40, fontSize: 10, color: '#8B8496', textAlign: 'right', flexShrink: 0 }}>{vol}dB</div>
    </div>
  );
}

function TopBar({ character, screen, onNavigate }) {
  if (!character) return null;
  return (
    <div className="me-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Disc3 size={20} style={{ color: '#E8A33D' }} />
        <div>
          <div className="me-display" style={{ fontSize: 15, fontWeight: 700 }}>{character.artistName}</div>
          <div style={{ fontSize: 11, color: '#8B8496' }}>{character.backgroundName}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
          <button className="me-btn-ghost" style={screen === 'studio' ? { borderColor: '#E8A33D', color: '#E8A33D' } : {}} onClick={() => onNavigate('studio')}>스튜디오</button>
          <button className="me-btn-ghost" style={screen === 'beatmaker' ? { borderColor: '#E8A33D', color: '#E8A33D' } : {}} onClick={() => onNavigate('beatmaker')}>비트메이커</button>
          <button className="me-btn-ghost" style={screen === 'community' ? { borderColor: '#E8A33D', color: '#E8A33D' } : {}} onClick={() => onNavigate('community')}>커뮤니티</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22 }} className="me-mono">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>명성</div>
          <div style={{ fontSize: 14, color: '#4FD1C5' }}>{Math.round(character.fame)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>자금</div>
          <div style={{ fontSize: 14, color: '#E8A33D' }}>{won(character.money)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>팬</div>
          <div style={{ fontSize: 14, color: '#E893A6' }}>{character.fansCount.toLocaleString('ko-KR')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#8B8496' }}>발매곡</div>
          <div style={{ fontSize: 14, color: '#EDE9F0' }}>{character.songs.length}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN APP
// ---------------------------------------------------------------------------

export default function MusicEmpireMVP() {
  const [screen, setScreen] = useState('intro');
  const [artistNameInput, setArtistNameInput] = useState('');
  const [character, setCharacter] = useState(null);
  const [draft, setDraft] = useState({
    title: '', genres: [], moods: [], bpm: 100, chordPresetId: 'p1', productionMode: 'beginner', vocalSource: 'self',
    sections: emptySections(), arrangement: [], editingSection: SECTION_TYPES[0],
  });
  const [mixer, setMixer] = useState(DEFAULT_MIXER);
  const [fx, setFx] = useState({ reverbWet: 20, delayWet: 15 });
  const [lastResult, setLastResult] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [playingId, setPlayingId] = useState(null);
  const [communityTab, setCommunityTab] = useState('feed');
  const [followedArtists, setFollowedArtists] = useState([]);

  const synthsRef = useRef(null);
  const fxNodesRef = useRef(null);
  const sequenceRef = useRef(null);

  function getSynths() {
    if (!synthsRef.current) {
      const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } });
      const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } });
      const hihatClosed = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } });
      const hihatOpen = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } });
      const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } });
      const tom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } });
      const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.8, sustain: 0 } });
      const bass = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.2 } });
      const piano = new Tone.FMSynth({ harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 0.6 }, modulation: { type: 'sine' } });
      const guitar = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.05, release: 0.1 } });

      const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000 }).toDestination();
      const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3 }).toDestination();
      const reverbSend = new Tone.Gain(0).connect(reverb);
      const delaySend = new Tone.Gain(0).connect(delay);

      const all = { kick, snare, hihatClosed, hihatOpen, clap, tom, crash, bass, piano, guitar };
      Object.entries(all).forEach(([key, synth]) => {
        synth.toDestination();
        synth.connect(reverbSend);
        synth.connect(delaySend);
        const m = mixer[key];
        synth.volume.value = m ? (m.mute ? -60 : m.vol) : 0;
      });

      synthsRef.current = all;
      fxNodesRef.current = { reverb, delay, reverbSend, delaySend };
      reverbSend.gain.value = fx.reverbWet / 100 * 0.6;
      delaySend.gain.value = fx.delayWet / 100 * 0.5;
    }
    return synthsRef.current;
  }

  function stopPattern() {
    if (sequenceRef.current) { sequenceRef.current.stop(); sequenceRef.current.dispose(); sequenceRef.current = null; }
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setCurrentStep(-1);
    setPlayingId(null);
  }

  async function playPattern(pattern, bpm, id) {
    await Tone.start();
    stopPattern();
    const synths = getSynths();
    Tone.Transport.bpm.value = bpm;
    const totalSteps = pattern.bass.length;
    const seq = new Tone.Sequence((time, idx) => {
      DRUM_INSTRUMENTS.forEach((di) => {
        if (pattern.drums[di.key][idx]) {
          if (di.key === 'kick') synths.kick.triggerAttackRelease('C1', '8n', time);
          else if (di.key === 'tom') synths.tom.triggerAttackRelease('G1', '8n', time);
          else synths[di.key].triggerAttackRelease('8n', time);
        }
      });
      if (pattern.bass[idx]) synths.bass.triggerAttackRelease(pattern.bass[idx], '8n', time);
      if (pattern.piano[idx]) synths.piano.triggerAttackRelease(pattern.piano[idx], '8n', time);
      if (pattern.guitar[idx]) synths.guitar.triggerAttackRelease(pattern.guitar[idx], '8n', time);
      Tone.Draw.schedule(() => setCurrentStep(idx), time);
    }, Array.from({ length: totalSteps }, (_, i) => i), '16n');
    seq.start(0);
    Tone.Transport.start();
    sequenceRef.current = seq;
    setIsPlaying(true);
    setPlayingId(id);
  }

  useEffect(() => {
    if (synthsRef.current) {
      Object.entries(mixer).forEach(([key, val]) => {
        if (synthsRef.current[key]) synthsRef.current[key].volume.value = val.mute ? -60 : val.vol;
      });
    }
  }, [mixer]);

  useEffect(() => {
    if (fxNodesRef.current) {
      fxNodesRef.current.reverbSend.gain.value = fx.reverbWet / 100 * 0.6;
      fxNodesRef.current.delaySend.gain.value = fx.delayWet / 100 * 0.5;
    }
  }, [fx]);

  useEffect(() => {
    return () => {
      if (sequenceRef.current) { sequenceRef.current.stop(); sequenceRef.current.dispose(); }
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (synthsRef.current) Object.values(synthsRef.current).forEach((s) => s.dispose());
      if (fxNodesRef.current) {
        fxNodesRef.current.reverb.dispose();
        fxNodesRef.current.delay.dispose();
        fxNodesRef.current.reverbSend.dispose();
        fxNodesRef.current.delaySend.dispose();
      }
    };
  }, []);

  function confirmBackground(bg) {
    const resolved = bg.id === 'random' ? makeRandomBackground() : bg;
    setCharacter({
      artistName: artistNameInput.trim() || '무명',
      backgroundId: resolved.id, backgroundName: resolved.name,
      stats: { ...resolved.stats }, talent: { ...resolved.talent },
      fame: resolved.fame, money: resolved.money,
      fansCount: Math.round(resolved.fame * 8 + 30),
      songs: [], personaLoyalty: Object.fromEntries(FAN_PERSONAS.map((p) => [p.id, 0])),
    });
    setScreen('studio');
  }

  function toggleTag(field, tag, max) {
    setDraft((d) => {
      const list = d[field];
      if (list.includes(tag)) return { ...d, [field]: list.filter((t) => t !== tag) };
      if (list.length >= max) return d;
      return { ...d, [field]: [...list, tag] };
    });
  }

  function toggleDrumStep(instKey, idx) {
    setDraft((d) => {
      const sec = d.sections[d.editingSection];
      const arr = [...sec.drums[instKey]];
      arr[idx] = !arr[idx];
      return { ...d, sections: { ...d.sections, [d.editingSection]: { ...sec, drums: { ...sec.drums, [instKey]: arr } } } };
    });
  }

  function setNoteStep(track, idx, pitch) {
    setDraft((d) => {
      const sec = d.sections[d.editingSection];
      const arr = [...sec[track]];
      arr[idx] = arr[idx] === pitch ? null : pitch;
      return { ...d, sections: { ...d.sections, [d.editingSection]: { ...sec, [track]: arr } } };
    });
  }

  function setLyrics(text) {
    setDraft((d) => ({ ...d, sections: { ...d.sections, [d.editingSection]: { ...d.sections[d.editingSection], lyrics: text } } }));
  }

  function setSectionLength(length) {
    setDraft((d) => {
      const sec = d.sections[d.editingSection];
      const resize = (arr, fill) => { const out = arr.slice(0, length); while (out.length < length) out.push(fill); return out; };
      const newDrums = {};
      DRUM_INSTRUMENTS.forEach((di) => { newDrums[di.key] = resize(sec.drums[di.key], false); });
      return { ...d, sections: { ...d.sections, [d.editingSection]: { ...sec, length, drums: newDrums, bass: resize(sec.bass, null), piano: resize(sec.piano, null), guitar: resize(sec.guitar, null) } } };
    });
  }

  function loadBasicPattern() {
    setDraft((d) => {
      const sec = d.sections[d.editingSection];
      const loaded = basicPatternForLength(sec.length);
      return { ...d, sections: { ...d.sections, [d.editingSection]: { ...loaded, lyrics: sec.lyrics } } };
    });
  }

  function clearSection() {
    setDraft((d) => {
      const sec = d.sections[d.editingSection];
      const cleared = emptySection(sec.length);
      return { ...d, sections: { ...d.sections, [d.editingSection]: { ...cleared, lyrics: sec.lyrics } } };
    });
  }

  function addToArrangement(type) {
    setDraft((d) => ({ ...d, arrangement: [...d.arrangement, type], editingSection: type }));
  }
  function removeFromArrangement(idx) {
    setDraft((d) => ({ ...d, arrangement: d.arrangement.filter((_, i) => i !== idx) }));
  }
  function moveArrangement(idx, dir) {
    setDraft((d) => {
      const arr = [...d.arrangement];
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return d;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return { ...d, arrangement: arr };
    });
  }

  function toggleFollow(id) {
    setFollowedArtists((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }

  const combinedDraft = buildCombinedPattern(draft.sections, draft.arrangement);
  const patternInfo = analyzeCombinedPattern(combinedDraft);
  const canRelease = draft.title.trim() && draft.genres.length > 0 && draft.moods.length > 0 && draft.arrangement.length > 0 && patternInfo.totalActive >= 6;

  function handleRelease() {
    if (!canRelease) return;
    if (isPlaying) stopPattern();
    const combined = buildCombinedPattern(draft.sections, draft.arrangement);
    const result = computeRelease(character, draft, combined);
    const songId = Date.now();
    const songRecord = { id: songId, title: draft.title, tier: result.tier, score: Math.round(result.overallScore), pattern: combined, bpm: draft.bpm };
    setCharacter((prev) => ({
      ...prev,
      fame: clamp(prev.fame + result.fameDelta, 0, 100),
      money: Math.max(0, prev.money + result.moneyDelta),
      fansCount: Math.max(0, prev.fansCount + result.fansDelta),
      songs: [...prev.songs, songRecord],
      personaLoyalty: result.newLoyalty,
    }));
    setLastResult({ ...result, songTitle: draft.title, songId, pattern: combined, bpm: draft.bpm });
    setScreen('results');
  }

  function nextSong() {
    if (isPlaying) stopPattern();
    setDraft({
      title: '', genres: [], moods: [], bpm: 100, chordPresetId: 'p1', productionMode: 'beginner', vocalSource: 'self',
      sections: emptySections(), arrangement: [], editingSection: SECTION_TYPES[0],
    });
    setScreen('studio');
  }

  const editingSec = character ? draft.sections[draft.editingSection] : null;
  const chartEntries = character ? [
    ...NPC_ARTISTS.map((a) => ({ ...a.song, artistName: a.name })),
    ...character.songs.map((s) => ({ ...s, artistName: character.artistName })),
  ].sort((a, b) => b.score - a.score) : [];

  return (
    <div className="me-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&family=Gaegu:wght@400;700&display=swap');
        .me-root{ min-height:100vh; background:#12101A; background-image: radial-gradient(circle at 15% 0%, rgba(232,163,61,0.10), transparent 45%), radial-gradient(circle at 85% 100%, rgba(79,209,197,0.08), transparent 45%); color:#EDE9F0; font-family:'Inter',sans-serif; }
        .me-display{ font-family:'Bricolage Grotesque', sans-serif; }
        .me-mono{ font-family:'JetBrains Mono', monospace; }
        .me-topbar{ display:flex; align-items:center; justify-content:space-between; padding:12px 24px; background:rgba(20,18,28,0.9); border-bottom:1px solid rgba(255,255,255,0.08); position:sticky; top:0; z-index:10; flex-wrap:wrap; gap:10px; }
        .me-panel{ background:#1C1926; border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px; }
        .me-card{ background:#1C1926; border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px; cursor:pointer; transition:border-color .2s, transform .15s; }
        .me-card:hover{ border-color:#E8A33D; transform:translateY(-2px); }
        .me-card.selected{ border-color:#4FD1C5; box-shadow:0 0 0 1px #4FD1C5; }
        .me-pill{ display:inline-flex; align-items:center; padding:7px 15px; border-radius:999px; border:1px solid rgba(255,255,255,0.15); font-size:13px; cursor:pointer; transition:all .15s; background:rgba(255,255,255,0.03); color:#EDE9F0; }
        .me-pill.active{ background:#E8A33D; border-color:#E8A33D; color:#12101A; font-weight:600; }
        .me-pill.small{ padding:5px 12px; font-size:12px; }
        .me-btn-primary{ background:#E8A33D; color:#12101A; font-weight:700; border:none; border-radius:10px; padding:13px 22px; cursor:pointer; transition:filter .15s; font-size:14px; }
        .me-btn-primary:hover{ filter:brightness(1.08); }
        .me-btn-primary:disabled{ opacity:0.3; cursor:not-allowed; }
        .me-btn-ghost{ background:transparent; color:#EDE9F0; border:1px solid rgba(255,255,255,0.2); border-radius:10px; padding:9px 16px; cursor:pointer; font-size:12px; }
        .me-btn-ghost:hover{ border-color:#4FD1C5; }
        .me-btn-ghost:disabled{ opacity:0.3; cursor:not-allowed; }
        .me-chip{ display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; background:#1C1926; border:1px solid rgba(255,255,255,0.1); font-size:12px; cursor:pointer; white-space:nowrap; }
        .me-chip:hover{ border-color:#4FD1C5; }
        .me-chip button{ background:none; border:none; color:#8B8496; cursor:pointer; font-size:11px; padding:0 2px; }
        .me-chip button:hover{ color:#EDE9F0; }
        .me-fader-col{ display:flex; flex-direction:column; align-items:center; gap:8px; width:64px; }
        .me-fader-track{ position:relative; width:14px; height:170px; background:#0E0C14; border-radius:7px; border:1px solid rgba(255,255,255,0.1); overflow:hidden; }
        .me-fader-fill{ position:absolute; bottom:0; left:0; width:100%; border-radius:7px; transition:height 1s cubic-bezier(.2,.8,.2,1); }
        .me-fader-cap{ position:absolute; left:-4px; width:22px; height:6px; border-radius:3px; background:#EDE9F0; box-shadow:0 0 8px rgba(255,255,255,0.6); transition:bottom 1s cubic-bezier(.2,.8,.2,1); }
        input[type=range].me-slider{ -webkit-appearance:none; width:100%; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; }
        input[type=range].me-slider::-webkit-slider-thumb{ -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#E8A33D; cursor:pointer; }
        .me-scroll::-webkit-scrollbar{ height:6px; width:6px; }
        .me-scroll::-webkit-scrollbar-thumb{ background:rgba(255,255,255,0.15); border-radius:3px; }
        .me-notebook{ background: repeating-linear-gradient(#1C1926 0px, #1C1926 27px, rgba(255,255,255,0.08) 28px), #1C1926; border:1px solid rgba(255,255,255,0.08); border-radius:10px; position:relative; padding:14px 14px 14px 40px; }
        .me-notebook::before{ content:''; position:absolute; left:26px; top:0; bottom:0; width:1px; background:rgba(196,87,107,0.35); }
        .me-notebook textarea{ background:transparent; border:none; outline:none; width:100%; min-height:170px; resize:vertical; color:#EDE9F0; font-family:'Gaegu',sans-serif; font-size:17px; line-height:28px; box-sizing:border-box; }
      `}</style>

      {screen === 'intro' && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
          <Disc3 size={52} style={{ color: '#E8A33D', marginBottom: 16 }} />
          <div className="me-display" style={{ fontSize: 40, fontWeight: 800 }}>Music Empire</div>
          <div className="me-mono" style={{ color: '#8B8496', marginTop: 6, fontSize: 13, letterSpacing: 2 }}>THE MUSIC LIFE — MVP PROTOTYPE</div>
          <p style={{ maxWidth: 460, color: '#B8B2C4', marginTop: 22, lineHeight: 1.7, fontSize: 14 }}>
            능력치는 성공을 보장하지 않는다. 팬은 모두 다른 귀를 가지고 있다.<br />
            곡을 만들고, 가사를 쓰고, 세상에 내놓고 다른 아티스트들과 경쟁해보자.
          </p>
          <input
            placeholder="아티스트명을 입력하세요" value={artistNameInput} onChange={(e) => setArtistNameInput(e.target.value)}
            className="me-mono" style={{ marginTop: 28, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#1C1926', color: '#EDE9F0', width: 280, textAlign: 'center', outline: 'none' }}
          />
          <button className="me-btn-primary" style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => setScreen('character')} disabled={!artistNameInput.trim()}>
            인생 시작하기 <ChevronRight size={17} />
          </button>
        </div>
      )}

      {screen === 'character' && (
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px' }}>
          <div className="me-display" style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>시작 배경을 선택하세요</div>
          <div style={{ color: '#8B8496', fontSize: 13, marginBottom: 24 }}>모든 배경은 각자의 장단점이 있다. 강제된 정답은 없다.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {BACKGROUNDS.map((bg) => (
              <div key={bg.id} className="me-card" onClick={() => confirmBackground(bg)}>
                <div className="me-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{bg.name}</div>
                <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 10 }}>{bg.tagline}</div>
                <div style={{ fontSize: 11, color: '#4FD1C5', marginBottom: 2 }}>+ {bg.pro}</div>
                <div style={{ fontSize: 11, color: '#C4576B' }}>− {bg.con}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === 'studio' && character && (
        <div>
          <TopBar character={character} screen={screen} onNavigate={setScreen} />
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 20px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            <div className="me-panel">
              <div className="me-display" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Music2 size={20} style={{ color: '#E8A33D' }} /> 곡 기본 정보
              </div>
              <div style={{ color: '#8B8496', fontSize: 12, marginBottom: 20 }}>곡의 방향을 정하세요. 발매 후에는 되돌릴 수 없습니다.</div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>곡 제목</div>
                <input
                  value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="곡 제목을 입력하세요"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#12101A', color: '#EDE9F0', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>BPM: <span className="me-mono">{draft.bpm}</span></div>
                <input type="range" className="me-slider" min={60} max={180} value={draft.bpm} onChange={(e) => setDraft((d) => ({ ...d, bpm: Number(e.target.value) }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>장르 (최대 2개)</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {GENRES.map((g) => (
                      <div key={g} className={`me-pill small ${draft.genres.includes(g) ? 'active' : ''}`} onClick={() => toggleTag('genres', g, 2)}>{g}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>분위기 (최대 2개)</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {MOODS.map((m) => (
                      <div key={m} className={`me-pill small ${draft.moods.includes(m) ? 'active' : ''}`} onClick={() => toggleTag('moods', m, 2)}>{m}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>코드 진행</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {CHORD_PRESETS.map((c) => (
                    <div key={c.id} className={`me-card ${draft.chordPresetId === c.id ? 'selected' : ''}`} style={{ padding: 10 }} onClick={() => setDraft((d) => ({ ...d, chordPresetId: c.id }))}>
                      <div className="me-mono" style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: '#8B8496', marginTop: 2 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>제작 모드</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div className={`me-pill small ${draft.productionMode === 'beginner' ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, productionMode: 'beginner' }))}>초보자</div>
                    <div className={`me-pill small ${draft.productionMode === 'expert' ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, productionMode: 'expert' }))}>전문가</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 8 }}>보컬</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <div className={`me-pill small ${draft.vocalSource === 'self' ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, vocalSource: 'self' }))}>직접</div>
                    <div className={`me-pill small ${draft.vocalSource === 'ai' ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, vocalSource: 'ai' }))}>AI</div>
                    <div
                      className={`me-pill small ${draft.vocalSource === 'npc' ? 'active' : ''}`}
                      style={character.money < 300 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      onClick={() => character.money >= 300 && setDraft((d) => ({ ...d, vocalSource: 'npc' }))}
                    >NPC 고용</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="me-panel" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} style={{ color: '#4FD1C5' }} /> 실력 스탯</div>
                {Object.entries(character.stats).map(([k, v]) => (<MiniBar key={k} label={k} value={v} color="#4FD1C5" />))}
              </div>
              <div className="me-panel" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={15} style={{ color: '#E8A33D' }} /> 재능</div>
                {Object.entries(character.talent).map(([k, v]) => (<MiniBar key={k} label={k} value={v} color="#E8A33D" />))}
              </div>
              {character.songs.length > 0 && (
                <div className="me-panel">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>발매 기록</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }} className="me-scroll">
                    {character.songs.slice().reverse().map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span className="me-btn-ghost" style={{ padding: '2px 8px', fontSize: 11, borderRadius: 6 }} onClick={() => (isPlaying && playingId === s.id) ? stopPattern() : playPattern(s.pattern, s.bpm, s.id)}>
                          {(isPlaying && playingId === s.id) ? '■' : '▶'}
                        </span>
                        <span style={{ color: '#EDE9F0', flex: 1, margin: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                        <span className="me-mono" style={{ color: TIER_COLOR[s.tier] }}>{s.tier} · {s.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 60px' }}>
            <div className="me-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#8B8496' }}>기본 정보를 정했다면 비트메이커에서 곡을 완성하세요.</div>
              <button className="me-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => setScreen('beatmaker')}>
                비트메이커로 이동 <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'beatmaker' && character && (
        <div>
          <TopBar character={character} screen={screen} onNavigate={setScreen} />
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 60px' }}>
            <div className="me-panel" style={{ marginBottom: 20 }}>
              <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: '#4FD1C5' }} /> 곡 구조
              </div>
              <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 10 }}>섹션을 추가해 순서를 짜세요. 같은 종류의 섹션은 같은 패턴을 공유합니다.</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {SECTION_TYPES.map((t) => (
                  <button key={t} className="me-btn-ghost" onClick={() => addToArrangement(t)}>+ {t}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, minHeight: 34 }}>
                {draft.arrangement.length === 0 && <span style={{ fontSize: 12, color: '#6B6577' }}>아직 구조가 비어있습니다. 위 버튼으로 섹션을 추가하세요.</span>}
                {draft.arrangement.map((key, idx) => (
                  <div key={idx} className="me-chip" onClick={() => setDraft((d) => ({ ...d, editingSection: key }))} style={draft.editingSection === key ? { borderColor: '#E8A33D' } : {}}>
                    <span>{idx + 1}. {key}</span>
                    <button onClick={(e) => { e.stopPropagation(); moveArrangement(idx, -1); }}>◀</button>
                    <button onClick={(e) => { e.stopPropagation(); moveArrangement(idx, 1); }}>▶</button>
                    <button onClick={(e) => { e.stopPropagation(); removeFromArrangement(idx); }}>×</button>
                  </div>
                ))}
              </div>
              <button
                className="me-btn-primary" style={{ padding: '10px 18px' }} disabled={draft.arrangement.length === 0}
                onClick={() => (isPlaying && playingId === 'draft-full') ? stopPattern() : playPattern(combinedDraft, draft.bpm, 'draft-full')}
              >
                {(isPlaying && playingId === 'draft-full') ? '■ 정지' : '▶ 전체 곡 재생'}
              </button>
            </div>

            <div className="me-panel" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div className="me-display" style={{ fontSize: 18, fontWeight: 800 }}>섹션 편집</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className={`me-pill small ${editingSec.length === 16 ? 'active' : ''}`} onClick={() => setSectionLength(16)}>1마디 (16)</div>
                  <div className={`me-pill small ${editingSec.length === 32 ? 'active' : ''}`} onClick={() => setSectionLength(32)}>2마디 (32)</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {SECTION_TYPES.map((t) => (
                  <div key={t} className={`me-pill small ${draft.editingSection === t ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, editingSection: t }))}>
                    {t}{sectionHasContent(draft.sections[t]) ? ' ●' : ''}
                  </div>
                ))}
              </div>

              <div className="me-scroll" style={{ overflowX: 'auto', marginBottom: 8 }}>
                <div style={{ minWidth: 520 }}>
                  {DRUM_INSTRUMENTS.map((di) => (
                    <DrumRow key={di.key} label={di.label} steps={editingSec.drums[di.key]} onToggle={(i) => toggleDrumStep(di.key, i)} currentStep={playingId === 'section-preview' ? currentStep : -1} color={di.color} />
                  ))}
                  <div style={{ height: 8 }} />
                  <PianoRoll label="베이스" pitches={BASS_PITCHES} steps={editingSec.bass} onSetNote={(i, p) => setNoteStep('bass', i, p)} currentStep={playingId === 'section-preview' ? currentStep : -1} color="#5FBF8F" />
                  <PianoRoll label="기타" pitches={GUITAR_PITCHES} steps={editingSec.guitar} onSetNote={(i, p) => setNoteStep('guitar', i, p)} currentStep={playingId === 'section-preview' ? currentStep : -1} color="#E8C34D" />
                </div>
              </div>

              <div className="me-scroll" style={{ overflowX: 'auto', marginTop: 16 }}>
                <div style={{ minWidth: 520 }}>
                  <PianoKeyRoll label="피아노" pitches={[...PIANO_PITCHES].reverse()} steps={editingSec.piano} onSetNote={(i, p) => setNoteStep('piano', i, p)} currentStep={playingId === 'section-preview' ? currentStep : -1} color="#B794F4" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="me-btn-ghost" onClick={loadBasicPattern}>기본 패턴 불러오기</button>
                <button className="me-btn-ghost" onClick={clearSection}>이 섹션 지우기</button>
                <button
                  className="me-btn-ghost"
                  onClick={() => (isPlaying && playingId === 'section-preview') ? stopPattern() : playPattern(buildCombinedPattern(draft.sections, [draft.editingSection]), draft.bpm, 'section-preview')}
                >
                  {(isPlaying && playingId === 'section-preview') ? '■ 정지' : `▶ ${draft.editingSection} 미리듣기`}
                </button>
              </div>
            </div>

            <div className="me-panel" style={{ marginBottom: 20 }}>
              <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} style={{ color: '#E893A6' }} /> 가사 노트 — {draft.editingSection}
              </div>
              <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 12 }}>섹션을 바꾸려면 위 "섹션 편집" 탭을 클릭하세요.</div>
              <div className="me-notebook">
                <textarea value={editingSec.lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="가사를 적어보세요..." />
              </div>
              <div style={{ fontSize: 10, color: '#6B6577', marginTop: 8 }}>
                {editingSec.lyrics.trim() ? `${editingSec.lyrics.trim().split(/\s+/).length}단어` : '아직 가사가 없어요'} · 완성도에 소폭 반영돼요
              </div>
            </div>

            <div className="me-panel" style={{ marginBottom: 20 }}>
              <div className="me-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={18} style={{ color: '#E8A33D' }} /> 믹서 & 이펙트
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 28px' }}>
                {MIXER_TRACKS.map((t) => (
                  <MixerRow
                    key={t.key} label={t.label} vol={mixer[t.key].vol} mute={mixer[t.key].mute}
                    onVolChange={(v) => setMixer((m) => ({ ...m, [t.key]: { ...m[t.key], vol: v } }))}
                    onMuteToggle={() => setMixer((m) => ({ ...m, [t.key]: { ...m[t.key], mute: !m[t.key].mute } }))}
                  />
                ))}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0 16px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>리버브 <span className="me-mono">{fx.reverbWet}%</span></div>
                  <input type="range" className="me-slider" min={0} max={100} value={fx.reverbWet} onChange={(e) => setFx((f) => ({ ...f, reverbWet: Number(e.target.value) }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#8B8496', marginBottom: 6 }}>딜레이 <span className="me-mono">{fx.delayWet}%</span></div>
                  <input type="range" className="me-slider" min={0} max={100} value={fx.delayWet} onChange={(e) => setFx((f) => ({ ...f, delayWet: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            <div className="me-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 11, color: canRelease ? '#4FD1C5' : '#C4576B' }}>
                {draft.arrangement.length === 0 ? '곡 구조에 섹션을 최소 1개 이상 추가하세요' :
                  patternInfo.totalActive < 6 ? `최소 6칸 이상 입력해야 발매할 수 있어요 (현재 ${patternInfo.totalActive}개)` :
                  `${patternInfo.totalActive}개 스텝 · ${draft.arrangement.length}개 섹션 구성 완료`}
              </div>
              <button className="me-btn-primary" onClick={handleRelease} disabled={!canRelease}>곡 발매하기</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'community' && character && (
        <div>
          <TopBar character={character} screen={screen} onNavigate={setScreen} />
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
              <div className={`me-pill ${communityTab === 'feed' ? 'active' : ''}`} onClick={() => setCommunityTab('feed')}>피드</div>
              <div className={`me-pill ${communityTab === 'chart' ? 'active' : ''}`} onClick={() => setCommunityTab('chart')}>차트</div>
            </div>

            {communityTab === 'feed' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#8B8496', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> 내 곡</div>
                {character.songs.length === 0 && <div style={{ fontSize: 12, color: '#6B6577', marginBottom: 24 }}>아직 발매한 곡이 없어요. 스튜디오에서 곡을 만들어보세요.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {character.songs.slice().reverse().map((s) => (
                    <div key={s.id} className="me-panel" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} onClick={() => (isPlaying && playingId === s.id) ? stopPattern() : playPattern(s.pattern, s.bpm, s.id)}>
                          {(isPlaying && playingId === s.id) ? '■' : '▶'}
                        </span>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{character.artistName}</div>
                        <div style={{ fontSize: 11, color: '#8B8496' }}>· {s.title}</div>
                        <div className="me-mono" style={{ marginLeft: 'auto', fontSize: 12, color: TIER_COLOR[s.tier] }}>{s.tier} · {s.score}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[0, 1, 2].map((i) => (<div key={i} style={{ fontSize: 11, color: '#B8B2C4' }}>💬 {pickLine(tierKeyFromScore(s.score))}</div>))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#8B8496' }}>다른 아티스트</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {NPC_ARTISTS.map((a) => (
                    <div key={a.id} className="me-panel" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} onClick={() => (isPlaying && playingId === a.song.id) ? stopPattern() : playPattern(a.song.pattern, a.song.bpm, a.song.id)}>
                          {(isPlaying && playingId === a.song.id) ? '■' : '▶'}
                        </span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#8B8496' }}>· {a.song.title}</div>
                        <div className="me-mono" style={{ fontSize: 12, color: TIER_COLOR[a.song.tier] }}>{a.song.tier} · {a.song.score}</div>
                        <button className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 11, marginLeft: 'auto' }} onClick={() => toggleFollow(a.id)}>
                          {followedArtists.includes(a.id) ? '팔로잉' : '+ 팔로우'}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B6577', marginBottom: 6 }}>{a.bio}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[0, 1].map((i) => (<div key={i} style={{ fontSize: 11, color: '#B8B2C4' }}>💬 {pickLine(tierKeyFromScore(a.song.score))}</div>))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {communityTab === 'chart' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#8B8496', display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} /> 종합 차트</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chartEntries.map((s, idx) => (
                    <div key={s.id} className="me-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="me-mono" style={{ width: 22, fontSize: 14, fontWeight: 700, color: idx === 0 ? '#E8A33D' : idx === 1 ? '#4FD1C5' : idx === 2 ? '#E893A6' : '#8B8496' }}>{idx + 1}</div>
                      <span className="me-btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }} onClick={() => (isPlaying && playingId === s.id) ? stopPattern() : playPattern(s.pattern, s.bpm, s.id)}>
                        {(isPlaying && playingId === s.id) ? '■' : '▶'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                        <div style={{ fontSize: 11, color: '#8B8496' }}>{s.artistName}</div>
                      </div>
                      <div className="me-mono" style={{ fontSize: 13, color: TIER_COLOR[s.tier] }}>{s.tier} · {s.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'results' && lastResult && character && (
        <div>
          <TopBar character={character} screen={screen} onNavigate={setScreen} />
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#8B8496', marginBottom: 6 }}>"{lastResult.songTitle}" 발매 결과</div>
              <div className="me-display" style={{ fontSize: 56, fontWeight: 800, color: TIER_COLOR[lastResult.tier] }}>{Math.round(lastResult.overallScore)}</div>
              <div className="me-display" style={{ fontSize: 22, fontWeight: 700, color: TIER_COLOR[lastResult.tier] }}>{lastResult.tier}</div>
              <button
                className="me-btn-ghost" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => (isPlaying && playingId === lastResult.songId) ? stopPattern() : playPattern(lastResult.pattern, lastResult.bpm, lastResult.songId)}
              >
                {(isPlaying && playingId === lastResult.songId) ? '■ 정지' : '▶ 다시 듣기'}
              </button>
              {lastResult.sleeperHit && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#4FD1C5', fontSize: 13 }}>
                  <Flame size={15} /> 역주행! 저노출에도 입소문으로 재조명받았다
                </div>
              )}
              {lastResult.geniusEvent && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#E8A33D', fontSize: 13 }}>
                  <Star size={15} /> 영감의 순간 — 독창적인 시도가 터졌다
                </div>
              )}
            </div>

            <div className="me-panel" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>반응 믹서 콘솔</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
                <Fader label="도달률" value={lastResult.breakdown.reachRatio} color="#8B7FD1" />
                <Fader label="완청률" value={lastResult.breakdown.completionRate * 100} color="#4FD1C5" />
                <Fader label="반복재생" value={lastResult.breakdown.repeatPlayRate * 100} color="#E8A33D" />
                <Fader label="저장율" value={lastResult.breakdown.saveRate * 100} color="#E893A6" />
                <Fader label="공유율" value={lastResult.breakdown.shareRate * 100} color="#5FBF8F" />
                <Fader label="팬 매칭도" value={lastResult.breakdown.fanAffinityMatch} color="#C4576B" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>완성도</div>
                <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.craft)}</div>
              </div>
              <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>독창성</div>
                <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.originality)}</div>
              </div>
              <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>대중성</div>
                <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.accessibility)}</div>
              </div>
              <div className="me-panel" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>실험성</div>
                <div className="me-mono" style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(lastResult.attributes.experimental)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 24 }} className="me-mono">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>팬 변화</div>
                <div style={{ fontSize: 16, color: lastResult.fansDelta >= 0 ? '#4FD1C5' : '#C4576B' }}>{lastResult.fansDelta >= 0 ? '+' : ''}{lastResult.fansDelta}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>자금 변화</div>
                <div style={{ fontSize: 16, color: lastResult.moneyDelta >= 0 ? '#4FD1C5' : '#C4576B' }}>{lastResult.moneyDelta >= 0 ? '+' : ''}{won(lastResult.moneyDelta)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#8B8496' }}>명성 변화</div>
                <div style={{ fontSize: 16, color: lastResult.fameDelta >= 0 ? '#4FD1C5' : '#C4576B' }}>{lastResult.fameDelta >= 0 ? '+' : ''}{lastResult.fameDelta}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} style={{ color: '#8B7FD1' }} /> 팬 반응</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {lastResult.personaResults.map((r) => {
                const key = r.reached ? tierKeyFromScore(r.reactionScore) : null;
                const Icon = key ? TIER_ICON[key] : Meh;
                const tierNameByKey = { love: '대박', good: '성공', meh: '무난', bad: '부진', awful: '참패' };
                return (
                  <div key={r.persona.id} className="me-panel" style={{ padding: 12, opacity: r.reached ? 1 : 0.45 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.persona.color }} />
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.persona.name}</div>
                      <Icon size={14} style={{ marginLeft: 'auto', color: key ? TIER_COLOR[tierNameByKey[key]] : '#8B8496' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#B8B2C4', lineHeight: 1.4 }}>
                      {r.reached ? pickLine(key) : '아직 이 곡을 발견하지 못했다'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: 30 }}>
              <button className="me-btn-primary" onClick={nextSong} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={16} /> 다음 곡 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
