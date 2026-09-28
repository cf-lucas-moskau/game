# PR #3: Six hero kits

Branch: `heroes`

## Summary

## Checks

All six heroes as self-contained modules in `src/sim/heroes/`, registered in `index.js`.

- **Morrow**: echo trail from every cast, boomerang Cog Toss, Wind-Up shield that grants
  speed when broken, Step Through to the latest echo, Rewind to position and health 4 s back
  (ring-buffer history, cleanses CC).
- **Saffi**: flame drains 1.5%/s (gutters at 5%), relights 4% per hero hit (8% on marked
  targets), cannot be healed by allies, burning Flicker trail, Wax Drip cone, Snuff
  execute dash, Blaze Up splash.
- **Vesper**: drawn abilities from stroke points in commands; ink cost per stroke length,
  closed-loop detection for roots (point-in-polygon), Stroke Wall as movement-blocking segments,
  fallback shapes for touch quick-cast and bots.
- **Gus & Pebble**: two-body hero; Pebble is an AI unit with its own health pool that
  regenerates while mounted and rebuilds 20 s after dying; mounted/dismounted Q variants,
  Boulder Roll from whichever body carries the boulder, Avalanche leap.
- **Brindle**: bees as resource (gain per hit, decay out of combat), Sting DoT, Buzz Shield,
  Honey Pool, Hive Dome scaled by bees consumed.
- **Auctioneer**: gold-cost abilities, 0.5%/s interest, Gavel refund, Appraise amp,
  Going Once pull, Repossess moves the victim's priciest item for 8 s and returns it.

Engine additions: `modifyStats` can set range, projectile speed, radius and health multiplier;
`selfHealOnly` heal rule; hero `init` now runs before the first stat computation.
Tests cover every signature mechanic plus a 150 s six-hero determinism run.
