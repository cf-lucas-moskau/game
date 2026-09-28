#!/usr/bin/env bash
# The merge gate, split into steps that each fit in a few minutes.
#   scripts/check.sh <step>   run one step; on success records .gate/<commit>/<step>.ok
#   scripts/check.sh list     list steps
#   scripts/check.sh all      run every step in sequence
# A step only counts for the exact commit it ran on, with a clean working tree.
set -euo pipefail
cd "$(dirname "$0")/.."
STEPS="tests build e2e bench-desktop bench-play bench-mobile bench-eval soak"
step=${1:-all}
if [ "$step" = list ]; then echo "$STEPS"; exit 0; fi
if [ "$step" = all ]; then for s in $STEPS; do bash "$0" "$s"; done; echo "ALL CHECKS PASSED"; exit 0; fi
if [ -n "$(git status --porcelain)" ]; then echo "working tree not clean: commit first"; exit 1; fi
commit=$(git rev-parse HEAD); dir=".gate/$commit"; mkdir -p "$dir"
log="$dir/$step.log"
run() {
  case "$step" in
    tests) npx vitest run --reporter=dot ;;
    build) npx vite build --logLevel warn && SIZE=$(stat -c %s dist/index.html) && echo "   dist/index.html: $((SIZE/1024)) KB" && [ "$SIZE" -le 16000000 ] && git rev-parse HEAD > dist/.commit ;;
    e2e|bench-*|soak) [ "$(cat dist/.commit 2>/dev/null)" = "$commit" ] || { echo "dist/ is not built from $commit: run the build step"; return 1; } ;;&
    e2e) node tools/e2e.mjs ;;
    bench-desktop) node tools/bench.mjs --scenario desktop-medium ;;
    bench-play) node tools/bench.mjs --scenario play-ping100 ;;
    bench-mobile) node tools/bench.mjs --scenario mobile-low ;;
    bench-eval) node tools/bench.mjs --evaluate --gate --commit "$commit" ;;
    soak) node tools/soak.mjs 2.5 "play=auto&ping=100&jitter=15&loss=0.01" --gate ;;
    *) echo "unknown step $step"; return 1 ;;
  esac
}
echo "== $step ($commit)"
if run 2>&1 | tee "$log"; then touch "$dir/$step.ok"; echo "== $step passed"; else echo "== $step FAILED (log: $log)"; exit 1; fi
