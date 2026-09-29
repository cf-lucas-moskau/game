# PR #23: Hero presentation packs

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Groundwork for the ten new heroes. A hero's presentation was spread over hard-coded switches in about a dozen
files (effects, zones, decals, projectile and melee styles, aim shapes, sounds, UI identity), so every new hero
would have touched all of them. Now each hero is three modules:

- `src/sim/heroes/<hero>.js`: rules. The recommended item build moved here from a table in `items/index.js`.
- `src/ai/heroes/<hero>.js`: bot script (split from `ai/heroes.js`; shared helpers in `ai/heroes/util.js`).
- `src/presentation/heroes/<hero>.js`: presentation pack. It holds the accent and emblem, the decal style, aim
  shapes (with an optional `aimFor` for context-dependent shapes like Gus's Q), projectile and melee styles,
  cast/auto sounds, and effect hooks: `cast`, `blink`, named `events`, per-frame `decals` / `particles` /
  `ground`, a `world` hook for statuses a hero puts on others, and per-zone-kind drawers. Packs import no engine
  code (format documented in `presentation/kit.js`).

`render/hero-fx.js` runs the packs. It dispatches events to the owning pack and gives packs one api (particles,
timed and per-frame decals, ribbons, discs, domes, telegraphs, shake, cached colours, per-renderer state). The
engines are generic: `ability-fx.js`, `zones.js` and `fx.js` each call a hook between their per-frame reset
and their GPU upload, which is where packs draw lasting states. `attack-styles.js`, `input/aim.js`,
`ui/identity.js` and `audio/sounds.js` read the packs.

## Checks

- Visual equivalence: every hero's four abilities rendered in the Lab (+0.35 s after the cast) from `main`'s
  build and from this branch; the sheets match apart from random particle placement.
- `tests/presentation.test.js`: every hero has a pack, bot script, look and a valid 6-item build; packs declare
  identity, a valid decal style, four aim shapes and sounds; every hero has an attack look; every ability
  projectile kind a hero's sim module spawns has a style.
- Bot matches (`tools/simulate.mjs`) and the determinism/replay tests are unchanged; e2e passes.

## Bug found after the commit

Moving the build lists onto the hero definitions inserted Saffi's line in the middle of hers, and its trailing
comment swallowed `noRegen: true, selfHealOnly: true` (she would regenerate and accept ally heals). The Saffi test
caught it; I had missed the failure because I read only the last lines of the test output. Fixed in the next commit.
