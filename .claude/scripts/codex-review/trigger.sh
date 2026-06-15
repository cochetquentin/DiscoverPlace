#!/usr/bin/env bash
# Usage: trigger.sh <PR>
# Posts an @Codex review comment with focused review instructions.
set -euo pipefail
PR=$1

gh pr comment "$PR" --body "@Codex review

Focus only on:
- bugs that will cause incorrect behavior in production
- security vulnerabilities
- data integrity issues
- major performance regressions

Do NOT report style issues, naming suggestions, refactoring ideas,
or low-probability edge cases.

Only create a comment if the issue would justify blocking the PR."