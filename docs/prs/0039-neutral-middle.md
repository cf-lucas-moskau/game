# PR #39: Neutral middle between the towers

Branch: `claude/goal-test-aotoyo` (commits for PR #39)

## Summary

The owner asked for "a bigger part in the middle of the lane where turrets can't attack you". The outer towers stood at x = 1350 and
2650 with a reach of 680 (+90 tower radius), so their circles overlapped: the old lane had no safe ground at all.

- **Longer lane.** 4000 → 4800 units (`LANE.W`). All towers keep their distance from their own base, so the
  middle gains 800 units. The open ground between the outer towers is now 560 units, or 700 between the range circles.
  `tests/bots.test.js` keeps it at 500 or more.
- **The whale grows with the lane.** In `src/render/environment.js` the head and eye sit 12 units beyond the red end and
  the fins at 75% of the lane. Rock and crystal counts keep the same density along the lane. Draw calls are unchanged
  (instanced meshes).
- **Waves that threaten towers.** With the longer lane alone, 29% of matches ended with no tower destroyed (1.8%
  before) and towers per match fell from 1.96 to 1.19. Changes:
  - Minion attack ×1.5 (melee 20 → 30, ranged 28 → 42, siege 48 → 72). Heroes can no longer ignore a wave.
  - Against structures, minions deal ×2 and siege minions ×4.5 (was ×1.3 and ×3). These multipliers are now
    `RULES.MINION_VS_STRUCTURE` and `RULES.SIEGE_VS_STRUCTURE`, so the lab can patch them.
- **Rebalance for the new map.** The longer lane favoured Gus (74%) and hurt the melee divers (Wisp 27%, Dredge
  40%). A sensitivity sweep and two combined rounds:
  - Gus: Q −40% (both forms), hp 690 → 650.
  - Wisp: hp 780 → 1000, speed 350 → 375, Q +15%.
  - Dredge: Heavy Chain cap 4% → 12%, speed 335 → 350.
  - Morrow: Q −10%.
  - Brindle: Hive Dome heal −30%, Buzz Shield −15%.
  - Vesper: Q +15%.
  - Auctioneer: Q +20%, hp 560 → 620.

## What was measured (simulation lab, medium bots)

| | before (4000) | 4800 alone | final, seed 1 (960) | final, seed 2 (1920) |
| --- | --- | --- | --- | --- |
| matches with no tower destroyed | 1.8% | 28.6% | 9.6% | 10.5% |
| towers per match | 1.96 | 1.19 | 1.78 | 1.74 |
| first tower (min) | 5.7 | 7.5 | 6.3 | 6.1 |
| average match length (min) | 10.5 | 10.8 | 10.1 | 10.1 |
| sudden death reached | 80% | 85% | 68% | 69% |
| hero win-rate spread (sd, points) | 4.9 | 9.9 | 5.0 | 4.1 |
| hero win-rate range | 41-58% | 29-68% | 42-58% | 40-56% |

Seed 2 after: brindle 55.8, mistral 55.4, morrow 54.6, thorne 53.5, kestrel 52.8, vesper 52.4, gus 52.3, lumen 51.6,
nimbus 49.5, dredge 49.4, cantor 47.5, rime 47.3, saffi 46.6, coralie 46.5, auctioneer 45.6, wisp 40.3.

Levers tried for pacing on the longer lane (480 matches each). Only minion attack moved it:

| change | towers per match | no tower |
| --- | --- | --- |
| tower hp 2300 → 1800 / 1500 | (first tower 7.3 / 7.0 min) | 17% at 1500 |
| waves every 18 s instead of 25 s | (first tower 7.0 min) | |
| siege minion every wave | (first tower 7.1 min) | |
| minion growth ×2.4 | (first tower 7.5 min) | |
| bots push after one kill | (first tower 7.9 min, worse) | |
| minion vs structure ×2.2 / ×2.6 alone | 1.48 / 1.60 | 17.5% / 14% |
| minion attack ×2 | 1.89 | 5.0% |
| minion attack ×1.5 + structure ×2 / ×4.5 | 1.84 | 7.7% |

Tower damage over 40 matches came two thirds from minions. Heroes spent 4% of their time in the enemy half. Waves
decide when towers fall, and a wave that reaches a tower must be a threat.

Visual check: overview screenshots of the 4800 lane. The whale's head and tail and the scenery line up, and the gap
between inner and outer towers is clearly open.

## Checks

- `npm test`: 93 passed (new: open middle at least 500 units; bots wait mid-lane between waves).
- Gate: see below.
