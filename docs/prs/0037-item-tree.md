# PR #37: Item build tree, cooldown reduction and more items

Branch: `claude/goal-test-aotoyo` (commits for PR #37)

## Summary

Owner request: "I want more items, item components, cooldown reduction etc."

- **Build tree (40 items).**
  - 10 components: +15 attack, +12% attack speed, 8% lifesteal, +25 ability power, mana and regeneration, 10%
    cooldown reduction, +150 health, +15 armor, +15 magic resist, boots.
  - 14 upgrades: the old stat items, now built from components, plus Riptide Bow, Anglerfin Blade, Brinecaller's
    Sash, Warden's Bark, and three new boots next to Quickcurrent and Magnet Boots.
  - 16 finished items: the 9 old ones with recipes, plus 7 new ones:
    - Leviathan's Maw: lifesteal, and basic attacks on heroes heal a share of missing health;
    - Reefbreaker: 30% armor penetration;
    - Squall Bell: attack speed and bonus magic damage on hit;
    - Storm Cutlass: the next basic attack after a cast is empowered;
    - Deepwater Codex: 30% magic penetration;
    - Tidewatch Hourglass: 20% cooldown reduction, and a speed boost after casting;
    - Coral Aegis: an active shield for you and nearby allies;
    - Stillwater Pendant: 30% tenacity.
  - `from` recipes; tiers follow from the tree; `group: 'boots'` allows one pair.
- **Purchases** (`match.js#purchasePlan`, `buy`): owned components anywhere down the tree are used up and knock their
  cost off the price. A full inventory can still combine. Unique items and one boots group are enforced. The shop
  and the bots use the same plan.
- **New stats.** Cooldown reduction on many items (still capped at 40%). Armor and magic penetration (ignore a share
  of resistances, capped at 45%). Tenacity (shortens stuns, roots, slows and knock-ups on heroes, capped at 50%).
  Mana and health regeneration. All are declared in `createEntity`.
- **Shop.** Category filter; Components, Upgrades and Finished sections; each card shows the price after your
  components (full price struck through), the recipe with owned parts lit, and what it does for your hero after the
  parts are used up. The tooltip names what the item builds into. The stat formatter covers the new stats, and there
  are icons for all 25 new items plus a support colour.
- **Bots** buy the next build item when its price is affordable, otherwise its most expensive affordable component.
  Every hero's recommended build uses the new items: marksmen on-hit and penetration, mages the codex and hourglass,
  tanks and supports the aegis and tenacity.

## Balance (simulation lab, 960 matches, seed 1)

- First version: Dredge 75.8% (from 66%). Focus A/Bs, 480 matches each:
  - his old build: 68.5%;
  - Harpoon Chain in place of Storm Cutlass: 69.0%;
  - weaker tenacity on Anchor Boots: no change;
  - a milder Cutlass passive: no change;
  - Cutlass without cooldown reduction: -2.7;
  - Cutlass without its 200 health: -9.4, z -3.19.
- Fix: health on an attack item was too good for juggernauts. Storm Cutlass is now 40 attack damage, 10% cooldown
  reduction, no health, 2600 gold; the passive numbers are data fields the lab can patch.
- After: win-rate spread sd 0.123 (before the item update 0.128), Dredge 68.1%, blue 52.8% (CI 49-56), match
  10.0 min, kills 35.6. The hero order is as before (Morrow and Lumen high, Saffi low: see the balance proposal).
- Item win rates rise with purchase time (heroes who are ahead buy late items), so use `--builds role` for item
  balance.

## Checks

91 tests (7 new or rewritten for items):
- recipes cost more than their parts, tiers follow the tree, every build item exists;
- recursive component use and price;
- a full inventory combines;
- the boots group;
- penetration, tenacity and cooldown reduction;
- the Storm Cutlass and Squall Bell effects.

The lab's gold books now count prices paid. Visual: the shop with two Shark Teeth and Driftwood Boots owned
(discounts, lit recipe parts, "for you" lines, category filter).

## GC pause check for the PR #35-#37 merge

bench-eval fails only on `gcPauseMaxMs` (play 7.21 ms, phone 22.36 ms). Interleaved play-ping100 runs, `main`
(f018ec6) against this branch (key 047a433c916d05fa), traces kept:
- worst pauses: main 4.67 / 10.98 / 5.29 ms, branch 16.78 / 3.95 / 18.93 ms;
- minor GCs: median CPU 0.27-0.30 against 0.25-0.28 ms, 0.84 MB freed on both, worst minor pauses on the branch
  3.96 / 2.86 / 0.88 ms;
- major GCs: 3 per run on both sides at the same heap sizes (17-19 MB).

The branch's two outliers are major GCs overlapping 72 ms and 50 ms SwiftShader GPU tasks:
- one spent 16.8 ms, but its phases add up to about 5 ms;
- the other lost 9.8 ms updating weak pointers.

Neither shows more allocation or a bigger heap; it is the contention case in docs/PERF.md. The phone number is
within its known 8-47 ms swing.

## Gate results for PRs 35-37 (gate key 047a433c916d05fa, commit 48042d0)
```
--- tests
 Test Files  15 passed (15)
      Tests  91 passed (91)
--- build
   dist/index.html: 5497 KB
--- e2e
   PASS  audio unlocks on the first click and plays music and effects  (running, 21 voices played, 0 dropped)
   PASS  shop buys an item at the fountain  (gold 1403 -> 1108)
   PASS  shop cards show what an item does for your hero  (For you: +25 speed)
   PASS  Escape closes the shop
   PASS  Tab opens the scoreboard with six heroes
   PASS  clicking a scoreboard row shows that hero's details and items
   PASS  left-clicking a unit on the battlefield inspects it  (clicked Kestrel Vane, panel Kestrel Vane)
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
   PASS  host opens a lobby and gets a five-letter code  (F5FEZ)
   PASS  the guest joins by code over WebRTC and appears in the host's lobby
   PASS  the guest sees the same lobby
   PASS  a hero pick reaches the host
   PASS  start waits until the guest is ready
   PASS  the guest's ready enables start
   PASS  both players are in the match and it runs
   PASS  host and guest play their own heroes  ([{"online":"host","player":0,"hero":"lumen"},{"online":"client","player":3,"hero":"kestrel"}])
   PASS  the guest's command moves its hero on the host
   PASS  the guest's world is identical to the host's  (tick 167/167, hash 318e9a9c/318e9a9c, rtt 2 ms)
   PASS  when the guest leaves, the host keeps playing with a bot in its seat
   PASS  no page errors
   E2E ONLINE: lobby, WebRTC and lockstep checks passed
--- bench-desktop
   desktop-medium: frames 2542, sim p95 0.1 ms, render update p95 0.3 ms, GC max 3.14 ms, draws 36
--- bench-play
   play-ping100: frames 2007, sim p95 0.2 ms, render update p95 0.3 ms, GC max 7.21 ms, draws 36
--- bench-mobile
   mobile-low: frames 3600, sim p95 0.7 ms, render update p95 1.1 ms, GC max 22.36 ms, draws 34
--- bench-eval
   PASS  simTickP95Ms                 0.7  / 2 (baseline 0.2, +396% throttle-normalized)
   PASS  renderUpdateP95Ms            1.1  / 3 (baseline 2.6, -40% throttle-normalized)
   PASS  uiUpdateMeanMs             0.441  / 0.6
   PASS  audioUpdateMeanMs          0.041  / 0.3
   FAIL  gcPauseMaxMs               22.36  / 5 (baseline 3.46, +816% throttle-normalized)
   PASS  drawCallsMax                  34  / 50 (baseline 45, -24%)
   PASS  loadMs                       606  / 4000 (baseline 803, +7% throttle-normalized)
   PASS  correctionsPer10s           0.25  / 1
   info  renderCpuP95Ms               4.7  / 6
   info  renderSubmitP95Ms            3.8  / 4
   info  frameP95Ms                    83  / 16.7
   info  frameP99Ms                 149.2  / 20
   info  inputLatencyP95Ms          181.2  / 136.7
   info  gcPausesOver5Ms               10
   info  gcContendedMaxMs           22.36
   info  gcContendedCount              71
   info  uiUpdateP95Ms                1.3
   info  audioUpdateP95Ms             0.1
   info  heapGrowthMbPer10Min        2.19  / 5
   info  gcWallMaxMs                26.68
   info  gcCount                      120
   info  memoryReducerMaxMs             0
   info  throttleFactor               3.6
   info  fps                           33
   info  onePercentLowFps             5.6  / 55
   info  trianglesMax               66256
   info  postPasses                     0
   info  longTasks                      6
   info  frames sampled              3600  (min 200)
   PERF GATE: 4 failure(s)
--- soak
   retained-heap slope: 3.68 MB per 10 min over 2.5 min (budget 5)
   SOAK: retained heap within budget
```
