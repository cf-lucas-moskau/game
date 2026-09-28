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
