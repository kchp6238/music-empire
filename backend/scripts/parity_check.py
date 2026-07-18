"""Runs scoring.compute_release against the shared fixture with random.random
and random.uniform pinned to deterministic values (midpoint / 0.5), prints
the result as JSON. See docs/implementation-order.md §1-5 — compared against
frontend/scripts/parityCheck.mjs's output by scripts/run-parity-check.sh.
"""

import json
import random
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

random.random = lambda: 0.5
random.uniform = lambda lo, hi: (lo + hi) / 2

from app.services import scoring  # noqa: E402
from app.services.game_data import FAN_PERSONAS_SEED  # noqa: E402

fixture = json.loads((Path(__file__).resolve().parents[2] / "scripts" / "parity-fixture.json").read_text(encoding="utf-8"))

character = SimpleNamespace(
    stats=fixture["character"]["stats"],
    talent=fixture["character"]["talent"],
    fame=fixture["character"]["fame"],
)

fan_personas = [
    {"id": i + 1, "genre_pref": p["genre_pref"], "mood_pref": p["mood_pref"], "openness": p["openness"]}
    for i, p in enumerate(FAN_PERSONAS_SEED)
]
persona_loyalty = {int(k): v for k, v in fixture["character"]["personaLoyalty"].items()}

song_input = {
    "bpm": fixture["draft"]["bpm"],
    "genre_tags": fixture["draft"]["genres"],
    "mood_tags": fixture["draft"]["moods"],
    "chord_preset_id": fixture["draft"]["chordPresetId"],
    "production_mode": fixture["draft"]["productionMode"],
    "vocal_source": fixture["draft"]["vocalSource"],
    "structure": fixture["draft"]["arrangement"],
    "lyrics": fixture["draft"]["lyricsBySection"],
}

result = scoring.compute_release(character, song_input, fixture["combined"], fan_personas, persona_loyalty)

print(json.dumps({
    "craft": result["attributes"]["craft"],
    "originality": result["attributes"]["originality"],
    "accessibility": result["attributes"]["accessibility"],
    "experimental": result["attributes"]["experimental"],
    "overallScore": result["overall_score"],
    "tier": result["tier"],
    "geniusEvent": result["genius_event"],
    "sleeperHit": result["sleeper_hit"],
    "fansDelta": result["fans_delta"],
    "moneyDelta": result["money_delta"],
    "fameDelta": result["fame_delta"],
    "reached": [r["reached"] for r in result["persona_results"]],
}))
