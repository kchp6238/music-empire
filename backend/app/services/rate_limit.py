"""Minimal in-process rate limiter for the auth endpoints.

Deliberately simple: a dict of timestamps per key, no Redis. That means the
window is per-process, so it resets on redeploy and doesn't coordinate across
replicas — fine for a small invite-only instance, and it still stops the
trivial case of someone hammering login to guess a password. Swap for a
shared store if this ever runs multi-replica.
"""

import time
from collections import defaultdict

_hits: dict[str, list[float]] = defaultdict(list)


def check(key: str, limit: int, window_sec: int) -> bool:
    """Record an attempt. Returns False when the caller is over the limit."""
    now = time.time()
    recent = [t for t in _hits[key] if now - t < window_sec]
    recent.append(now)
    _hits[key] = recent

    # opportunistic cleanup so the dict can't grow without bound
    if len(_hits) > 5000:
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > window_sec]:
            _hits.pop(k, None)

    return len(recent) <= limit
