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

export const NPC_ARTISTS = [
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
