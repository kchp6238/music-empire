"""Python mirror of frontend/src/lib/patterns/index.js — operates on the
per-section pattern/lyrics JSON stored on Song rows plus the `structure`
(arrangement) list, to reconstruct the same combined-pattern analysis the
client already showed as a preview."""

DRUM_KEYS = ["kick", "snare", "hihatClosed", "hihatOpen", "clap", "tom", "crash"]
# Mirror of MELODIC_KEYS in frontend/src/lib/gameData/constants.js — the pitched
# lanes. The first three are the historical set; the rest were added with the
# expanded instrument roster. A song missing a lane is treated as all-rests.
MELODIC_KEYS = ["bass", "piano", "guitar", "elecGuitar", "brass", "synthLead", "pad", "strings"]


def build_combined_pattern(sections: dict, arrangement: list[str]) -> dict:
    combined = {"drums": {k: [] for k in DRUM_KEYS}}
    for k in MELODIC_KEYS:
        combined[k] = []
    for key in arrangement:
        sec = sections.get(key)
        if not sec:
            continue
        for k in DRUM_KEYS:
            combined["drums"][k] += sec["drums"].get(k, [])
        for k in MELODIC_KEYS:
            combined[k] += sec.get(k, [])
    if not combined["bass"]:
        combined["drums"] = {k: [False] for k in DRUM_KEYS}
        for k in MELODIC_KEYS:
            combined[k] = [None]
    return combined


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def analyze_combined_pattern(combined: dict) -> dict:
    total_steps = len(combined["bass"])
    drum_count = sum(sum(1 for v in arr if v) for arr in combined["drums"].values())
    melodic_active = sum(sum(1 for v in combined.get(k, []) if v) for k in MELODIC_KEYS)
    total_active = drum_count + melodic_active
    # Denominator stays at the original 3 melodic lanes (see the JS twin's note):
    # new instruments add credit without inflating capacity, so a classic
    # 3-lane song scores identically and parity with the client holds.
    capacity = max(total_steps * (len(DRUM_KEYS) + 3) * 0.3, 1)
    density = clamp((total_active / capacity) * 100, 0, 100)
    all_notes = [v for k in MELODIC_KEYS for v in combined.get(k, []) if v]
    unique_notes = len(set(all_notes))
    variety = clamp(unique_notes * 10, 0, 100)
    return {"density": density, "variety": variety, "total_active": total_active, "total_steps": total_steps}


def lyrics_word_count(lyrics: dict | None, arrangement: list[str]) -> int:
    if not lyrics:
        return 0
    total = 0
    for key in arrangement:
        text = (lyrics.get(key) or "").strip()
        if text:
            total += len(text.split())
    return total
