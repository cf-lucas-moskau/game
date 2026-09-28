#!/usr/bin/env bash
# The merge gate. A PR merges only if every step here passes.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== 1/5 unit + determinism tests"
npx vitest run --reporter=dot
echo "== 2/5 production build"
npx vite build --logLevel warn
SIZE=$(stat -c %s dist/index.html)
echo "   dist/index.html: $((SIZE/1024)) KB"
if [ "$SIZE" -gt 16000000 ]; then echo "FAIL: build exceeds 16 MB hosting limit"; exit 1; fi
echo "== 3/5 end-to-end input test (mouse, keyboard, touch)"
if [ -f tools/e2e.mjs ]; then node tools/e2e.mjs; fi
echo "== 4/5 performance benchmark vs budgets"
if [ -f tools/bench.mjs ]; then node tools/bench.mjs --gate; else echo "   (bench harness not present yet)"; fi
echo "== 5/5 leak check (retained-heap slope over 2.5 min of play)"
if [ -f tools/soak.mjs ]; then node tools/soak.mjs 2.5 "play=auto&ping=100&jitter=15&loss=0.01" --gate; fi
echo "ALL CHECKS PASSED"
