# PR #4: Items and shop rules

Branch: `items`

## Summary

## Checks

Adds the item registry (6 stat items, 9 uniques) as data plus hooks, and `src/sim/content.js`
as the single content pack the game loads.

Unique effects hook into the existing pipeline: `onLethal` + `modifyDamageIn` (Borrowed
Seconds pending-damage window), `onTick` displacement drag and whale immunity (Magnet Boots),
`modifyDamageOut`/`onTookDamage` (Cursed Coin), stationary stacking (Barnacle Plate), ability
marks (Lanternfish Lens), 4th-hit tether (Harpoon Chain), minion-kill refunds (Kelp Crown),
an active (Stormcaller's Horn), and a burst-window shield (Molted Shell).
`BUILDS` gives per-hero recommendations used by the shop and bots.
Tests: shop gating, uniqueness, 6-slot cap, lethal delay and rescue, barnacle stacking,
magnet immunity, Repossess round trip.

```
== 1/3 unit + determinism tests
   ✓ heroes > every hero casts every ability in a chaotic 3v3 without errors, deterministically 1534ms
   ✓ simulation > is deterministic for the same seed and commands 1159ms
   ✓ simulation > whale roll cycles through warn, roll and back to idle 535ms
   ✓ simulation > heroes gain gold, xp and levels, and structures take damage 752ms
      Tests  27 passed (27)
   Start at  12:32:39
   Duration  5.90s (transform 217ms, setup 0ms, collect 390ms, tests 4.47s, environment 1ms, prepare 323ms)
== 2/3 production build
   dist/index.html: 1 KB
== 3/3 performance benchmark vs budgets
   (bench harness not present yet)
ALL CHECKS PASSED
```
