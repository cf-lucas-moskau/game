# PR #8: Benchmark harness and perf gate

Branch: `bench-harness`

## Summary

## Checks

Adds `tools/bench.mjs` (see `docs/PERF.md`) and wires it into `scripts/check.sh`, so every
later PR is gated on measured performance.

The first run failed the gate (GC pause 5.9 ms, heap growth 6.2 MB/10 min). Fixes in this PR:
- Entity records declare every field up front (V8 dictionary mode caused a boxed-double
  allocation on each position write); `Math.hypot` replaced in hot paths.
- Closure-free `world.query` for minion, tower and projectile targeting and the fountain.
- Bot snapshots and command arrays reused; no per-think `filter`/`sort`.
- Renderer: pre-parsed team/projectile colours, no per-frame `Object.values`, spreads or string keys.

Sim+bot allocation 541 -> 116 KB per simulated second. Render update p95 about 1.4 -> 0.6 ms.

Measurement method made robust after investigation: GC pauses use thread CPU time (software
rasterizer preemption inflated wall time 3x), a 35 s warmup covers V8's one-time memory-reducer
compaction (verified over 150 s: afterwards only 0.1 to 0.4 ms minor GCs), and regressions need
to exceed both 10% and a noise floor of 10% of the budget.
