# Performance: budgets, measurement and the merge gate

## Budgets (`src/perf/budgets.js`)
| Metric | Budget | Gated in software-GPU CI | Gated on real GPU |
|---|---|---|---|
| Sim tick p95 | 2 ms | yes | yes |
| Render update p95 (scene-graph JS, before GL submission) | 3 ms | yes | yes |
| Render submission p95 (WebGL calls) | 4 ms | report only | yes |
| Render CPU p95 (update + submission) | 6 ms | report only | yes |
| Frame time p95 / p99 | 16.7 / 20 ms | report only | yes |
| GC pause max (thread CPU time) | 5 ms | yes | yes |
| Heap growth (after forced GC) | 5 MB / 10 min | yes | yes |
| Scene draw calls | 50 | yes | yes |
| Load to first frame | 4 s | yes | yes |
| Input latency (input to displayed response) | 1 frame + 20 ms (desktop), + 30 ms (mobile) | once input lands | yes |

Post-processing adds a fixed set of fullscreen passes (bloom chain + composite, 8 on medium);
these are reported as `postPasses` and are not counted as scene draw calls.

## How the benchmark works (`tools/bench.mjs`)
1. Production build (`dist/index.html`) opened in headless Chromium with `?bench=1&skip=150`:
   a deterministic bot match, fast-forwarded 150 s so the lane is busy.
2. Scenarios: `desktop-medium` 1280x720, and `mobile-low` 844x390 with touch, DPR 2 and 4x CPU throttling.
3. 35 s warmup (JIT tier-up, shader compilation, and V8's one-time memory-reducer GC about 30 s after
   load), then telemetry is reset and a Chrome trace is recorded for the measurement window.
4. Heap is measured after `HeapProfiler.collectGarbage` at the start and end of the window.
5. GC pauses are taken from `MajorGC` / `MinorGC` trace events using thread CPU time (`tdur`).
   Memory-reducer compactions are reported separately (`memoryReducerMaxMs`).
6. Results go to `perf-results/<timestamp>.json`; `--gate` fails on any gated budget miss or a
   regression over 10% vs `perf-results/baseline.json` that also exceeds a noise floor of 10% of the budget.

## Why some metrics are report-only in CI
This container renders WebGL with SwiftShader (software) on one shared CPU core. Rasterization
competes with the page's main thread, so frame time, FPS and GL submission time are not
representative of a GPU, and wall-clock GC pauses get stretched by preemption (measured: 2.1 ms
CPU vs 6.0 ms wall for the same GC). On a machine with a hardware GPU the harness gates the full set.
Players can see live numbers with the F3 overlay and copy a report.

## Findings so far
- Entity records gained properties after creation, putting V8 objects into dictionary mode, so every
  position write allocated a boxed double. Declaring all fields up front plus closure-free spatial
  queries cut sim+bot allocation from 541 to 116 KB per simulated second.
- The renderer parsed colour strings every frame; pre-parsed colours dropped render update p95 from
  about 1.4 ms to 0.6 ms and removed the GC pressure behind a 5.9 ms pause.
- Steady-state GC over 150 s of gameplay: only minor GCs, 0.1 to 0.4 ms CPU each.

## CPU measurement mode
The software rasterizer makes the page GPU-bound (profile: main thread 98% idle), which left only
about 10 frames per window at full resolution, so p95 values were noise. The benchmark therefore
renders the identical scene (same draw calls, same JS and WebGL work) into a 160x90 buffer
(`?cpu=1`) and requires at least 200 sampled frames; fewer frames make the run invalid, not a pass.
CPU throttling for the mobile scenario is applied after navigation and verified with a warmed
busy-loop probe (a first run without JIT warmup had faked a 1.3x factor).

## Open item: WebGL submission cost on phones
On the emulated phone (4-5x CPU throttle) WebGL submission p95 is about 12 ms (report-only here).
About three quarters of per-frame allocation is inside three.js uniform uploads, driven by 43
materials / 20 programs (every character and prop has its own texture). Planned: a shared texture
atlas for characters and props so rigs and props can share materials, fewer program switches.
The third (rim) light was removed already.

## Leak check (soak)
`node tools/soak.mjs [minutes]` plays through the transport (100 ms ping, jitter, loss) and samples
retained heap after a forced GC every 30 s, then fits a slope. PR #9: 8.47 -> 9.03 MB over 4 minutes,
slope 1.24 MB per 10 min and flattening (match progression: levels, items, bigger waves). The 30 s
bench window is too short to judge leaks, so its heap regression noise floor is 50% of the budget.
