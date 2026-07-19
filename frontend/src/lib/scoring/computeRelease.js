import { clamp, rand } from '../utils';
import { CHORD_PRESETS, FAN_PERSONAS } from '../gameData/constants';
import { analyzeCombinedPattern, lyricsWordCount } from '../patterns';

/**
 * Client-side preview only — the server re-runs the equivalent logic in
 * backend/app/services/scoring.py and that result is the one persisted.
 * See docs/server-architecture.md §3.
 */
export function computeRelease(character, draft, combined, trendMultiplier = 1.0) {
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
  // trendMultiplier defaults to 1.0 — mirror of backend scoring.py (trends.py).
  const exposure = clamp(exposureBase * luckFactor * trendMultiplier, 3, 100);

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
    overallScore * 45000 + character.fame * 8000 - (draft.vocalSource === 'npc' ? 280000 : 0) - (isExpert ? 140000 : 0)
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
