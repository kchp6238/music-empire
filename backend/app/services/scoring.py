"""Python port of frontend/src/lib/scoring/computeRelease.js.

This is the ONLY place a song's score is computed for real — see
docs/server-architecture.md §3. The client's computeRelease.js result is a
preview only; whatever this function returns is what gets persisted.
Keep this numerically identical to the JS version (same weights, same
formulas) — see docs/implementation-order.md §1-5 for the parity check.
"""

import random

from app.services.game_data import CHORD_PRESETS_BY_ID
from app.services.patterns import analyze_combined_pattern, lyrics_word_count, clamp
from app.services.js_math import js_round


def rand(lo: float, hi: float) -> float:
    return random.uniform(lo, hi)


def compute_release(character, song_input: dict, combined_pattern: dict, fan_personas: list[dict], persona_loyalty: dict, trend_multiplier: float = 1.0) -> dict:
    stats = character.stats
    talent = character.talent
    chord = CHORD_PRESETS_BY_ID[song_input["chord_preset_id"]]
    is_expert = song_input["production_mode"] == "expert"
    genres = song_input.get("genre_tags") or []
    moods = song_input.get("mood_tags") or []
    bpm = song_input["bpm"]

    pattern_info = analyze_combined_pattern(combined_pattern)
    lyrics_words = lyrics_word_count(song_input.get("lyrics"), song_input.get("structure") or [])
    lyrics_bonus = clamp(lyrics_words / 10, 0, 8)

    vocal_source = song_input["vocal_source"]
    if vocal_source == "self":
        vocal_quality = clamp(stats["vocal"] + rand(-8, 8), 0, 100)
    elif vocal_source == "ai":
        vocal_quality = 62
    else:
        vocal_quality = clamp(rand(45, 90), 0, 100)

    tempo_synergy = 0
    if bpm >= 140 and ("신남" in moods or "강렬" in moods):
        tempo_synergy = 4
    if bpm <= 80 and ("감성적" in moods or "우울" in moods or "편안함" in moods):
        tempo_synergy = 4

    craft_base = stats["composing"] * 0.3 + stats["arrangement"] * 0.25 + stats["production"] * 0.25 + stats["mixing"] * 0.2
    expert_skill_avg = (stats["production"] + stats["mixing"]) / 2
    mode_multiplier = (1.15 if expert_skill_avg >= 55 else 0.8) if is_expert else 1.0
    density_bonus = clamp((pattern_info["density"] - 40) * 0.12, -6, 10)
    craft = clamp(
        craft_base * mode_multiplier * 0.75 + vocal_quality * 0.15 + density_bonus + lyrics_bonus + tempo_synergy + rand(-5, 5),
        0, 100,
    )

    originality = clamp(
        talent["creativity"] * 0.4 + talent["genius"] * 0.35 + talent["ear"] * 0.15 + chord["originality_mod"] * 1.2 +
        clamp(pattern_info["variety"] * 0.06, 0, 6) + rand(-5, 5),
        0, 100,
    )

    genius_chance = 0.28 if (talent["genius"] >= 75 and originality >= 65) else (0.12 if (talent["genius"] >= 60 and originality >= 55) else 0.02)
    genius_event = random.random() < genius_chance
    if genius_event:
        originality = clamp(originality + 16, 0, 100)
    if not is_expert:
        originality = min(originality, 62)

    accessibility = clamp(chord["accessibility"] * 0.6 + (100 - originality) * 0.4, 0, 100)
    experimental = clamp(100 - accessibility, 0, 100)

    luck_factor = 1 + (talent["luck"] - 50) / 250 + rand(-0.15, 0.15)
    exposure_base = float(character.fame) * 0.55 + stats["marketing"] * 0.35 + (12 if vocal_source == "npc" else 0)
    # trend_multiplier (>1 when the song's tags match this week's trend) boosts
    # reach only — see services/trends.py. Defaults to 1.0 (no trend), which
    # keeps the JS/Python scoring parity fixture unchanged.
    exposure = clamp(float(exposure_base) * luck_factor * trend_multiplier, 3, 100)

    persona_results = []
    for p in fan_personas:
        g_vals = [p["genre_pref"].get(g, 0) for g in genres]
        m_vals = [p["mood_pref"].get(m, 0) for m in moods]
        avg_g = sum(g_vals) / len(g_vals) if g_vals else 0
        avg_m = sum(m_vals) / len(m_vals) if m_vals else 0
        affinity = avg_g * 0.6 + avg_m * 0.4
        loyalty = persona_loyalty.get(p["id"], 0)
        if affinity < 0:
            affinity = affinity * (1 - min(0.6, p["openness"] * 0.5))
        elif originality > 70:
            affinity = clamp(affinity + p["openness"] * 0.15, -1, 1)
        affinity = clamp(affinity + min(0.25, loyalty * 0.05), -1, 1)

        reach_prob = clamp(exposure / 100 + (0.25 if loyalty > 0 else 0), 0.05, 0.97)
        reached = random.random() < reach_prob
        reaction_score = clamp(50 + affinity * 45 + (craft - 50) * 0.25 + rand(-8, 8), 0, 100)

        persona_results.append({"persona": p, "affinity": affinity, "reached": reached, "reaction_score": reaction_score})

    reached_list = [r for r in persona_results if r["reached"]]
    reached_count = len(reached_list)
    reach_ratio = (reached_count / len(fan_personas)) * 100 if fan_personas else 0

    completion_rate = (sum(r["reaction_score"] for r in reached_list) / reached_count / 100) if reached_count else 0
    repeat_play_rate = (sum(1 for r in reached_list if r["reaction_score"] >= 70) / reached_count) if reached_count else 0
    save_rate = (sum(1 for r in reached_list if r["reaction_score"] >= 75) / reached_count) if reached_count else 0
    share_rate = (sum(1 for r in reached_list if r["reaction_score"] >= 85) / reached_count) if reached_count else 0
    fan_affinity_match = (((sum(r["affinity"] for r in reached_list) / reached_count) + 1) / 2 * 100) if reached_count else 50

    overall_score = clamp(
        reach_ratio * 0.10 + completion_rate * 100 * 0.25 + repeat_play_rate * 100 * 0.15 +
        save_rate * 100 * 0.15 + share_rate * 100 * 0.10 + fan_affinity_match * 0.25,
        0, 100,
    )

    sleeper_hit = False
    if craft >= 65 and exposure < 32 and random.random() < 0.15:
        sleeper_hit = True
        overall_score = clamp(overall_score + 16, 0, 100)

    if overall_score >= 80:
        tier = "대박"
    elif overall_score >= 65:
        tier = "성공"
    elif overall_score >= 45:
        tier = "무난"
    elif overall_score >= 25:
        tier = "부진"
    else:
        tier = "참패"

    fans_delta = js_round((overall_score - 45) * 1.4 + reached_count * 0.8)
    money_delta = js_round(
        overall_score * 45000 + float(character.fame) * 8000 - (280000 if vocal_source == "npc" else 0) - (140000 if is_expert else 0)
    )
    fame_delta = js_round((overall_score - 50) * 0.35)

    new_loyalty = dict(persona_loyalty)
    for r in reached_list:
        pid = r["persona"]["id"]
        if r["reaction_score"] >= 68:
            new_loyalty[pid] = new_loyalty.get(pid, 0) + 1
        elif r["reaction_score"] < 30:
            new_loyalty[pid] = max(0, new_loyalty.get(pid, 0) - 1)

    return {
        "attributes": {"craft": craft, "originality": originality, "accessibility": accessibility, "experimental": experimental},
        "breakdown": {
            "reach_ratio": reach_ratio, "completion_rate": completion_rate, "repeat_play_rate": repeat_play_rate,
            "save_rate": save_rate, "share_rate": share_rate, "fan_affinity_match": fan_affinity_match,
        },
        "overall_score": overall_score, "tier": tier, "genius_event": genius_event, "sleeper_hit": sleeper_hit,
        "fans_delta": fans_delta, "money_delta": money_delta, "fame_delta": fame_delta,
        "persona_results": persona_results, "new_loyalty": new_loyalty,
    }
