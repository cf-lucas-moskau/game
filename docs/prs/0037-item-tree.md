# PR #37: Item build tree, cooldown reduction and more items

Branch: `claude/goal-test-aotoyo` (commits for PR #37)

## Summary

Owner request: "I want more items, item components, cooldown reduction etc."

- **Build tree (40 items).**
  - 10 components: +15 attack, +12% attack speed, 8% lifesteal, +25 ability power, mana and regeneration, 10%
    cooldown reduction, +150 health, +15 armor, +15 magic resist, boots.
  - 14 upgrades: the old stat items, now built from components, plus Riptide Bow, Anglerfin Blade, Brinecaller's
    Sash, Warden's Bark, and three new boots next to Quickcurrent and Magnet Boots.
  - 16 finished items: the 9 old ones with recipes, plus 7 new ones:
    - Leviathan's Maw: lifesteal, and basic attacks on heroes heal a share of missing health;
    - Reefbreaker: 30% armor penetration;
    - Squall Bell: attack speed and bonus magic damage on hit;
    - Storm Cutlass: the next basic attack after a cast is empowered;
    - Deepwater Codex: 30% magic penetration;
    - Tidewatch Hourglass: 20% cooldown reduction, and a speed boost after casting;
    - Coral Aegis: an active shield for you and nearby allies;
    - Stillwater Pendant: 30% tenacity.
  - `from` recipes; tiers follow from the tree; `group: 'boots'` allows one pair.
- **Purchases** (`match.js#purchasePlan`, `buy`): owned components anywhere down the tree are used up and knock their
  cost off the price. A full inventory can still combine. Unique items and one boots group are enforced. The shop
  and the bots use the same plan.
- **New stats.** Cooldown reduction on many items (still capped at 40%). Armor and magic penetration (ignore a share
  of resistances, capped at 45%). Tenacity (shortens stuns, roots, slows and knock-ups on heroes, capped at 50%).
  Mana and health regeneration. All are declared in `createEntity`.
- **Shop.** Category filter; Components, Upgrades and Finished sections; each card shows the price after your
  components (full price struck through), the recipe with owned parts lit, and what it does for your hero after the
  parts are used up. The tooltip names what the item builds into. The stat formatter covers the new stats, and there
  are icons for all 25 new items plus a support colour.
- **Bots** buy the next build item when its price is affordable, otherwise its most expensive affordable component.
  Every hero's recommended build uses the new items: marksmen on-hit and penetration, mages the codex and hourglass,
  tanks and supports the aegis and tenacity.

## Balance (simulation lab, 960 matches, seed 1)

- First version: Dredge 75.8% (from 66%). Focus A/Bs, 480 matches each:
  - his old build: 68.5%;
  - Harpoon Chain in place of Storm Cutlass: 69.0%;
  - weaker tenacity on Anchor Boots: no change;
  - a milder Cutlass passive: no change;
  - Cutlass without cooldown reduction: -2.7;
  - Cutlass without its 200 health: -9.4, z -3.19.
- Fix: health on an attack item was too good for juggernauts. Storm Cutlass is now 40 attack damage, 10% cooldown
  reduction, no health, 2600 gold; the passive numbers are data fields the lab can patch.
- After: win-rate spread sd 0.123 (before the item update 0.128), Dredge 68.1%, blue 52.8% (CI 49-56), match
  10.0 min, kills 35.6. The hero order is as before (Morrow and Lumen high, Saffi low: see the balance proposal).
- Item win rates rise with purchase time (heroes who are ahead buy late items), so use `--builds role` for item
  balance.

## Checks

91 tests (7 new or rewritten for items):
- recipes cost more than their parts, tiers follow the tree, every build item exists;
- recursive component use and price;
- a full inventory combines;
- the boots group;
- penetration, tenacity and cooldown reduction;
- the Storm Cutlass and Squall Bell effects.

The lab's gold books now count prices paid. Visual: the shop with two Shark Teeth and Driftwood Boots owned
(discounts, lit recipe parts, "for you" lines, category filter).
