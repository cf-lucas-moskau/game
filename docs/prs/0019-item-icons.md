# PR #19: Item icons

Branch: `claude/goal-test-aotoyo` (GitHub), commit c4bac82

## Summary

UI polish from the next-work list: items were shown as two-letter abbreviations. Each of the 15 items now has an
original inline-SVG glyph tinted by category (attack amber, magic violet, defense tide, movement green), defined in
`src/ui/identity.js` next to the hero emblems, so painted art can replace them in one place. The icons appear in the
HUD slots, shop cards, inventory, recommended build, scoreboard chips and the inspect panel. Scoreboard tables use a
fixed layout so both teams' columns line up.

## Checks

Looked at the HUD, shop, scoreboard and inspect panel at desktop and phone sizes. Icons are static DOM built when an
item changes, so per-frame UI cost is unchanged (gate results in PR #21's write-up).
