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
