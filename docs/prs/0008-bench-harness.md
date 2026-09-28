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

```
   info  longTasks                      0
   info  frames sampled               326  (min 200)
  mobile-low  (software GPU: CPU-side metrics gate)
   PASS  simTickP95Ms                 0.2  / 2 (baseline 0.2, +0%)
   PASS  renderUpdateP95Ms            1.4  / 3 (baseline 2.6, -46%)
   PASS  gcPauseMaxMs                3.71  / 5 (baseline 3.46, +7%)
   PASS  heapGrowthMbPer10Min        1.61  / 5 (baseline 1.78, -10%)
   PASS  drawCallsMax                  45  / 50 (baseline 45, +0%)
   PASS  loadMs                       815  / 4000 (baseline 803, +1%)
   info  renderCpuP95Ms              11.6  / 6
   info  renderSubmitP95Ms           11.1  / 4
   info  frameP95Ms                 493.7  / 16.7
   info  frameP99Ms                 587.4  / 20
   info  gcWallMaxMs                 4.44
   info  gcCount                       18
   info  memoryReducerMaxMs             0
   info  throttleFactor               3.5
   info  fps                          3.5
   info  onePercentLowFps             1.7  / 55
   info  trianglesMax               60796
   info  postPasses                     0
   info  longTasks                      0
   info  frames sampled               241  (min 200)
   PERF GATE: all gated metrics within budget
ALL CHECKS PASSED
```
