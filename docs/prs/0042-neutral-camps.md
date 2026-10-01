# PR #42: Barnacle Crab camps and timed buffs

Branch: `claude/goal-test-aotoyo` (commits for PR #42)

## Summary

Owner request ("do all of them", for the ideas offered after PR #40): neutral camps in the middle.

- **Camps.** Two Barnacle Crab nests in the neutral middle: (2200, 200) and (2600, 700).
  - The pair is symmetric through the lane's centre: blue's nearer nest is top-left, red's is bottom-right.
  - Both nests sit outside every tower's reach and outside the Sky Pearl's circle; tests check all three.
  - Crabs surface at 1:15 and return 70 s after they fall.
- **Crab behaviour.**
  - A crab fights whoever hit it last.
  - Pulled past its 520-unit leash, it walks home untouchable and heals.
  - Minions, towers and Pebble leave it alone.
- **Rewards.**
  - The hero who lands the killing blow gets 90 gold, xp and Barnacle Fury (+10% damage for 60 s).
  - Allies nearby share 40 gold and half the xp.
- **Buff framework.** `src/sim/buffs.js` defines timed buffs as data (duration and stat changes). `recomputeHero`
  folds active buffs into hero stats, hero upkeep expires them, and death clears them. The Sky Pearl and Gale
  Shrines use the same framework.
- **Neutral team.** `TEAM.NEUTRAL`, `KIND.CRAB` and `NEUTRAL` monster specs, with stats that grow per minute like
  minions. `EV.BUFF`, `EV.OBJECTIVE` and `EV.PICKUP` are added to the event stream.
- **Bots** (`src/ai/objectives.js`): the closest bot takes an uncontested camp and allies join it. A crab that would
  win the trade is left for later.
- **Presentation.**
  - The crab is a procedural low-poly model: shell with barnacles, eye stalks, eight arched legs and claws.
  - Body and claws are each one instanced draw, with a scuttle and claw-snap animation and a death tumble.
  - The nest is a ground marking; a downed nest fills a gold arc during its last 15 s.
  - Health bars and the minimap use neutral gold.
  - Other UI: inspect text, buff chips in the dock, banners and feed lines.
  - Sounds: bubbles when a camp surfaces, a shell crack when it falls, a shimmer when a buff is gained.
- **Simulation lab.** Objective statistics per hero (camps, damage to camps, Pearls, loot gold, shrines, shutdowns,
  best streak) and per match, with a "Map objectives" report row.

## Notes

- Bots take about 1.6 camps per match with all five features in (PR #46 numbers). They only go for one when no fight
  is near, which is rare in the busy middle. Human players will take them more.
