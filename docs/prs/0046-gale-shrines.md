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
