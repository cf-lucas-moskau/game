# PR #41: Side fairness (mirrored relics, team-neutral update order)

Branch: `claude/goal-test-aotoyo` (commits for PR #41)

## Summary

After PR #39 the blue side won 51.7-52.4% of bot matches, against 49.7-50.1% before. Causes found and fixed:

- **Relics were not mirrored.** `MAP.RELICS` held absolute x (1500 and 2500), which was symmetric only on the old
  4000-unit lane. On the 4800-unit lane red's relics sat 2300 from its base and blue's 1500. Relics are now
  `RELIC_X` from each side's own end. A test checks that relics and structures are mirror-symmetric.
- **Fixed update order.** Several things always ran blue-first, so blue struck first in an even trade:
  - combat, movement and hero upkeep iterated in a fixed order;
  - waves always spawned blue first, so blue's minions got the lower ids;
  - relic pickups always checked blue's heroes first.
  These now alternate every tick, and waves alternate which side spawns first. All of it is deterministic.
- **Bot think ticks.** A medium bot thinks every 8 ticks with phase `playerId % 8`, which gave blue phases 0, 1, 2
  and red 3, 4, 5. The phase now comes from the seat within the team, so both teams think on the same ticks.
- **Claude Docs permissions.** The owner asked not to approve every spec-doc edit, so `.claude/settings.json` now
  allows the `mcp__Claude_Docs` tools.

## What was measured (simulation lab, 1920 matches per run)

| state | blue win rate | first tower by blue |
| --- | --- | --- |
| before PR #39 (seed 1 / 2) | 50.1% / 49.7% | 48.6% |
| after PR #39 (seed 2) | 52.4% | 53.4% |
| relics mirrored (seed 2) | 52.0% | 53.4% |
| + combat order alternates (seed 2 / 5) | 51.0% / 51.8% | 51.4% / 52.5% |
| + movement, heroes, relic pickups, bot phases (seed 2 / 5) | 52.2% / 51.8% | 51.4% / 52.1% |
| final, fresh seeds 7 + 8 (3840 matches) | 51.6% (z 1.94) | |

Ruled out:
- Minion strength: the old minion numbers on the new lane gave 51.7%.
- The spatial hash: symmetric.
- Lane length: 4000 → 51.1% and 4400 → 49.9% under the current code, both within noise.

A residual of about 1.5 points remains. It is at the edge of significance and listed as a follow-up.

## Checks

- `npm test`: 94 passed (new: mirror-symmetric map).
- Gate: see below.

## Gate results (gate key 747abe000f9c1b77, commit 99bc8a6)

- tests: passed (94)
- build: passed
- e2e: passed
- bench-desktop, bench-play, bench-mobile: passed
- bench-eval: sim tick p95 0.1-0.7 ms, draw calls 32-33, corrections 0-0.33 per 10 s, desktop and play GC within
  budget. Only mobile gcPauseMaxMs failed (10.94 ms). That is below every main-build mobile run in the PR #39 A/B, taken
  one PR earlier in the same container (18.15-55.31 ms). This PR changes loop order only: no allocation, no render code.
- soak: passed (3.30 MB per 10 min, budget 5)
