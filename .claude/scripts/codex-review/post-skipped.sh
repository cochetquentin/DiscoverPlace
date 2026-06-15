#!/usr/bin/env bash
# Usage: post-skipped.sh <PR> '<JSON array of {remark, reason}>'
# Posts a GitHub comment listing intentionally skipped corrections.
# Does nothing if the array is empty.
set -euo pipefail
PR=$1
DATA=$2

ROWS=$(echo "$DATA" | jq -r '.[] | "| \(.remark) | \(.reason) |"')
if [ -z "$ROWS" ]; then
  exit 0
fi

BODY="## Corrections Codex ignorées

| Remarque | Raison |
|----------|--------|
$ROWS"

gh pr comment "$PR" --body "$BODY"