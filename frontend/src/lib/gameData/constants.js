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

// `icon` is shown next to every label so the instrument is recognisable at a
// glance without reading — playtesters asked for it.
export const DRUM_INSTRUMENTS = [
  { key: 'kick', label: '킥', icon: '🥁', color: '#E8A33D' },
  { key: 'snare', label: '스네어', icon: '🪘', color: '#4FD1C5' },
  { key: 'hihatClosed', label: '클로즈 하이햇', icon: '🎩', color: '#8B7FD1' },
  { key: 'hihatOpen', label: '오픈 하이햇', icon: '👒', color: '#7FA8D1' },
  { key: 'clap', label: '클랩', icon: '👏', color: '#E893A6' },
  { key: 'tom', label: '톰', icon: '🛢️', color: '#D18B4C' },
  { key: 'crash', label: '크래시', icon: '💥', color: '#C4576B' },
];

// Mixer channels — the 7 drum voices share one channel (they're one
// instrument, the drum machine), the melodic voices get one each. Effects
// chains and the channel rack are keyed by these.
// Channels are grouped into instrument families (cat) so the rack stays tidy
// as the roster grows — the channel rack renders one collapsible section per
// category in CHANNEL_CATEGORIES order.
export const CHANNEL_CATEGORIES = [
  { key: 'drums', label: '드럼·타악' },
  { key: 'keys', label: '건반' },
  { key: 'guitars', label: '기타·베이스' },
  { key: 'strings', label: '현악' },
  { key: 'winds', label: '관악' },
  { key: 'synth', label: '신스' },
];

export const CHANNELS = [
  { key: 'drums', label: 'DrumMachine', icon: '🥁', color: '#E8A33D', plugin: 'drums', cat: 'drums' },

  { key: 'piano', label: '그랜드 피아노', icon: '🎹', color: '#4FD1C5', plugin: null, cat: 'keys' },
  { key: 'ePiano', label: '일렉 피아노', icon: '🎹', color: '#4FD1C5', plugin: null, cat: 'keys' },
  { key: 'harpsichord', label: '하프시코드', icon: '🎹', color: '#7FD1C5', plugin: null, cat: 'keys' },
  { key: 'organ', label: '오르간', icon: '⛪', color: '#6FC5B5', plugin: null, cat: 'keys' },

  { key: 'bass', label: 'Bass Synth', icon: '🎸', color: '#8B7FD1', plugin: null, cat: 'guitars' },
  { key: 'guitar', label: '어쿠스틱 기타', icon: '🎸', color: '#5FBF8F', plugin: null, cat: 'guitars' },
  { key: 'elecGuitar', label: 'Elec Guitar', icon: '⚡', color: '#E86A4D', plugin: null, cat: 'guitars' },

  { key: 'strings', label: '스트링 앙상블', icon: '🎻', color: '#7FA8D1', plugin: null, cat: 'strings' },
  { key: 'violin', label: '바이올린', icon: '🎻', color: '#8FB8E1', plugin: null, cat: 'strings' },
  { key: 'cello', label: '첼로', icon: '🎻', color: '#6F98C1', plugin: null, cat: 'strings' },
  { key: 'harp', label: '하프', icon: '🪕', color: '#9FC8E1', plugin: null, cat: 'strings' },

  { key: 'brass', label: 'Brass', icon: '🎺', color: '#E8A33D', plugin: null, cat: 'winds' },
  { key: 'flute', label: '플루트', icon: '🪈', color: '#E8C34D', plugin: null, cat: 'winds' },
  { key: 'clarinet', label: '클라리넷', icon: '🎷', color: '#D8B33D', plugin: null, cat: 'winds' },

  { key: 'synthLead', label: 'Synth Lead', icon: '🎛️', color: '#E893A6', plugin: null, cat: 'synth' },
  { key: 'pad', label: 'Synth Pad', icon: '🌊', color: '#8B7FD1', plugin: null, cat: 'synth' },
];
export const CHANNEL_KEYS = CHANNELS.map((c) => c.key);
// The fader the player actually rides, applied to the channel bus. DEFAULT_MIXER
// below stays as the factory balance between voices inside a channel (e.g. the
// hihat sitting under the kick) and isn't edited from the UI any more.
export const DEFAULT_CHANNEL_MIX = Object.fromEntries(
  CHANNEL_KEYS.map((k) => [k, { vol: 0, mute: false }])
);

// Per-channel insert effects. Params are 0-100-ish UI numbers; engine.js maps
// them onto the actual Tone.js node properties (see toReverb/toDelay there).
export const EFFECT_TYPES = {
  reverb: {
    label: 'Reverb',
    color: '#4FD1C5',
    params: [
      { key: 'size', label: 'Size', min: 0, max: 100, step: 1, default: 70 },
      { key: 'damp', label: 'Damp', min: 0, max: 100, step: 1, default: 45 },
      { key: 'wet', label: 'Wet', min: 0, max: 100, step: 1, default: 35 },
    ],
  },
  delay: {
    label: 'Delay',
    color: '#E893A6',
    params: [
      { key: 'time', label: 'Time', min: 0, max: 100, step: 1, default: 30 },
      { key: 'feedback', label: 'F.Back', min: 0, max: 90, step: 1, default: 30 },
      { key: 'wet', label: 'Wet', min: 0, max: 100, step: 1, default: 25 },
    ],
  },
};
export const EFFECT_TYPE_KEYS = Object.keys(EFFECT_TYPES);

// Per-drum synthesis knobs shown in the DrumMachine plugin window. Pitch is
// semitones, gain is a dB trim on top of the channel fader, decay is a
// percentage of the voice's designed decay time.
export const DRUM_PARAM_SPECS = [
  { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1, default: 0, bipolar: true, unit: 'st' },
  { key: 'gain', label: 'Gain', min: -12, max: 12, step: 0.5, default: 0, bipolar: true, unit: 'dB' },
  { key: 'decay', label: 'Decay', min: 25, max: 250, step: 5, default: 100, bipolar: false, unit: '%' },
];
export const DEFAULT_DRUM_PARAMS = Object.fromEntries(
  DRUM_INSTRUMENTS.map((d) => [d.key, { pitch: 0, gain: 0, decay: 100 }])
);

// Preset kits — one click retunes all seven voices. Values are the same
// pitch/gain/decay the knobs edit, so picking a kit and then nudging a knob
// works exactly as expected (the kit just becomes '커스텀').
const kit = (entries) => Object.fromEntries(
  DRUM_INSTRUMENTS.map((d) => [d.key, { pitch: 0, gain: 0, decay: 100, ...(entries[d.key] || {}) }])
);
export const DRUM_KITS = [
  { id: 'basic', label: '기본 킷', params: kit({}) },
  {
    id: '808', label: '808 킷',
    params: kit({
      kick: { pitch: -7, gain: 2, decay: 230 }, snare: { pitch: -2, decay: 80 },
      hihatClosed: { pitch: 2, gain: -1, decay: 70 }, hihatOpen: { pitch: 1, gain: -1, decay: 120 },
      clap: { gain: 1, decay: 110 }, tom: { pitch: -4, decay: 150 }, crash: { pitch: -1, gain: -2, decay: 130 },
    }),
  },
  {
    id: 'acoustic', label: '어쿠스틱 킷',
    params: kit({
      kick: { pitch: 2, decay: 75 }, snare: { pitch: 3, gain: 1, decay: 120 },
      hihatClosed: { pitch: -1, decay: 95 }, hihatOpen: { pitch: -2, decay: 105 },
      clap: { pitch: 1, gain: -2, decay: 90 }, tom: { pitch: 2, decay: 110 }, crash: { decay: 150 },
    }),
  },
  {
    id: 'lofi', label: '로파이 킷',
    params: kit({
      kick: { pitch: -2, gain: -1, decay: 65 }, snare: { pitch: -3, gain: -1, decay: 70 },
      hihatClosed: { pitch: -5, gain: -3, decay: 55 }, hihatOpen: { pitch: -5, gain: -3, decay: 70 },
      clap: { pitch: -4, gain: -2, decay: 70 }, tom: { pitch: -3, gain: -2, decay: 80 }, crash: { pitch: -6, gain: -4, decay: 60 },
    }),
  },
  {
    id: 'hard', label: '하드 킷',
    params: kit({
      kick: { pitch: -3, gain: 3, decay: 120 }, snare: { pitch: 1, gain: 3, decay: 95 },
      hihatClosed: { pitch: 4, gain: 1, decay: 60 }, hihatOpen: { pitch: 3, gain: 1, decay: 90 },
      clap: { pitch: 2, gain: 3, decay: 85 }, tom: { pitch: -1, gain: 2, decay: 105 }, crash: { pitch: 2, gain: 1, decay: 170 },
    }),
  },
];

// Starter drum patterns for the library pane. Written as the 16th-note step
// indices that get hit, which is far easier to read and edit than 16 booleans;
// applyDrumPreset tiles them across whatever length the section is.
export const PATTERN_PRESETS = [
  { id: 'boombap', label: '힙합 기본', desc: '느긋한 붐뱁 그루브',
    steps: { kick: [0, 6, 10], snare: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: 'trap', label: '트랩', desc: '롤링 하이햇 + 무거운 킥',
    steps: { kick: [0, 7, 10], clap: [8], hihatClosed: [0, 2, 4, 6, 8, 10, 11, 12, 14, 15] } },
  { id: 'house', label: '하우스', desc: '포온더플로어 댄스 비트',
    steps: { kick: [0, 4, 8, 12], clap: [4, 12], hihatOpen: [2, 6, 10, 14] } },
  { id: 'rock8', label: '락 8비트', desc: '기본 8비트 드럼',
    steps: { kick: [0, 8], snare: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14], crash: [0] } },
  { id: 'ballad', label: '발라드', desc: '여백이 많은 잔잔한 비트',
    steps: { kick: [0, 8], snare: [12], hihatClosed: [0, 4, 8, 12] } },
  { id: 'funk', label: '펑크', desc: '당김음이 많은 그루브',
    steps: { kick: [0, 3, 6, 10, 11], snare: [4, 12], hihatClosed: [0, 2, 4, 6, 8, 10, 12, 14], tom: [14] } },
];
export const PRESET_STEP_LENGTH = 16;

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
export const ELEC_GUITAR_PITCHES = buildPitchRange(3, 2);
export const BRASS_PITCHES = buildPitchRange(3, 2);
export const SYNTH_LEAD_PITCHES = buildPitchRange(4, 2);
export const PAD_PITCHES = buildPitchRange(3, 2);
export const STRINGS_PITCHES = buildPitchRange(3, 2);
export const EPIANO_PITCHES = buildPitchRange(3, 2);
export const HARPSICHORD_PITCHES = buildPitchRange(3, 2);
export const ORGAN_PITCHES = buildPitchRange(3, 2);
export const VIOLIN_PITCHES = buildPitchRange(4, 2);
export const CELLO_PITCHES = buildPitchRange(2, 2);
export const HARP_PITCHES = buildPitchRange(3, 2);
export const FLUTE_PITCHES = buildPitchRange(4, 2);
export const CLARINET_PITCHES = buildPitchRange(3, 2);

// Every pitched (non-drum) instrument, as one source of truth: the beatmaker
// editor, the piano-roll config, the pattern helpers (empty/build/analyze) and
// the audio engine all iterate this rather than hard-coding bass/piano/guitar.
// `chordal` voices (pad/strings) auto-voice each note into an open fifth at
// playback so a single melody line sounds full without a chord data model.
export const MELODIC_TRACKS = [
  { key: 'bass', label: '베이스', pitches: BASS_PITCHES, color: '#5FBF8F', chordal: false },
  { key: 'piano', label: '그랜드 피아노', pitches: PIANO_PITCHES, color: '#B794F4', chordal: false },
  { key: 'ePiano', label: '일렉 피아노', pitches: EPIANO_PITCHES, color: '#4FD1C5', chordal: false },
  { key: 'harpsichord', label: '하프시코드', pitches: HARPSICHORD_PITCHES, color: '#7FD1C5', chordal: false },
  { key: 'organ', label: '오르간', pitches: ORGAN_PITCHES, color: '#6FC5B5', chordal: true },
  { key: 'guitar', label: '어쿠스틱 기타', pitches: GUITAR_PITCHES, color: '#E8C34D', chordal: false },
  { key: 'elecGuitar', label: '일렉 기타', pitches: ELEC_GUITAR_PITCHES, color: '#E86A4D', chordal: false },
  { key: 'strings', label: '스트링 앙상블', pitches: STRINGS_PITCHES, color: '#7FA8D1', chordal: true },
  { key: 'violin', label: '바이올린', pitches: VIOLIN_PITCHES, color: '#8FB8E1', chordal: false },
  { key: 'cello', label: '첼로', pitches: CELLO_PITCHES, color: '#6F98C1', chordal: false },
  { key: 'harp', label: '하프', pitches: HARP_PITCHES, color: '#9FC8E1', chordal: false },
  { key: 'brass', label: '브라스(관악)', pitches: BRASS_PITCHES, color: '#E8A33D', chordal: false },
  { key: 'flute', label: '플루트', pitches: FLUTE_PITCHES, color: '#E8C34D', chordal: false },
  { key: 'clarinet', label: '클라리넷', pitches: CLARINET_PITCHES, color: '#D8B33D', chordal: false },
  { key: 'synthLead', label: '신스 리드', pitches: SYNTH_LEAD_PITCHES, color: '#E893A6', chordal: false },
  { key: 'pad', label: '신스 패드', pitches: PAD_PITCHES, color: '#8B7FD1', chordal: true },
];
export const MELODIC_KEYS = MELODIC_TRACKS.map((t) => t.key);
export const MELODIC_BY_KEY = Object.fromEntries(MELODIC_TRACKS.map((t) => [t.key, t]));
export const CHORDAL_KEYS = MELODIC_TRACKS.filter((t) => t.chordal).map((t) => t.key);

// Factory balance between the individual voices — the starting relationship
// between kick and hihat, etc. The player rides DEFAULT_CHANNEL_MIX (the rack
// faders) and the DrumMachine's Gain knobs on top of this rather than editing
// it directly, so it behaves like a kit's built-in mix.
export const DEFAULT_MIXER = {
  kick: { vol: 0, mute: false }, snare: { vol: 0, mute: false },
  hihatClosed: { vol: -10, mute: false }, hihatOpen: { vol: -8, mute: false },
  clap: { vol: -4, mute: false }, tom: { vol: -2, mute: false }, crash: { vol: -6, mute: false },
  bass: { vol: -3, mute: false }, piano: { vol: -4, mute: false }, guitar: { vol: -6, mute: false },
  elecGuitar: { vol: -7, mute: false }, brass: { vol: -6, mute: false }, synthLead: { vol: -7, mute: false },
  pad: { vol: -10, mute: false }, strings: { vol: -8, mute: false },
  ePiano: { vol: -5, mute: false }, harpsichord: { vol: -6, mute: false }, organ: { vol: -7, mute: false },
  violin: { vol: -6, mute: false }, cello: { vol: -5, mute: false }, harp: { vol: -6, mute: false },
  flute: { vol: -7, mute: false }, clarinet: { vol: -7, mute: false },
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

// Fan comments come from the server now (backend/app/services/reactions.py) —
// written once at release from what each listener actually heard, instead of
// drawn from a handful of canned lines on every render.
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
