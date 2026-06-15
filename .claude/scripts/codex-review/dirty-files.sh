#!/usr/bin/env bash
# Outputs JSON {dirty: [...], new: [...]} of working tree state
set -euo pipefail
DIRTY=$(git status --porcelain | grep -v "^??" | awk '{print substr($0,4)}' || true)
NEW=$(git status --porcelain | grep "^??" | awk '{print substr($0,4)}' || true)
uv run python -c "
import json, sys
dirty = [l for l in '''$DIRTY'''.splitlines() if l.strip()]
new   = [l for l in '''$NEW'''.splitlines() if l.strip()]
print(json.dumps({'dirty': dirty, 'new': new}))
"