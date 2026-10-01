# PR #44: Treasure when the whale rolls

Branch: `claude/goal-test-aotoyo` (commits for PR #44)

## Summary

- **Loot.** When the whale rolls, six pieces of loot wash up in the endangered edge band it tilts toward.
  - They sit 250, 750 and 1250 from the centre, mirrored for both sides.
  - Each pays 45 gold and 50 xp to the hero who grabs it.
  - Whatever is left drifts away 3 s after the roll.
- **Refactor.** `src/sim/pickups.js` owns all pickups (`kind: 'relic' | 'loot'`); the relic logic moved out of
  `match.js`. Contested pickups go alternately, as in PR #41.
- **Bots** grab loot within 520 units when above half health.
- **Presentation.** Spinning gold coins (one instanced draw) over a gold glow, gold dots on the minimap, a banner on
  the first roll, a coin sound and a gold burst.

## Measured

- About two thirds of the loot is taken by bots (140 of 210 pieces in 8 matches).
- 816 gold of loot is collected per match, both teams together.
