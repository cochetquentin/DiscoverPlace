#!/usr/bin/env bash
# Usage: anti-loop-check.sh <REPO> <PR>
# exit 0 + "T_TRIGGER=<iso>" on stdout → proceed
# exit 1 + reason on stdout → STOP
set -euo pipefail
REPO=$1
PR=$2

T_TRIGGER=$(gh api --paginate "repos/$REPO/issues/$PR/comments" \
  --jq '.[] | select(.body | ltrimstr("\n") | rtrimstr("\n") | ltrimstr("\r") | rtrimstr("\r") | ascii_downcase | . == "@codex review") | .created_at' | tail -1)

T_CODEX_R=$(gh api --paginate "repos/$REPO/pulls/$PR/reviews" \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | .submitted_at' | tail -1 || true)
T_CODEX_C=$(gh api --paginate "repos/$REPO/pulls/$PR/comments" \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | .created_at' | tail -1 || true)
T_CODEX_I=$(gh api --paginate "repos/$REPO/issues/$PR/comments" \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | .created_at' | tail -1 || true)

HEAD_SHA=$(gh pr view --json headRefOid -q .headRefOid)
T_COMMIT=$(gh api "repos/$REPO/commits/$HEAD_SHA" --jq '.commit.committer.date' 2>/dev/null \
  || git log -1 --format="%cI")

RESULT=$(uv run python -c "
from datetime import datetime, timezone

def e(s):
    s = s.strip() if s else ''
    return int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()) if s else 0

t_trigger = e('$T_TRIGGER')
t_codex = max(e('$T_CODEX_R'), e('$T_CODEX_C'), e('$T_CODEX_I'))
t_commit = e('$T_COMMIT')

if t_trigger > 0 and t_trigger > t_commit and t_codex < t_trigger:
    print('STOP')
else:
    print('T_TRIGGER=' + '$T_TRIGGER')
")

if [ "$RESULT" = "STOP" ]; then
  echo "Anti-boucle : @Codex review déjà posté après le dernier commit et Codex n'a pas encore répondu."
  exit 1
fi

echo "$RESULT"