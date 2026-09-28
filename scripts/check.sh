#!/usr/bin/env bash
# The merge gate. A PR merges only if every step here passes.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== 1/3 unit + determinism tests"
npx vitest run --reporter=dot
echo "== 2/3 production build"
npx vite build --logLevel warn
SIZE=$(stat -c %s dist/index.html)
echo "   dist/index.html: $((SIZE/1024)) KB"
if [ "$SIZE" -gt 16000000 ]; then echo "FAIL: build exceeds 16 MB hosting limit"; exit 1; fi
echo "== 3/3 performance benchmark vs budgets"
if [ -f tools/bench.mjs ]; then node tools/bench.mjs --gate; else echo "   (bench harness not present yet)"; fi
echo "ALL CHECKS PASSED"
