#!/usr/bin/env bash
# Usage: post-skipped.sh <PR> '<JSON array of {remark, reason}>'
# Posts a GitHub comment listing intentionally skipped corrections.
# Does nothing if the array is empty.
set -euo pipefail
PR=$1
DATA=$2

ROWS=$(uv run python -c "
import json, sys
items = json.loads('''$DATA''')
if not items:
    sys.exit(0)
for item in items:
    print('| ' + item['remark'] + ' | ' + item['reason'] + ' |')
")

if [ -z "$ROWS" ]; then
  exit 0
fi

BODY="## Corrections Codex ignorées

| Remarque | Raison |
|----------|--------|
$ROWS"

gh pr comment "$PR" --body "$BODY"