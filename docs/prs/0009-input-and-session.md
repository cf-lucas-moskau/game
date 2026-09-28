# PR #9: Player input, game session, prediction

Branch: `input-and-session`

## Summary

## Checks

The game is now playable: `index.html` starts a match with the local player plus five bots
(`?hero=`, `?ping=`, `?jitter=`, `?loss=`, `?bots=easy|medium|hard`, `?spectate=1`).

- `app/session.js`: every local command goes through `LocalTransport`, exactly as it will to the
  Node server; issue/processed/presented timestamps feed the input-latency metric.
- `app/predictor.js` + `render/interp.js`: the local hero walks immediately while a move is in flight,
  then eases onto authority; snaps over 90 units after easing count as corrections. All views use one
  interpolation helper so hero, bar, ring and camera never disagree.
- `input/desktop.js`: right-click move/attack with hold-to-steer, QWER quick-cast, Shift preview,
  Vesper hold-to-draw (tap casts the default shape), D/F, S, A-click, 1-6 item actives, Tab/P/F3 hooks.
- `input/touch.js`: floating joystick, 88 px attack button with hold-to-repeat, 58 px ability arc,
  tap = auto-aim with target lead, drag = aim with range-scaled preview, drag onto the ✕ to cancel,
  drawn abilities traced on the ground (works while the other thumb steers), three-finger tap, haptics,
  live cooldown sweeps.
- `render/indicators.js`: range ring, line / cone / circle previews, drawn stroke (turns green when a
  loop is closed), hover ring, click markers.
- `tools/e2e.mjs` (now a gate step): real mouse, keyboard and CDP touch events; 13 checks.
  It caught a real bug: tapping a drawn ability (Vesper Q) cast nothing.
- Bench: `play-ping100` (desktop, 100 ms / 15 ms jitter / 1% loss) and the mobile scenario now play
  through the input path with an autopilot; corrections per 10 s are gated. Input latency is gated
  only on a real GPU (in the software-GPU container it is frame-bound, about 250 ms).

```
  mobile-low  (software GPU: CPU-side metrics gate)
   PASS  simTickP95Ms                 0.2  / 2 (baseline 0.2, +0%)
   PASS  renderUpdateP95Ms            1.7  / 3 (baseline 2.6, -35%)
   PASS  gcPauseMaxMs                2.69  / 5 (baseline 3.46, -22%)
   PASS  heapGrowthMbPer10Min        2.03  / 5 (baseline 1.78, +14%)
   PASS  drawCallsMax                  46  / 50 (baseline 45, +2%)
   PASS  loadMs                       781  / 4000 (baseline 803, -3%)
   PASS  correctionsPer10s           0.29  / 1
   info  renderCpuP95Ms              11.5  / 6
   info  renderSubmitP95Ms           10.8  / 4
   info  frameP95Ms                 588.7  / 16.7
   info  frameP99Ms                 728.6  / 20
   info  inputLatencyP95Ms          771.9  / 136.7
   info  gcWallMaxMs                 3.88
   info  gcCount                       18
   info  memoryReducerMaxMs             0
   info  throttleFactor               3.3
   info  fps                            3
   info  onePercentLowFps             1.2  / 55
   info  trianglesMax               72217
   info  postPasses                     0
   info  longTasks                      1
   info  frames sampled               207  (min 200)
   PERF GATE: all gated metrics within budget
ALL CHECKS PASSED
```
