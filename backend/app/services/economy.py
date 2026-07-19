"""Revenue-source breakdown for a release (GDD §13).

Deliberately *additive*: the authoritative `money_delta` still comes from
scoring.py (so the JS/Python parity check stays valid). This module only
splits that same gross into named sources for display and future ledgers —
its `net` equals scoring.py's money_delta by construction.
"""

from app.services.js_math import js_round

# Share of gross revenue by source. Weights are nudged by character state
# (fame drives performance, fans drive fanclub) then renormalized.
BASE_WEIGHTS = {
    "streaming": 0.45,   # 스트리밍
    "performance": 0.20,  # 공연
    "ad": 0.12,           # 광고
    "fanclub": 0.10,      # 팬클럽
    "album": 0.09,        # 앨범 판매
    "license": 0.04,      # 라이선스
}


def compute_revenue_breakdown(overall_score, fame, fans_count, vocal_source, is_expert, money_delta):
    fame = float(fame)
    gross = overall_score * 45000 + fame * 8000
    expenses = (280000 if vocal_source == "npc" else 0) + (140000 if is_expert else 0)

    weights = dict(BASE_WEIGHTS)
    # more famous artists earn relatively more from live performance,
    # bigger fandoms earn relatively more from the fanclub
    weights["performance"] *= 1 + min(1.0, fame / 100)
    weights["fanclub"] *= 1 + min(1.5, fans_count / 2000)
    total_w = sum(weights.values())

    sources = {k: js_round(gross * (w / total_w)) for k, w in weights.items()}

    # Force the reported net to equal scoring.py's money_delta exactly; assign
    # any rounding remainder to streaming so the parts always sum to the whole.
    reported_net = sum(sources.values()) - expenses
    drift = money_delta - reported_net
    sources["streaming"] += drift

    return {
        **sources,
        "expenses": expenses,
        "net": money_delta,
    }
