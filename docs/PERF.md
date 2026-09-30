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
| Heap growth (retained-heap slope, `tools/soak.mjs`, 2.5 min) | 5 MB / 10 min | yes (soak step) | yes |
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

PR #10: the 30 s bench value read 5.84 MB/10 min while a 3-minute soak of the same scenario gave a
1.47 MB/10 min slope with the heap oscillating (9.45 -> 9.26 -> 9.47 MB). A single pair of samples
30 s apart cannot gate leaks, so heap growth moved to the soak step of the gate; the bench reports it as info.

PR #10 also showed that the emulated phone's effective throttle factor varies between runs (2.8x to
4.1x measured by the probe), and timer resolution is 0.1 ms. Regression checks in throttled scenarios
therefore compare time metrics divided by the measured throttle factor, with the noise floor scaled
by it. Absolute budgets are unchanged. (The flagged case: sim tick p95 0.2 -> 0.6 ms with no sim change.)

## UI layer (PR #11)
The HUD is DOM over the canvas. `telemetry.ui` times the whole UI update per frame (HUD, floating
numbers, shop, scoreboard, perf overlay) and `uiUpdateP95Ms` is gated at 1.5 ms. Two findings:
- Restarting a CSS animation by reading `offsetWidth` forced a synchronous reflow. Floating numbers
  spawned from the sim event stream, which the renderer drains, so the reflow landed inside
  `renderUpdate` (emulated phone p95 0.8 -> 2.8 ms). Spawns are now queued and animated with the Web
  Animations API in the UI update.
- `getBoundingClientRect()` (lane strip) and `clientWidth` (world-to-screen projection) per frame
  flushed layout after the HUD's style writes. Sizes now come from a ResizeObserver and the renderer's
  resize handler. UI update p95: desktop 0.9 -> 0.3 ms, emulated phone 3.3 -> 1.0 ms.
Per-frame HUD setters compare numbers first and build strings only when a shown value changes.

## GC pause max in the second container
From PR #10 on, the gate runs in a new container (4 vCPU Xeon, SwiftShader). There, `gcPauseMaxMs`
(a single worst MinorGC per run) does not reproduce the old baseline: the pre-VFX `main` measured
4.41 / 1.62 / 13.17 ms (desktop / play / phone), and one build of `play-ping100` gave 11.9, 4.3 and
3.4 ms on three runs. The budget is unchanged. Merges where only this metric fails are justified in
the PR write-up with same-container comparisons against `main`.

## Short sections under emulated throttling (PR #12)
UI and audio each take well under a millisecond per frame. Under `Emulation.setCPUThrottlingRate` the
throttler pauses the main thread in slices, so any short section that happens to span a pause reads
long. Calibration on the emulated phone (4x): an empty section p95 0.0 ms, a fixed ~0.1 ms loop
p50 < 0.1 ms but p95 0.8 ms, the whole UI update p95 0.8 ms. The p95 of such sections measures the
throttler, not the code, so `uiUpdateMeanMs` (budget 0.6) and `audioUpdateMeanMs` (budget 0.3) gate
instead and the p95 values are reported as info. The mean still catches real regressions: the
forced-layout bug from PR #11 read 0.84 ms mean on the phone.

## Audio allocation (PR #12)
Building a Web Audio graph per sound (oscillator, filter, gain, panner) made the emulated phone's GC
total over the 2-minute scenario rise from 294 to 449 ms with a 71 ms MajorGC. Voices now come from
fixed pools that run silently and are retriggered by AudioParam automation; the pad glides between
chords on persistent oscillators. GC total went back to 277 ms, audio update p95 1.0 -> 0.2 ms.
The benchmark and the soak unlock audio (autoplay flag + `unlock()`), since players hear the game.

## Heap accounting of inlined models (PR #12)
Decoding the inlined GLB data URLs with `atob` (instead of `fetch`, which a strict CSP blocks) moved
about 2.47 MB of base64 strings from Blink's external string storage onto the V8 heap. The heap
snapshot diff is +2.49 MB strings, -2.47 MB ExternalStringData: total memory is unchanged, but
`heapRetainedMb` reads about 12.1 instead of 9.8 MB. The soak slope (leaks) is unaffected.

## GC pause diagnostics on a software GPU (PR #12, PR #13)
Traces of `desktop-medium` (spectate: no UI, no audio) on the PR #11 and PR #12 builds, two runs each:
101-116 GCs per run, MinorGC p50 0.18-0.19 ms and p95 0.25-0.38 ms on both, at most one pause over 2 ms per
run, and every worst pause next to a ~32 ms `GPUTask` (SwiftShader rasterizing on the same cores) inside the
scavenger's parallel phase (`V8.GC_SCAVENGER_BACKGROUND_SCAVENGE_PARALLEL`). Gate runs recorded such single
outliers at 13-19 ms on builds with and without the code under review.
Two alternatives to gating the single worst pause were tried and rejected: a p99 gate (with about 100 GCs
per run the p99 index is the maximum) and excluding pauses that overlap a > 16 ms GPU task (in this container
that is about half of all GCs, which would hollow out the gate). `gcPauseMaxMs` therefore stays the gated
metric with its budget; the bench also reports `gcPausesOver5Ms`, `gcContendedMaxMs` and `gcContendedCount`
(pauses overlapping a long GPU task) as info, and PR write-ups justify failures with same-container A/B runs.

## Combat and ability effects (PR #15, PR #17)
The first version of the new attack and ability effects doubled GC work (desktop play 34 -> 68 ms, emulated
phone 227 -> 361 ms per run). Causes, from sampling heap profiles: a record object per auto-attack (minions
attack constantly), per swipe and per tracked projectile; `for..of` over a Map (entry arrays); and per-vertex
`BufferAttribute.setXYZ` calls in the swipe ribbons, which box each double argument when not inlined
(~40 KB/s). Records are now pooled, the Map is swept with a stored `forEach` callback, and ribbons write the
typed arrays directly: desktop play 39.9 ms, phone 236.5 ms. Draw calls with all effects: 36-41 (budget 50).

## Spectate scenario roster (PR #29)
From PR #24 to PR #29 the `desktop-medium` scenario (spectate, bots only) ran a 3-against-13 match: `startSpectate`
took every hero key as the roster, which had been six before PR #24 added ten heroes. Its draw calls (45), triangles
(78k) and GC numbers in that period measured 16 heroes. The scenario is six heroes again (drawn from the seed);
compare `desktop-medium` results only within one side of this change.
