#!/usr/bin/env bash
# Local PR workflow.
#   scripts/pr.sh open  <number> <branch-name> "<title>"   -> creates branch + PR description stub
#   scripts/pr.sh merge <number>                            -> runs the gate, merges --no-ff, deletes branch
set -euo pipefail
cd "$(dirname "$0")/.."
cmd=$1; num=$(printf "%04d" "$2")
case "$cmd" in
  open)
    git checkout -q main && git checkout -q -b "$3"
    f="docs/prs/$num-$3.md"
    [ -f "$f" ] || printf "# PR #%d: %s\n\nBranch: \`%s\`\n\n## Summary\n\n## Checks\n\n" "$2" "$4" "$3" > "$f"
    echo "opened PR #$2 on branch $3 ($f)";;
  merge)
    f=$(ls docs/prs/$num-*.md); branch=$(basename "$f" .md | cut -d- -f2-)
    title=$(head -1 "$f" | sed 's/^# //')
    git checkout -q "$branch"
    commit=$(git rev-parse HEAD); missing=""
    for s in $(bash scripts/check.sh list); do [ -f ".gate/$commit/$s.ok" ] || missing="$missing $s"; done
    if [ -n "$missing" ]; then echo "GATE INCOMPLETE for $commit, run: scripts/check.sh <step> for:$missing"; exit 1; fi
    { echo; echo "## Gate results ($commit)"; echo '```'; for s in $(bash scripts/check.sh list); do echo "--- $s"; grep -E "PASS|FAIL|passed|slope|SOAK|GATE|E2E|Tests|KB|info " ".gate/$commit/$s.log" | tail -30; done; echo '```'; } >> "$f"
    git add "$f" && git commit -q -m "docs(pr-$2): record gate results"
    git checkout -q main && git merge -q --no-ff "$branch" -m "Merge $title" && git branch -q -d "$branch"
    echo "merged $title";;
esac
