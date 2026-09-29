# PR #13: Shared materials, fewer draw calls, fixed glow lights

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

- `render/atlas.js`: at load, identical model textures are merged by pixel hash, every distinct image
  gets a padded 256 px cell in one 2048 atlas, UVs are remapped once and all textured models share one
  material. Scene: 19 distinct maps -> 1 (plus the environment's own), GPU textures 32 -> 16, lit
  textured models run as 4 program variants (static, instanced, tinted, skinned). Art stays replaceable:
  the atlas is rebuilt from whatever the models carry.
- Pebble (Gus's golem): the rigid parts are one skinned mesh with a bone per part (6 draws -> 2),
  animated exactly as before (quantized glTF attributes are dequantized when merging).
- Held props are baked into each hero's skinned mesh, rigidly bound to the hand bone
  (world = boneWorld * L * p, as when parented): 2 draws -> 1 per hero.
- `render/glow-lights.js`: a fixed pool of point lights (low 0, medium 2, high 3) follows the glowing
  props nearest the camera. Before, each candle or lantern owned a light, so a roster with four Saffis
  or Brindles lit every pixel with four point lights and each roster produced its own shader variant.

## Measured

- Emulated phone: draw calls 43-51 -> 32-35 (budget 50), GL submit p95 about 4.7 -> 2.7-3.3 ms,
  GC total per 2-minute run 237-277 -> 195-227 ms. Mid-fight scene: 39 -> 31 draws.
- Screenshots of `main` and this branch compared: mid-fight with all six heroes, the spawn line-up, and a
  close-up of Gus on Pebble. No visible difference.
- Allocation profile after the change: three.js uniform uploads are still the largest source
  (`setValueV3f` 290 KB/s, `setValueM4` 116 KB/s, down from 332 and 165). The remaining cost is V8 boxing
  the doubles passed to `gl.uniform3f` for per-program light and camera vectors; reducing it further means
  fewer lit programs/materials or changes inside three.js.

## Gate

`mobile-low.gcPauseMaxMs` fails (46.81 ms, a pause overlapping a long SwiftShader task); the same scenario
measured 7.8-46.8 ms across the PR #11-#13 builds and fails on the pre-PR builds too (docs/PERF.md, GC pause
diagnostics). `desktop-medium.gcPauseMaxMs` 3.52 ms is within budget but flagged against the baseline
recorded in the previous container (0.63 ms). Everything else passes, including draw calls against baseline
(-21 to -27%).

## Gate results (gate key d4ae898dba983b0a)
```
--- tests
 Test Files  8 passed (8)
      Tests  44 passed (44)
--- build
   dist/index.html: 3419 KB
--- e2e
   PASS  right-click moves the hero  (x 210 -> 489)
   PASS  Q quick-casts at the cursor
   PASS  W with Vesper draws a stroke while held  (44 points)
   PASS  closed loop casts Loop on release
   PASS  D casts Dash
   PASS  input latency is being measured  (87.1 ms p95 (software GPU: frame-bound))
   PASS  no page errors (desktop)
   PASS  joystick drag moves the hero  (x 210 -> 401)
   PASS  tapping Q quick-casts
   PASS  cancel zone appears while aiming
   PASS  releasing on cancel does not cast
   PASS  ability buttons are at least 48 px  (57/57/57/57)
   PASS  no page errors (touch)
   PASS  hero select appears
   PASS  reroll is spent after one use
   PASS  Fight starts a match with the chosen hero  (Saffi Blinkwick -> Brindle)
   PASS  HUD shows the hero
   PASS  audio unlocks on the first click and plays music and effects  (running, 22 voices played, 0 dropped)
   PASS  shop buys an item at the fountain  (gold 1437 -> 338)
   PASS  Escape closes the shop
   PASS  Tab opens the scoreboard with six heroes
   PASS  surrender ends the match in defeat
   PASS  Play again returns to hero select
   PASS  a second match starts cleanly  (2 canvases)
   PASS  audio voices are released (no leak across matches)  ({"sfx":0,"music":1})
   PASS  no page errors (loop)
   E2E: all input and game-loop checks passed
--- bench-desktop
   desktop-medium: frames 2614, sim p95 0.1 ms, render update p95 0.2 ms, GC max 3.52 ms, draws 34
--- bench-play
   play-ping100: frames 2010, sim p95 0.1 ms, render update p95 0.2 ms, GC max 4.91 ms, draws 33
--- bench-mobile
   mobile-low: frames 3600, sim p95 0.7 ms, render update p95 1 ms, GC max 46.81 ms, draws 34
--- bench-eval
   PASS  audioUpdateMeanMs              0  / 0.3
   PASS  gcPauseMaxMs                3.52  / 5 (baseline 0.63, +459%)
   PASS  drawCallsMax                  34  / 50 (baseline 43, -21%)
   PASS  loadMs                       320  / 4000 (baseline 985, -68%)
   PASS  correctionsPer10s              0  / 1
   info  gcPausesOver5Ms                0
   info  gcContendedMaxMs            3.52
   info  gcContendedCount              50
   info  gcWallMaxMs                 4.03
   info  gcCount                       98
   info  frames sampled              2614  (min 200)
   PASS  simTickP95Ms                 0.1  / 2
   PASS  renderUpdateP95Ms            0.2  / 3
   PASS  uiUpdateMeanMs             0.133  / 0.6
   PASS  audioUpdateMeanMs          0.015  / 0.3
   PASS  gcPauseMaxMs                4.91  / 5
   PASS  drawCallsMax                  33  / 50
   PASS  loadMs                       315  / 4000
   PASS  correctionsPer10s           0.22  / 1
   info  gcPausesOver5Ms                0
   info  gcContendedMaxMs            4.91
   info  gcContendedCount              46
   info  gcWallMaxMs                 8.47
   info  gcCount                       94
   info  frames sampled              2010  (min 200)
   PASS  simTickP95Ms                 0.7  / 2 (baseline 0.2, +516% throttle-normalized)
   PASS  renderUpdateP95Ms              1  / 3 (baseline 2.6, -32% throttle-normalized)
   PASS  uiUpdateMeanMs             0.354  / 0.6
   PASS  audioUpdateMeanMs          0.036  / 0.3
   FAIL  gcPauseMaxMs               46.81  / 5 (baseline 3.46, +2279% throttle-normalized)
   PASS  drawCallsMax                  34  / 50 (baseline 45, -24%)
   PASS  loadMs                       324  / 4000 (baseline 803, -29% throttle-normalized)
   PASS  correctionsPer10s            0.5  / 1
   info  gcPausesOver5Ms                9
   info  gcContendedMaxMs           46.81
   info  gcContendedCount              71
   info  gcWallMaxMs                48.42
   info  gcCount                      126
   info  frames sampled              3600  (min 200)
   PERF GATE: 3 failure(s)
--- soak
   retained-heap slope: 1.79 MB per 10 min over 2.5 min (budget 5)
   SOAK: retained heap within budget
```
