#!/usr/bin/env bash
# Compares frontend computeRelease.js and backend scoring.py against the same
# fixture with randomness pinned deterministically. See
# docs/implementation-order.md §1-5.
set -euo pipefail
cd "$(dirname "$0")/.."

JS_OUT=$(node frontend/scripts/parityCheck.mjs)
PY_OUT=$(backend/.venv/Scripts/python.exe backend/scripts/parity_check.py)

echo "JS:  $JS_OUT"
echo "PY:  $PY_OUT"

python3 - "$JS_OUT" "$PY_OUT" <<'EOF'
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
js = json.loads(sys.argv[1])
py = json.loads(sys.argv[2])

failures = []
for key in ["craft", "originality", "accessibility", "experimental", "overallScore"]:
    if abs(js[key] - py[key]) > 1e-6:
        failures.append(f"{key}: js={js[key]} py={py[key]}")
for key in ["tier", "geniusEvent", "sleeperHit", "fansDelta", "moneyDelta", "fameDelta", "reached"]:
    if js[key] != py[key]:
        failures.append(f"{key}: js={js[key]} py={py[key]}")

if failures:
    print("PARITY CHECK FAILED:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("PARITY CHECK PASSED - JS and Python scoring agree on all fields.")
EOF
