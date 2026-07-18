import math


def js_round(x: float) -> int:
    """Match JS Math.round semantics (round-half-towards-+Infinity), not
    Python's round() (round-half-to-even) — Math.round(-45.5) is -45 in JS
    but round(-45.5) is -46 in Python. Every place scoring.py or
    characters_service.py mirrors a JS Math.round(...) call must use this,
    or delta amounts silently drift from the client preview on ties."""
    return math.floor(x + 0.5)
