#!/usr/bin/env bash
# Usage: get-comments.sh <REPO> <PR> <SINCE>
# Outputs NDJSON of Codex remarks since SINCE timestamp
set -euo pipefail
REPO=$1
PR=$2
SINCE=$3

gh api --paginate "repos/$REPO/pulls/$PR/reviews" \
  --jq ".[] | select(.user.login == \"chatgpt-codex-connector[bot]\") | select(.submitted_at > \"$SINCE\") | {type:\"review\",state:.state,body:.body,file:null,line:null}"

gh api --paginate "repos/$REPO/pulls/$PR/comments" \
  --jq ".[] | select(.user.login == \"chatgpt-codex-connector[bot]\") | select(.created_at > \"$SINCE\") | {type:\"inline\",body:.body,file:.path,line:.line}"

gh api --paginate "repos/$REPO/issues/$PR/comments" \
  --jq ".[] | select(.user.login == \"chatgpt-codex-connector[bot]\") | select(.created_at > \"$SINCE\") | {type:\"general\",body:.body,file:null,line:null}"