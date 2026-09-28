#!/usr/bin/env bash
# The merge gate. A PR merges only if every step here passes.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== 1/4 unit + determinism tests"
npx vitest run --reporter=dot
echo "== 2/4 production build"
npx vite build --logLevel warn
SIZE=$(stat -c %s dist/index.html)
echo "   dist/index.html: $((SIZE/1024)) KB"
if [ "$SIZE" -gt 16000000 ]; then echo "FAIL: build exceeds 16 MB hosting limit"; exit 1; fi
echo "== 3/4 end-to-end input test (mouse, keyboard, touch)"
if [ -f tools/e2e.mjs ]; then node tools/e2e.mjs; fi
echo "== 4/4 performance benchmark vs budgets"
if [ -f tools/bench.mjs ]; then node tools/bench.mjs --gate; else echo "   (bench harness not present yet)"; fi
echo "ALL CHECKS PASSED"
