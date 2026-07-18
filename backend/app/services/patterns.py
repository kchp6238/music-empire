"""Python mirror of frontend/src/lib/patterns/index.js — operates on the
per-section pattern/lyrics JSON stored on Song rows plus the `structure`
(arrangement) list, to reconstruct the same combined-pattern analysis the
client already showed as a preview."""

DRUM_KEYS = ["kick", "snare", "hihatClosed", "hihatOpen", "clap", "tom", "crash"]


def build_combined_pattern(sections: dict, arrangement: list[str]) -> dict:
    combined = {"drums": {k: [] for k in DRUM_KEYS}, "bass": [], "piano": [], "guitar": []}
    for key in arrangement:
        sec = sections.get(key)
        if not sec:
            continue
        for k in DRUM_KEYS:
            combined["drums"][k] += sec["drums"].get(k, [])
        combined["bass"] += sec.get("bass", [])
        combined["piano"] += sec.get("piano", [])
        combined["guitar"] += sec.get("guitar", [])
    if not combined["bass"]:
        combined["drums"] = {k: [False] for k in DRUM_KEYS}
        combined["bass"] = [None]
        combined["piano"] = [None]
        combined["guitar"] = [None]
    return combined


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def analyze_combined_pattern(combined: dict) -> dict:
    total_steps = len(combined["bass"])
    drum_count = sum(sum(1 for v in arr if v) for arr in combined["drums"].values())
    bass_count = sum(1 for v in combined["bass"] if v)
    piano_count = sum(1 for v in combined["piano"] if v)
    guitar_count = sum(1 for v in combined["guitar"] if v)
    total_active = drum_count + bass_count + piano_count + guitar_count
    capacity = max(total_steps * (len(DRUM_KEYS) + 3) * 0.3, 1)
    density = clamp((total_active / capacity) * 100, 0, 100)
    unique_notes = len({v for v in combined["bass"] + combined["piano"] + combined["guitar"] if v})
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
