# PR #18: Leviathan Lab

Branch: `claude/goal-test-aotoyo` (GitHub), commit 42c273c

## Summary

Owner request: a way to check animations and characters up close without the regular game. index.html?lab=1 is an isolated stage (hero + training dummies, camera presets, forced/frozen clips, casts at full rank, frame-exact stepping, window.__lab, control panel); tools/lab.mjs renders shots, animation strips, ability/attack timelines and a hero contact sheet from the command line. Found with it: props were fitted before the idle pose applied (all leaned ~40 deg outward), Saffi's candle floated above her head, the mallet grip.

## Gate (covers PRs #14-#18, gate key 4d5362ad461713ff)

All steps pass except gcPauseMaxMs (play 7.76 ms, one pause over 5 ms; emulated phone 26.66 ms), the container-noise case documented in docs/PERF.md. Draw calls 36-39 (budget 50, -12 to -20% vs baseline) with all new effects; UI 0.16/0.44 ms mean, audio 0.02/0.04 ms mean.

```
--- tests
 Test Files  8 passed (8)
      Tests  44 passed (44)
--- build
   dist/index.html: 3469 KB
--- e2e
   PASS  right-click moves the hero  (x 210 -> 489)
   PASS  Q quick-casts at the cursor
   PASS  W with Vesper draws a stroke while held  (43 points)
   PASS  closed loop casts Loop on release
   PASS  D casts Dash
   PASS  input latency is being measured  (171.2 ms p95 (software GPU: frame-bound))
   PASS  no page errors (desktop)
   PASS  joystick drag moves the hero  (x 210 -> 401)
   PASS  tapping Q quick-casts
   PASS  cancel zone appears while aiming
   PASS  releasing on cancel does not cast
   PASS  ability buttons are at least 48 px  (57/57/57/57)
   PASS  no page errors (touch)
   PASS  hero select appears
   PASS  reroll is unlimited and always changes the hero  (3 heroes after 4 rerolls)
   PASS  Fight starts a match with the chosen hero  (Morrow -> Saffi Blinkwick)
   PASS  HUD shows the hero
   PASS  audio unlocks on the first click and plays music and effects  (running, 21 voices played, 0 dropped)
   PASS  shop buys an item at the fountain  (gold 1416 -> 319)
   PASS  shop cards show what an item does for your hero  (For you: +2 Q · +18 W · +28 E)
   PASS  Escape closes the shop
   PASS  Tab opens the scoreboard with six heroes
   PASS  clicking a scoreboard row shows that hero's details and items
   PASS  left-clicking a unit on the battlefield inspects it  (Morrow)
   PASS  surrender ends the match in defeat
   PASS  Play again returns to hero select
   PASS  a second match starts cleanly  (2 canvases)
   PASS  audio voices are released (no leak across matches)  ({"sfx":0,"music":1})
   PASS  no page errors (loop)
   PASS  lab: every hero plays every clip and casts every ability  (6 heroes)
   E2E: all input and game-loop checks passed
--- bench-desktop
   desktop-medium: frames 2686, sim p95 0.1 ms, render update p95 0.2 ms, GC max 0.56 ms, draws 38
--- bench-play
   play-ping100: frames 2047, sim p95 0.1 ms, render update p95 0.3 ms, GC max 7.76 ms, draws 39
--- bench-mobile
   mobile-low: frames 3600, sim p95 0.7 ms, render update p95 1.1 ms, GC max 26.66 ms, draws 36
--- bench-eval
   PASS  audioUpdateMeanMs              0  / 0.3
   PASS  gcPauseMaxMs                0.56  / 5 (baseline 0.63, -11%)
   PASS  drawCallsMax                  38  / 50 (baseline 43, -12%)
   PASS  loadMs                       357  / 4000 (baseline 985, -64%)
   PASS  correctionsPer10s              0  / 1
   info  gcPausesOver5Ms                0
   info  gcContendedMaxMs            0.56
   info  gcContendedCount              46
   info  gcWallMaxMs                 4.87
   info  gcCount                      102
   info  frames sampled              2686  (min 200)
   PASS  simTickP95Ms                 0.1  / 2
   PASS  renderUpdateP95Ms            0.3  / 3
   PASS  uiUpdateMeanMs              0.16  / 0.6
   PASS  audioUpdateMeanMs          0.017  / 0.3
   FAIL  gcPauseMaxMs                7.76  / 5
   PASS  drawCallsMax                  39  / 50
   PASS  loadMs                       431  / 4000
   PASS  correctionsPer10s           0.89  / 1
   info  gcPausesOver5Ms                1
   info  gcContendedMaxMs            7.76
   info  gcContendedCount              50
   info  gcWallMaxMs                 8.03
   info  gcCount                      100
   info  frames sampled              2047  (min 200)
   PASS  simTickP95Ms                 0.7  / 2 (baseline 0.2, +495% throttle-normalized)
   PASS  renderUpdateP95Ms            1.1  / 3 (baseline 2.6, -28% throttle-normalized)
   PASS  uiUpdateMeanMs              0.44  / 0.6
   PASS  audioUpdateMeanMs          0.037  / 0.3
   FAIL  gcPauseMaxMs               26.66  / 5 (baseline 3.46, +1210% throttle-normalized)
   PASS  drawCallsMax                  36  / 50 (baseline 45, -20%)
   PASS  loadMs                       336  / 4000 (baseline 803, -29% throttle-normalized)
   PASS  correctionsPer10s           0.42  / 1
   info  gcPausesOver5Ms               12
   info  gcContendedMaxMs           26.66
   info  gcContendedCount              65
   info  gcWallMaxMs                30.25
   info  gcCount                      130
   info  frames sampled              3600  (min 200)
   PERF GATE: 3 failure(s)
--- soak
   retained-heap slope: 2.10 MB per 10 min over 2.5 min (budget 5)
   SOAK: retained heap within budget
```
