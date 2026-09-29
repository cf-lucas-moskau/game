# PR #27: Hero select screen

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Owner request: "create a hero selection screen at the beginning, not only a roll mechanism". The menu is now a real
hero select:

- **Roster.** All 16 heroes as painted-portrait tiles (PR #25) with short names, accent-coloured selection, and role
  filters (All, Mages, Frontline, Marksmen, Supports, Assassins, derived from each hero's role). A Random tile and a
  Random button keep the unlimited reroll (always a different hero).
- **Detail card.** Portrait in the chosen skin, name, title, role, difficulty and resource; the passive (the six
  original heroes got written passives) and all four abilities; skin swatches with each skin's own portrait, name and
  blurb (PR #22); bot difficulty; Fight.
- **Memory.** The last chosen hero and skin are remembered (settings); a random pick is not.
- **Layout.** Desktop grid next to the card; Controls collapse into a disclosure next to Settings. Landscape phones
  keep the grid and the card side by side, and portrait phones stack them. Role filters scroll sideways when narrow.

## Checks

- e2e: clicking a roster tile selects that hero; the chosen hero and skin reach the match (`session.roster[0].skin`);
  unlimited reroll still passes; the menu shows painted portraits.
- Visual: screenshots at 1280x720, 844x390 and 390x844.
- e2e battlefield inspect: the test used to click the first allied bot. It failed intermittently in the gate
  ("(Saffi Blinkwick)" was the stale scoreboard panel, so nothing was picked). The debug runs showed every passing
  click landing on the canvas near the centre. The failures came from the ally having walked off-screen or under the HUD
  by the time the test reached this step (once every bot was down the lane). The test now clicks the first unit whose body is
  on the canvas: heroes first (allies before enemies), then Pebble, minions, towers and the Heartstone
  (`elementFromPoint` must be the canvas). It reports which unit was clicked and which one the panel shows.

## GC pause A/B for the PR #22-#27 merge

The gate's bench-eval fails only on `gcPauseMaxMs`: desktop-medium 4.06 ms passes the 5 ms budget but reads +544% against
the baseline, and mobile-low is 27.55 ms against a 5 ms budget. This is the container case in docs/PERF.md, so here is a
same-container, interleaved A/B: `main` (fd42f48) against this branch (key 42662a137982b84b), each built from its own worktree.

mobile-low (the budget failure), 3 runs each:

| | worst pause | pauses > 5 ms | GC total | GCs |
|---|---|---|---|---|
| main | 26.67 / 36.17 / 18.66 ms | 12 / 6 / 14 | 300 / 301 / 317 ms | 122-128 |
| branch | 20.24 / 12.09 / 17.27 ms | 10 / 6 / 9 | 275 / 235 / 264 ms | 116-136 |

desktop-medium, 8 runs on main and 10 on the branch (3 + 5 interleaved, plus the gate run and one traced run):
- main worst pauses: 5.68, 2.69, 1.58, 2.09, 6.29, 1.45, 6.29 and 1.34 ms. That is over 5 ms in 3 of 8 runs; GC total 22-41 ms.
- branch worst pauses: 9.41, 17.79, 26.51, 9.19, 1.41, 2.12, 6.61, 20.45, 1.47 and 4.06 ms. That is over 5 ms in 6 of 10
  runs; GC total 25-72 ms.

The branch has more desktop outliers, so the traces of the 10 interleaved runs were broken down (`V8.GC_SCAVENGER_*`
phases, and every thread active during the worst pause):
- **Per-scavenge work is unchanged.** Each MinorGC frees a median of 0.84-0.85 MB on both sides. Median MinorGC CPU is
  0.17-0.21 ms on both, and the main thread's own scavenge work has a median of 0.04-0.06 ms on both.
- **The outliers are waits.** The branch's worst pause was 20.4 ms, with 20.3 ms in `SCAVENGE_PARALLEL_PHASE` but only
  0.04 ms of the main thread's own `SCAVENGE_PARALLEL` work: it spin-waits for a background helper. The second worst was
  13.4 ms, with the helper itself taking 16 ms for a normal 0.84 MB. The third was 6.5 ms, of which 6.4 ms was
  `HEAP_EPILOGUE_SAFEPOINT`, i.e. waiting for other threads.
- Every worst pause overlaps a long SwiftShader `GPUTask` (43-65 ms). The GPU thread is busy about 88 of the 90 s on
  both sides. The branch's GPU tasks are about 12% longer (p95 39-41 ms against 34-37 ms), because the scene is heavier:
  75k against 60k triangles and 44 against 36 draw calls in the traced runs. The new rigs, props and pack effects add to
  it, and with 16 heroes the fixed seed no longer fields the same rosters. More software rasterization on the shared
  cores means more chances for a scavenger helper to be preempted. On a real GPU that work is not on the CPU cores.
- The heap is a constant +3.8 MB (17.2 against 13.4 MB after scavenges) from the inlined models of the ten new heroes
  (dist 3.56 -> 5.36 MB). It is old-generation data and does not change scavenge cost (see above).

Main-thread cost per frame rose slightly: rAF median 0.60-0.67 -> 0.74-0.82 ms, render CPU p95 0.9 -> 1.4 ms, render update
p95 0.2 -> 0.3 ms, all well inside budget. Follow-up: draw calls now peak at 44-45 of 50, so the next effects work should
batch pack props and domes.

Given the numbers above, the merge proceeds with bench-eval recorded as failing on this metric only. Its log is appended
below, and `.gate/<key>/bench-eval.ok` notes that it was justified here.

## Gate results for PRs 22-27 (gate key 42662a137982b84b, commit db775de)
```
--- tests
 Test Files  11 passed (11)
      Tests  63 passed (63)
--- build
   dist/index.html: 5361 KB
--- e2e
   PASS  tapping Q quick-casts
   PASS  cancel zone appears while aiming
   PASS  releasing on cancel does not cast
   PASS  ability buttons are at least 48 px  (57/57/57/57)
   PASS  no page errors (touch)
   PASS  phone HUD has no overlaps at 844x390  (7 parts)
   PASS  phone HUD has no overlaps at 390x844  (7 parts)
   PASS  hero select appears
   PASS  reroll is unlimited and always changes the hero  (5 heroes after 4 rerolls)
   PASS  clicking a roster tile selects that hero
   PASS  Fight starts a match with the chosen hero  (The Auctioneer -> Saffi Blinkwick)
   PASS  the chosen hero and skin reach the match
   PASS  HUD shows the hero
   PASS  audio unlocks on the first click and plays music and effects  (running, 21 voices played, 0 dropped)
   PASS  shop buys an item at the fountain  (gold 1400 -> 300)
   PASS  shop cards show what an item does for your hero  (For you: +2 Q · +18 W · +28 E)
   PASS  Escape closes the shop
   PASS  Tab opens the scoreboard with six heroes
   PASS  clicking a scoreboard row shows that hero's details and items
   PASS  left-clicking a unit on the battlefield inspects it  (clicked Lumen Vey, panel Lumen Vey)
   PASS  surrender ends the match in defeat
   PASS  Play again returns to hero select
   PASS  a second match starts cleanly  (2 canvases)
   PASS  audio voices are released (no leak across matches)  ({"sfx":0,"music":1})
   PASS  no page errors (loop)
   PASS  menu shows a painted portrait
   PASS  portraits paint for every hero and skins, all distinct  (17 portraits, 17 distinct)
   PASS  lab: every hero plays every clip and casts every ability  (16 heroes)
   PASS  lab: every skin loads and palette skins use their own atlas cell  (27 hero/skin looks)
   E2E: all input and game-loop checks passed
--- bench-desktop
   desktop-medium: frames 2257, sim p95 0.2 ms, render update p95 0.3 ms, GC max 4.06 ms, draws 44
--- bench-play
   play-ping100: frames 2058, sim p95 0.1 ms, render update p95 0.2 ms, GC max 1.79 ms, draws 37
--- bench-mobile
   mobile-low: frames 3521, sim p95 0.8 ms, render update p95 1.3 ms, GC max 27.55 ms, draws 34
--- bench-eval
   PASS  simTickP95Ms                 0.8  / 2 (baseline 0.2, +451% throttle-normalized)
   PASS  renderUpdateP95Ms            1.3  / 3 (baseline 2.6, -31% throttle-normalized)
   PASS  uiUpdateMeanMs             0.458  / 0.6
   PASS  audioUpdateMeanMs          0.052  / 0.3
   FAIL  gcPauseMaxMs               27.55  / 5 (baseline 3.46, +998% throttle-normalized)
   PASS  drawCallsMax                  34  / 50 (baseline 45, -24%)
   PASS  loadMs                       459  / 4000 (baseline 803, -21% throttle-normalized)
   PASS  correctionsPer10s           0.33  / 1
   info  renderCpuP95Ms               6.1  / 6
   info  renderSubmitP95Ms            5.2  / 4
   info  frameP95Ms                  82.4  / 16.7
   info  frameP99Ms                 111.8  / 20
   info  inputLatencyP95Ms          143.9  / 136.7
   info  gcPausesOver5Ms                9
   info  gcContendedMaxMs           27.55
   info  gcContendedCount              74
   info  uiUpdateP95Ms                1.4
   info  audioUpdateP95Ms             0.1
   info  heapGrowthMbPer10Min        2.12  / 5
   info  gcWallMaxMs                31.11
   info  gcCount                      116
   info  memoryReducerMaxMs             0
   info  throttleFactor               3.7
   info  fps                         29.3
   info  onePercentLowFps             7.5  / 55
   info  trianglesMax               52795
   info  postPasses                     0
   info  longTasks                     12
   info  frames sampled              3521  (min 200)
   PERF GATE: 3 failure(s)
--- soak
   retained-heap slope: 2.84 MB per 10 min over 2.5 min (budget 5)
   SOAK: retained heap within budget
```
