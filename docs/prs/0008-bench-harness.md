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

Second investigation (the gate caught it): p95 values came from ~10 frames because the software GPU
starved the main thread, and mobile CPU throttling had silently not been applied. Fixed with a CPU
measurement mode (`?cpu=1`, identical scene into a 160x90 buffer, >= 200 frames required) and a
verified throttle probe. Opaque draws are now sorted by material; the rim light was removed.
Final gate: desktop render update p95 0.4 ms, GC max 0.63 ms; emulated phone render update 2.6 ms,
GC max 3.5 ms. Open item recorded in docs/PERF.md (WebGL submission cost on phones).
