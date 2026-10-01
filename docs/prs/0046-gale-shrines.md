# PR #46: Gale Shrines

Branch: `claude/goal-test-aotoyo` (commits for PR #46)

## Summary

- **Placement.** Two shrines, symmetric through the centre, in the corners the camps leave free: (2600, 215) and
  (2200, 685).
- **Channel.** A hero who stands in a ready shrine for 1.5 s without fighting, and with no enemy hero inside, gets
  Tailwind: +30% move speed and +20% attack speed, but 12% more damage taken, for 10 s.
- **Cooldown.** The shrine then recharges for 40 s; both shrines are first ready at 1:00.
- **Bots** channel a ready shrine within 700 units when no enemy hero is within 900 of it.
- **Presentation.**
  - A three-stone cairn with a crystal that glows while ready and spins up during a channel (2 draws).
  - A wind-spiral decal that fills with channel progress and dims while recharging.
  - Minimap triangles and a wind sound.

## Measured

5.1 shrine channels per match.

## All five features together (960 matches, seed 1)

| measure | before (PR #41) | after |
| --- | --- | --- |
| match length (mean / p10) | 10.1 / - min | 9.0 / 5.1 min |
| matches under 5 min | - | 8.5% |
| sudden death reached | 68% | 48.5% |
| blue win rate | 51.6% | 49.0% |
| hero spread (sd) | 4.1-5.0 | 5.2 (41.6-59.5%) |
| kills per match | 32.9 | 29.2 |

Per match: 1.6 camps, 2.2 Pearls, 816 loot gold, 5.1 shrines, 4.7 shutdowns.

Gate: see below.

## GC check for the PR #42-#46 merge

The first gate run failed gcPauseMaxMs on play (6.27 ms) and mobile (16.59 ms). An interleaved A/B against main
(0d01621) showed play overlapping, but mobile GC totals higher on the branch in two of three pairs (242 vs 195 ms,
449 vs 270 ms). A review of the new code found three per-frame or per-think allocations (fixed in this merge):

- the buff chips built a key string every frame while a buff was active;
- the Pearl bot intent built a point object on every think;
- the camp bot intent created a closure on every think.

After the fix, desktop and play pass (2.99 and 3.74 ms). Mobile, 4 interleaved pairs:

| | main max (ms) | branch max (ms) | main GC total (ms) | branch GC total (ms) |
| --- | --- | --- | --- | --- |
| mobile-low | 30.09, 27.75, 26.13, 44.10 | 31.74, 28.32, 20.35, 41.38 | 348, 307, 313, 351 (mean 330) | 308, 367, 343, 302 (mean 330) |

Equal GC work. The remaining maxima are the known contention outliers on both builds.

## Gate results (gate key b455fc9531dfbf4b, commit 04db3ec)

- tests: passed (103)
- build: passed
- e2e: passed
- bench-desktop, bench-play, bench-mobile: passed
- bench-eval: draw calls 40-41 (budget 50; was 33-35); desktop and play GC within budget; mobile gcPauseMaxMs 38.31 ms,
  justified above
- soak: passed (3.90 MB per 10 min, budget 5)
