#!/usr/bin/env bash
# Outputs JSON {dirty: [...], new: [...]} of working tree state before corrections
set -euo pipefail

json_array() {
  local result=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    escaped=$(printf '%s' "$line" | sed 's/\\/\\\\/g; s/"/\\"/g')
    result="${result:+$result,}\"$escaped\""
  done
  echo "[$result]"
}

DIRTY=$(git status --porcelain | grep -v "^??" | awk '{print substr($0,4)}' || true)
NEW=$(git status --porcelain | grep "^??" | awk '{print substr($0,4)}' || true)

DIRTY_JSON=$(echo "$DIRTY" | json_array)
NEW_JSON=$(echo "$NEW" | json_array)

echo "{\"dirty\":$DIRTY_JSON,\"new\":$NEW_JSON}"