# PR #24: Ten new heroes

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Owner request: "come up with 10 more heroes". Sixteen heroes now, each with an original signature mechanic, its
own rig and props (the ten Kenney Mini rigs the game did not use yet, plus eleven CC0 KayKit props), its own
ground-decal style, projectile shapes, impact effects, sounds, bot script and tests:

| Hero | Role | Signature | Style |
|---|---|---|---|
| Nimbus Kettle, the Stormherd | Burst mage | Static: 3 ability hits on heroes, then an attack chains lightning; Forked Bolt, Thunderhead cloud, Gale Push, Eye of the Storm | storm |
| Coralie Brine, the Reefwarden | Tank | Living Reef: hero hits grow armor/MR stacks; Coral Spike line knock-up, Brine Bulwark shield that bursts, Undertow drag, Reef Bloom root ring | coral |
| Kestrel Vane, the Harpooner | Marksman | Deadeye every 4th attack; Tether Harpoon reel-in, Drift Net, Updraft Roll, lane-long Skyline Shot | sight |
| Mistral Aveline, the Windcaller | Enchanter | Tailwind team haste; Crosswind (slows foes, speeds allies), Updraft knock-up, Carried Aloft shield, Jetstream corridor | wind |
| Rime Holloway, the Frostwright | Control mage | Deep Chill: third chill freezes, then immunity; Icicle Lance, Frost Field, Shatter (cashes chills in), Whiteout | frost |
| Old Thorne, the Skygardener | Zone mage | Sows seeds that grow into thornbush turrets (up to 3, real bush models); Bramble Snare, Overgrowth pulse, Grove Rising | vine |
| Cantor Brightbell, the Songkeeper | Battle bard | Tempo: a beat each second, spells on the beat are 40% stronger with a bonus; a metronome ring shows the beat | sound |
| Lumen Vey, the Starcartographer | Burst mage | Stars on enemy heroes, the third completes a constellation burst; Falling Star, Starlight Thread, Wayfinder (next spell free), Nova Chart | star |
| Dredge Harrow, the Anchorhand | Juggernaut (cooldowns only) | Heavy Chain: less damage taken when hurt; Anchor Toss drag, Deck Sweep, Hull Breach stun, Drop Anchor leap | iron |
| Wisp Umbrel, the Duskmoth | Assassin (energy) | Eclipse: takedowns reset her spells; Moth Swarm dusk mark, Shadow Swap (recast), Dusk Veil, Eclipse Dive | shadow |

Engine additions (all generic):
- `sim/resources.js`: resource types and their pools (energy and cooldown-only heroes); `abilityCost` /
  `abilityCooldown` for state-dependent costs (a free spell, a free recast) used by casting, bots and the HUD.
- `onTakedown` hero hook (kill or assist).
- Ten decal styles in the decal shader; ten impact recipes in `combat-fx.js`; `api.prop` (instanced manifest models
  drawn by packs), `api.markLine`, `api.spawnOnce`, `api.focusId` (cues only for the player, e.g. Cantor's
  metronome); pack-declared `leaps` replace a Gus special case in `units.js` (leaps now arc).
- HUD ability labels shrink for long names ("Thunderhead", "Eye of the Storm").

## Balance (bot matches, `tools/simulate.mjs`)

Bot win rate is a proxy: it also measures how well each bot script plays its hero. The original six were already
spread from 37% to 73% in `main` (300 matches). The new ten were tuned in six rounds of 480-960 matches into
roughly the same band. Final run, 960 matches, about 340 games per hero (standard error about 2.7%):

| Hero | Win % | K/D |
|---|---|---|
| morrow | 76.4 | 1.09 |
| gus | 67.4 | 0.74 |
| coralie | 59.3 | 0.42 |
| lumen | 57.3 | 1.12 |
| nimbus | 57.0 | 0.70 |
| thorne | 56.5 | 0.61 |
| dredge | 54.3 | 0.67 |
| rime | 53.3 | 0.59 |
| kestrel | 53.3 | 1.31 |
| mistral | 45.7 | 0.42 |
| cantor | 43.7 | 0.41 |
| vesper | 40.9 | 0.46 |
| brindle | 36.8 | 0.55 |
| auctioneer | 36.7 | 0.54 |
| wisp | 32.9 | 0.49 |
| saffi | 27.9 | 0.76 |

Wisp stays low like Saffi: a cast census showed she casts plenty (43 Q, 33 W per game) but dies about 12 times a
game, as melee divers do under the shared bot engagement logic; improving how bots play divers is a separate task.
The original six were left as they were. Average match length is 10.0 minutes (was 9.5 with six heroes).

## Checks

- `tests/heroes-new.test.js`: one duel per hero for its signature (static chain, reef armor and burst, Deadeye
  slow, Carried Aloft, freeze + immunity + Shatter, bush turret + cap, beat timing and the on-beat bonus,
  constellation burst + free spell, damage reduction + breach stun, shade swap + takedown reset).
- The chaotic every-hero-every-ability determinism test now runs all 16; the presentation contract test covers
  every pack; e2e casts every ability and plays every clip for all 16 in the Lab.
- Visual: Lab contact sheets of all heroes (front and three-quarter), and every new ability at +0.35 s and +0.9 s;
  found and fixed an oversized rolled-map prop (replaced by a drafting compass), a bell hanging at the feet, tiny
  axe and trowel, clipped HUD labels, and a metronome ring too loud on allies' Cantors.
