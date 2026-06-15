#!/usr/bin/env bash
# Outputs JSON {dirty: [...], new: [...]} of working tree state
set -euo pipefail
DIRTY=$(git status --porcelain | grep -v "^??" | awk '{print substr($0,4)}' | jq -R . | jq -s . || echo '[]')
NEW=$(git status --porcelain | grep "^??" | awk '{print substr($0,4)}' | jq -R . | jq -s . || echo '[]')
echo "{\"dirty\":$DIRTY,\"new\":$NEW}"