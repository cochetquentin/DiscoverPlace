#!/usr/bin/env bash
set -euo pipefail
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PR=$(gh pr view --json number,state,title,headRefOid)
PR_NUMBER=$(echo "$PR" | jq -r .number)
STATE=$(echo "$PR" | jq -r .state)
TITLE=$(echo "$PR" | jq -r .title)
HEAD_SHA=$(echo "$PR" | jq -r .headRefOid)
HEAD_BRANCH=$(git branch --show-current)
echo "{\"repo\":\"$REPO\",\"pr\":$PR_NUMBER,\"state\":\"$STATE\",\"title\":\"$TITLE\",\"branch\":\"$HEAD_BRANCH\",\"sha\":\"$HEAD_SHA\"}"