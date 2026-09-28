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
