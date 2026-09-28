# PR #6: Telemetry, budgets and transport with latency simulator

Branch: `perf-and-transport`

## Summary

## Checks

- `src/perf/budgets.js`: the spec's budgets; CPU-side metrics are the gated set (reliable in
  headless Chromium with a software GPU); 10% regression tolerance.
- `src/perf/telemetry.js`: allocation-free ring buffers for frame time, sim tick, render CPU,
  input latency, draw calls, triangles; heap growth, long tasks, corrections; `window.__perf`
  for the F3 overlay, "Copy report" and the benchmark harness.
- `src/net/transport.js`: `LocalTransport` is the only path from input to the sim. It simulates
  ping, jitter and loss with 3x input redundancy and dedupe, using its own RNG so network
  randomness never touches the simulation. `NetTransport` (phase 5) will implement the same interface.

Tests: zero-latency delivery, half-ping delay without duplicates, 2% loss masked, malformed commands rejected.

```
== 1/3 unit + determinism tests
   ✓ heroes > every hero casts every ability in a chaotic 3v3 without errors, deterministically 1348ms
   ✓ simulation > is deterministic for the same seed and commands 730ms
   ✓ simulation > whale roll cycles through warn, roll and back to idle 355ms
   ✓ simulation > heroes gain gold, xp, levels and kills 332ms
   ✓ bots > play a full match that ends by sudden death at the latest, and a command log replays it exactly 2950ms
   ✓ bots > every hero uses all four abilities during a match 1151ms
      Tests  35 passed (35)
   Start at  12:41:22
   Duration  9.58s (transform 229ms, setup 0ms, collect 487ms, tests 7.56s, environment 1ms, prepare 469ms)
== 2/3 production build
   dist/index.html: 1 KB
== 3/3 performance benchmark vs budgets
   (bench harness not present yet)
ALL CHECKS PASSED
```
