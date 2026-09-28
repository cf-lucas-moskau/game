# PR #2: Deterministic simulation foundation

Branch: `sim-foundation`

## Summary

## Checks

The full rules layer, independent of rendering:

- `World`: pooled entity records, spatial index, deterministic timers, event stream.
- One damage pipeline (armor/MR, amplifiers, shields, lifesteal, hero and item hooks,
  lethal-delay hook for Borrowed Seconds, assists) and crowd control helpers.
- Movement with wall sliding, structure avoidance steering, soft unit separation and whale slide.
- Auto-attacks with windup, homing projectiles, minion and tower AI (tower hero-aggro rule).
- Match rules: waves every 25 s (siege every third), towers fall in order, Heartstone win,
  passive gold, XP sharing, auto-leveled ability ranks, respawn timers, fountain, shop gating,
  whale roll (warn/roll/edge damage), health relics, sudden death at 12:00.
- Commands schema with validation for untrusted (network) input.

Tests: determinism (identical hash across runs), waves, whale cycle, progression, tick cost.

```
== 1/3 unit + determinism tests
   ✓ simulation > is deterministic for the same seed and commands 1125ms
   ✓ simulation > whale roll cycles through warn, roll and back to idle 548ms
   ✓ simulation > heroes gain gold, xp and levels, and structures take damage 744ms
      Tests  11 passed (11)
   Start at  12:26:09
   Duration  3.43s (transform 184ms, setup 0ms, collect 220ms, tests 2.69s, environment 0ms, prepare 164ms)
== 2/3 production build
   dist/index.html: 1 KB
== 3/3 performance benchmark vs budgets
   (bench harness not present yet)
ALL CHECKS PASSED
```
